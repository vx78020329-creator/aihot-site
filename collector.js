const RSSParser = require('rss-parser');
const cheerio = require('cheerio');
const { db, stmts } = require('./db');
const sources = require('./sources');

const parser = new RSSParser({ timeout: 15000 });

// ── 工具函数 ──
function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function truncate(text, len = 500) {
  if (!text) return '';
  return text.length > len ? text.slice(0, len) + '...' : text;
}

function similar(a, b) {
  if (!a || !b) return false;
  a = a.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
  b = b.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
  if (a === b) return true;
  const shorter = Math.min(a.length, b.length);
  if (shorter < 8) return false;
  let match = 0;
  for (let i = 0; i < shorter; i++) { if (a[i] === b[i]) match++; }
  return match / shorter > 0.75;
}

function scoreItem(item) {
  let s = 50;
  if (item.title && item.title.length > 10) s += 10;
  if (item.content && item.content.length > 200) s += 15;
  if (item.summary && item.summary.length > 50) s += 10;
  if (item.category === 'AI') s += 5;
  if (item.category === '世界') s += 5;
  if (item.category === '科学') s += 3;
  return Math.min(100, s);
}

// ── 全文内容抓取 ──
async function fetchFullContent(url) {
  if (!url) return { content: '', image: '' };
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      }
    });
    if (!res.ok) return { content: '', image: '' };
    const html = await res.text();
    const $ = cheerio.load(html);

    // 移除无关元素
    $('script, style, nav, header, footer, aside, .ad, .ads, .sidebar, .comment, .related, noscript, iframe, .recommend').remove();

    // 提取主图
    let image = $('meta[property="og:image"]').attr('content') || '';
    if (!image) image = $('article img, .content img, main img').first().attr('src') || '';

    // 多种选择器提取正文
    const selectors = [
      'article', '.article-content', '.post-content', '.entry-content',
      '.content-body', '.story-body', '.article-body', 'main .content',
      '[itemprop="articleBody"]', '.RichContent-inner', '.Post-RichTextContainer',
      '.article__body', '.story__body', '.post-body'
    ];

    let content = '';
    for (const sel of selectors) {
      const el = $(sel);
      if (el.length && el.text().trim().length > 100) {
        const paragraphs = [];
        el.find('p, h2, h3, h4, blockquote, li').each((_, e) => {
          const t = $(e).text().trim();
          if (t.length > 10) paragraphs.push(t);
        });
        if (paragraphs.length > 2) { content = paragraphs.join('\n\n'); break; }
      }
    }

    // 降级：所有 <p>
    if (!content) {
      const paragraphs = [];
      $('p').each((_, e) => {
        const t = $(e).text().trim();
        if (t.length > 20) paragraphs.push(t);
      });
      content = paragraphs.join('\n\n');
    }

    if (!content) content = truncate(stripHtml($('body').html() || ''), 2000);
    return { content: truncate(content, 3000), image };
  } catch {
    return { content: '', image: '' };
  }
}

// ── 翻译：多后端容错 ──
let translateFailCount = 0;

async function translateToZh(text) {
  if (!text || text.length < 3) return text;
  // 如果连续失败太多次，跳过翻译
  if (translateFailCount >= 5) return text;

  // 后端 1: MyMemory
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 450))}&langpair=en|zh-CN`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const data = await res.json();
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      const t = data.responseData.translatedText;
      if (t.toLowerCase() !== text.toLowerCase() && !t.includes('YOU USED ALL AVAILABLE')) {
        translateFailCount = 0;
        return t;
      }
    }
  } catch {}

  // 后端 2: Google Translate (unofficial)
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodeURIComponent(text.slice(0, 300))}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    if (data && data[0]) {
      const t = data[0].map(s => s[0]).join('');
      if (t) { translateFailCount = 0; return t; }
    }
  } catch {}

  translateFailCount++;
  return text;
}

// ── RSS 采集 ──
async function collectRSS(src) {
  const items = [];
  try {
    const feed = await parser.parseURL(src.url);
    for (const entry of (feed.items || []).slice(0, 15)) {
      if (!entry.title) continue;
      const link = entry.link || entry.guid || '';
      const rssSummary = stripHtml(entry.contentSnippet || entry.content || entry.summary || '');
      items.push({
        link, title: entry.title.trim(),
        summary: truncate(rssSummary, 500),
        source: src.name, category: src.category, lang: src.lang,
        published_at: entry.isoDate || entry.pubDate || new Date().toISOString(),
      });
    }
  } catch (e) { console.error(`[RSS] ${src.name}: ${e.message}`); }
  return items;
}

// ── Hacker News ──
async function collectHN(src) {
  const items = [];
  try {
    const res = await fetch(`${src.url}/topstories.json`, { signal: AbortSignal.timeout(10000) });
    const ids = await res.json();
    for (const id of ids.slice(0, 20)) {
      try {
        const r = await fetch(`${src.url}/item/${id}.json`, { signal: AbortSignal.timeout(5000) });
        const story = await r.json();
        if (!story?.title) continue;
        items.push({
          link: story.url || `https://news.ycombinator.com/item?id=${id}`,
          title: story.title.trim(),
          summary: story.text ? truncate(stripHtml(story.text), 300) : '',
          source: 'Hacker News', category: src.category, lang: 'en',
          published_at: new Date(story.time * 1000).toISOString(),
          score: Math.min(100, Math.floor(Math.log2(story.score || 1) * 15)),
        });
      } catch {}
    }
  } catch (e) { console.error(`[HN] ${e.message}`); }
  return items;
}

