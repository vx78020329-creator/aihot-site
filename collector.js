const RSSParser = require('rss-parser');
const cheerio = require('cheerio');
const { db, stmts } = require('./db');
const sources = require('./sources');

const parser = new RSSParser({ timeout: 8000 });

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}
function truncate(text, len = 500) {
  return !text ? '' : text.length > len ? text.slice(0, len) + '...' : text;
}
function similar(a, b) {
  if (!a || !b) return false;
  a = a.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
  b = b.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
  if (a === b) return true;
  const s = Math.min(a.length, b.length);
  if (s < 8) return false;
  let m = 0;
  for (let i = 0; i < s; i++) { if (a[i] === b[i]) m++; }
  return m / s > 0.85;
}
function scoreItem(item) {
  let s = 20;
  if (item.title && item.title.length > 10) s += 5;
  if (item.title && item.title.length > 30) s += 5;
  if (item.content && item.content.length > 1000) s += 20;
  else if (item.content && item.content.length > 500) s += 15;
  else if (item.content && item.content.length > 200) s += 10;
  else if (item.content && item.content.length > 50) s += 5;
  if (item.summary && item.summary.length > 100) s += 5;
  if (item.image_url) s += 5;
  if (item.category === 'AI') s += 5;
  if (item.category) s += 3;
  return Math.min(95, s);
}

// Fetch full content from article URL
async function fetchFullContent(url) {
  if (!url) return { content: '', image: '' };
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html', 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8' }
    });
    if (!res.ok) return { content: '', image: '' };
    const html = await res.text();
    const $ = cheerio.load(html);
    $('script,style,nav,header,footer,aside,.ad,.ads,.sidebar,.comment,.related,noscript,iframe,.recommend').remove();
    let image = $('meta[property="og:image"]').attr('content') || '';
    if (!image) image = $('article img,main img').first().attr('src') || '';

    const sels = ['article','.article-content','.post-content','.entry-content','.content-body','.story-body','[itemprop="articleBody"]','.RichContent-inner','.Post-RichTextContainer'];
    let content = '';
    for (const sel of sels) {
      const el = $(sel);
      if (el.length && el.text().trim().length > 100) {
        const ps = [];
        el.find('p,h2,h3,h4,blockquote,li').each((_, e) => { const t = $(e).text().trim(); if (t.length > 10) ps.push(t); });
        if (ps.length > 2) { content = ps.join('\n\n'); break; }
      }
    }
    if (!content) {
      const ps = [];
      $('p').each((_, e) => { const t = $(e).text().trim(); if (t.length > 20) ps.push(t); });
      content = ps.join('\n\n');
    }
    if (!content) content = truncate(stripHtml($('body').html() || ''), 2000);
    return { content: truncate(content, 3000), image };
  } catch { return { content: '', image: '' }; }
}

// ---- Translation (per-item fail tracking, not global) ----
const translationCache = new Map();

async function translateToZh(text) {
  if (!text || text.length < 3) return text;
  // Check cache
  const cached = translationCache.get(text);
  if (cached) return cached;

  // Google Translate unofficial API
  try {
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=' + encodeURIComponent(text.slice(0, 1500));
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    if (data?.[0]) {
      const t = data[0].map(s => s[0]).join('');
      if (t && t.length > 2) { translationCache.set(text, t); return t; }
    }
  } catch (e) {
    console.warn('[Translate] Google failed:', e.message);
  }

  // MyMemory fallback
  try {
    const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text.slice(0, 1500)) + '&langpair=auto|zh-CN';
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    if (data.responseStatus === 200 && data.responseData?.translatedText && !data.responseData.translatedText.includes('WARNING')) {
      translationCache.set(text, data.responseData.translatedText);
      return data.responseData.translatedText;
    }
  } catch (e) {
    console.warn('[Translate] MyMemory failed:', e.message);
  }

  return text; // Return original if both fail
}

// Check if text is already Chinese
function isChinese(text) {
  if (!text) return true;
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  return cjk / Math.max(text.length, 1) > 0.1;
}

// Collect RSS sources
async function collectRSS(src) {
  const items = [];
  try {
    const feed = await parser.parseURL(src.url);
    for (const e of (feed.items || []).slice(0, 20)) {
      if (!e.title) continue;
      items.push({
        link: e.link || e.guid || '', title: e.title.trim(),
        summary: truncate(stripHtml(e.contentSnippet || e.content || e.summary || ''), 500),
        source: src.name, category: src.category, lang: src.lang,
        published_at: e.isoDate || e.pubDate || new Date().toISOString(),
      });
    }
  } catch (e) { console.error('[RSS] ' + src.name + ': ' + e.message); }
  return items;
}

// Collect Hacker News
async function collectHN(src) {
  const items = [];
  try {
    const res = await fetch(src.url + '/topstories.json', { signal: AbortSignal.timeout(10000) });
    const ids = await res.json();
    for (const id of ids.slice(0, 30)) {
      try {
        const r = await fetch(src.url + '/item/' + id + '.json', { signal: AbortSignal.timeout(5000) });
        const s = await r.json();
        if (!s?.title) continue;
        items.push({
          link: s.url || 'https://news.ycombinator.com/item?id=' + id,
          title: s.title.trim(), summary: s.text ? truncate(stripHtml(s.text), 300) : '',
          source: 'Hacker News', category: src.category, lang: 'en',
          published_at: new Date(s.time * 1000).toISOString(),
          score: Math.min(95, Math.floor(20 + Math.log2(s.score || 1) * 10)),
        });
      } catch {}
    }
  } catch (e) { console.error('[HN] ' + e.message); }
  return items;
}

// Collect Reddit
async function collectReddit(src) {
  const items = [];
  try {
    const url = 'https://www.reddit.com/r/' + src.subreddit + '/hot.json?limit=15';
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'HotNewsBot/2.0 (by /u/aihotbot)' }
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { return items; }
    for (const child of (data?.data?.children || [])) {
      const p = child.data;
      if (!p.title || p.stickied) continue;
      items.push({
        link: p.url?.startsWith('http') ? p.url : 'https://reddit.com' + p.permalink,
        title: p.title.trim(), summary: truncate(stripHtml(p.selftext || ''), 300),
        source: 'Reddit r/' + src.subreddit, category: src.category, lang: 'en',
        published_at: new Date(p.created_utc * 1000).toISOString(),
        score: Math.min(95, Math.floor(20 + Math.log2(p.score || 1) * 12)),
      });
    }
  } catch (e) { console.error('[Reddit] r/' + src.subreddit + ': ' + e.message); }
  return items;
}