// ── Reddit ──
async function collectReddit(src) {
  const items = [];
  try {
    const res = await fetch(`https://www.reddit.com/r/${src.subreddit}/hot.json?limit=15`, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HotNewsBot/1.0)' }
    });
    const data = await res.json();
    for (const child of (data?.data?.children || [])) {
      const post = child.data;
      if (!post.title || post.stickied) continue;
      items.push({
        link: post.url?.startsWith('/') ? `https://reddit.com${post.url}` : post.url,
        title: post.title.trim(),
        summary: truncate(stripHtml(post.selftext || ''), 300),
        source: `Reddit r/${src.subreddit}`, category: src.category, lang: 'en',
        published_at: new Date(post.created_utc * 1000).toISOString(),
        score: Math.min(100, Math.floor(Math.log2(post.score || 1) * 12)),
      });
    }
  } catch (e) { console.error(`[Reddit] r/${src.subreddit}: ${e.message}`); }
  return items;
}

// ── 主采集流程 ──
async function collectAll() {
  console.log(`[Collector] Starting at ${new Date().toISOString()}`);
  translateFailCount = 0; // 重置翻译失败计数
  const raw = [];
  const batchSize = 4;

  for (let i = 0; i < sources.length; i += batchSize) {
    const batch = sources.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(s => {
        if (s.type === 'hn') return collectHN(s);
        if (s.type === 'reddit') return collectReddit(s);
        return collectRSS(s);
      })
    );
    for (const r of results) {
      if (r.status === 'fulfilled') raw.push(...r.value);
    }
  }

  console.log(`[Collector] Raw: ${raw.length}`);

  // 去重
  const seen = new Map();
  const unique = [];
  for (const item of raw) {
    const key = item.link || item.title;
    if (seen.has(key)) continue;
    let dup = false;
    for (const [k] of seen) {
      if (similar(item.title, k)) { dup = true; break; }
    }
    if (!dup) { seen.set(key, true); unique.push(item); }
  }
  console.log(`[Collector] Unique: ${unique.length}`);

  // 过滤已有
  const newItems = [];
  for (const item of unique) {
    if (item.link) {
      const row = db.prepare('SELECT id FROM items WHERE link = ?').get(item.link);
      if (row) continue;
    }
    newItems.push(item);
  }
  console.log(`[Collector] New: ${newItems.length}`);

  // 抓取全文 + 翻译（限流）
  const saved = [];
  for (let i = 0; i < newItems.length && i < 50; i++) {
    const item = newItems[i];
    const { content, image } = await fetchFullContent(item.link);
    item.content = content;
    item.image_url = image || '';

    // 翻译（英文内容）
    if (item.lang === 'en') {
      // 只翻译标题，摘要用原文（节省 API 额度）
      const tTitle = await translateToZh(item.title);
      if (tTitle !== item.title) item.title = tTitle;
      // 摘要：如果太长就不翻译
      if ((item.summary || '').length < 150) {
        const tSummary = await translateToZh(item.summary || '');
        if (tSummary !== item.summary) item.summary = tSummary;
      }
    }

    item.score = item.score || scoreItem(item);
    item.tags = '[]';

    try {
      const result = stmts.insertItem.run(item);
      if (result.changes > 0) saved.push(item);
    } catch {}
  }

  // 精选
  db.prepare('UPDATE items SET is_curated = 1 WHERE score >= 70 AND is_curated = 0').run();

  console.log(`[Collector] Saved: ${saved.length}`);
  return { total: raw.length, unique: unique.length, newItems: saved };
}

module.exports = { collectAll };