// Main collection function
async function collectAll() {
  console.log('[Collector] Starting at ' + new Date().toISOString());
  translationCache.clear();
  const raw = [];
  const batchSize = 5;

  for (let i = 0; i < sources.length; i += batchSize) {
    const batch = sources.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(s => s.type === 'hn' ? collectHN(s) : s.type === 'reddit' ? collectReddit(s) : collectRSS(s))
    );
    for (const r of results) { if (r.status === 'fulfilled') raw.push(...r.value); }
  }
  console.log('[Collector] Raw: ' + raw.length);

  // Deduplicate
  const seen = new Map();
  const unique = [];
  for (const item of raw) {
    const key = item.link || item.title;
    if (seen.has(key)) continue;
    let dup = false;
    for (const [k] of seen) { if (similar(item.title, k)) { dup = true; break; } }
    if (!dup) { seen.set(key, true); unique.push(item); }
  }
  console.log('[Collector] Unique: ' + unique.length);

  // Filter new items
  const newItems = [];
  for (const item of unique) {
    if (item.link) {
      const row = db.prepare('SELECT id FROM items WHERE link = ?').get(item.link);
      if (row) continue;
    }
    newItems.push(item);
  }
  console.log('[Collector] New: ' + newItems.length);

  // Fetch full content + translate (max 120 per cycle)
  const saved = [];
  for (let i = 0; i < newItems.length && i < 120; i++) {
    const item = newItems[i];
    // Fetch full content
    const { content, image } = await fetchFullContent(item.link);
    item.content = content;
    item.image_url = image || '';

    // Translate title + summary + content for non-Chinese items
    if (item.lang && item.lang !== 'zh') {
      // Translate title
      if (!isChinese(item.title)) {
        try {
          const t = await translateToZh(item.title);
          if (t && t !== item.title) item.title = t;
        } catch {}
      }
      // Translate summary
      if (item.summary && !isChinese(item.summary)) {
        try {
          await new Promise(r => setTimeout(r, 400)); // Rate limit
          const s = await translateToZh(item.summary);
          if (s && s !== item.summary) item.summary = s;
        } catch {}
      }
      // Translate content (up to 3000 chars)
      if (item.content && item.content.length > 20 && !isChinese(item.content.slice(0, 500))) {
        try {
          await new Promise(r => setTimeout(r, 500)); // Rate limit
          const c = await translateToZh(item.content.slice(0, 3000));
          if (c && c !== item.content) item.content = c;
        } catch {}
      }
    }

    // Mark as Chinese after translation
    if (item.lang !== 'zh') item.lang = 'zh';

    item.score = item.score || scoreItem(item);
    item.collected_at = new Date().toISOString();
    item.tags = '[]';

    try {
      const r = stmts.insertItem.run(item);
      if (r.changes > 0) saved.push(item);
    } catch (e) {
      if (i < 3) console.error('[DEBUG] Insert error:', e.message);
    }
  }

  db.prepare('UPDATE items SET is_curated = 1 WHERE score >= 60 AND is_curated = 0').run();
  console.log('[Collector] Saved: ' + saved.length);
  return { total: raw.length, unique: unique.length, newItems: saved };
}

// Background translation: translate untranslated content in batches
async function translateUntranslatedContent() {
  // Find items with non-Chinese content
  const items = db.prepare(
    "SELECT id, title, summary, content FROM items WHERE lang != 'zh' AND length(content) > 50 LIMIT 50"
  ).all();

  const untranslated = items.filter(it => it.content && !isChinese(it.content.slice(0, 300)));
  if (!untranslated.length) return console.log('[Translate] All content is Chinese already');
  console.log('[Translate] Translating ' + untranslated.length + ' articles...');

  let count = 0;
  for (const item of untranslated) {
    try {
      // Translate full content (split into chunks if needed)
      const fullText = item.content.slice(0, 3000);
      const c = await translateToZh(fullText);
      if (c && c.length > 10 && c !== fullText) {
        // Append remaining untranslated part if any
        const rest = item.content.length > 3000 ? '\n\n' + item.content.slice(3000) : '';
        db.prepare('UPDATE items SET content = ?, lang = ? WHERE id = ?').run(c + rest, 'zh', item.id);
        count++;
      }
      // Also translate title if still English
      if (!isChinese(item.title)) {
        await new Promise(r => setTimeout(r, 400));
        const t = await translateToZh(item.title);
        if (t && t !== item.title) {
          db.prepare('UPDATE items SET title = ? WHERE id = ?').run(t, item.id);
        }
      }
      // Also translate summary if still English
      if (item.summary && !isChinese(item.summary)) {
        await new Promise(r => setTimeout(r, 400));
        const s = await translateToZh(item.summary);
        if (s && s !== item.summary) {
          db.prepare('UPDATE items SET summary = ? WHERE id = ?').run(s, item.id);
        }
      }
      await new Promise(r => setTimeout(r, 500)); // Rate limit between items
    } catch (e) {
      console.error('[Translate] Item ' + item.id + ' error:', e.message);
    }
  }
  console.log('[Translate] Done: ' + count + '/' + untranslated.length + ' translated');
}

module.exports = { collectAll, translateUntranslatedContent, translateToZh, isChinese };
