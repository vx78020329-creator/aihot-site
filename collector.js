const db = require('./db');
const sources = require('./sources');
const RSSParser = require('rss-parser');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
// Using MyMemory API for translation (free, works in China)

const parser = new RSSParser({ timeout: 15000, headers: { 'User-Agent': 'AIHot/1.0' } });

function normalize(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
}

function similarity(a, b) {
  if (!a || !b) return 0;
  const freqA = {}, freqB = {};
  for (const c of a) freqA[c] = (freqA[c] || 0) + 1;
  for (const c of b) freqB[c] = (freqB[c] || 0) + 1;
  let overlap = 0;
  for (const c in freqA) {
    if (freqB[c]) overlap += Math.min(freqA[c], freqB[c]);
  }
  return overlap / Math.max(a.length, b.length);
}

function makeId(title, link) {
  return crypto.createHash('md5').update((title || '') + (link || '')).digest('hex');
}

function detectCategory(text) {
  const t = (text || '').toLowerCase();
  if (/paper|arxiv|study|research|论文|研究|benchmark|preprint/.test(t)) return '论文';
  if (/model|gpt|llm|claude|gemini|llama|mistral|模型|大模型|transformer|diffusion|qwen/.test(t)) return '模型';
  if (/company|startup|funding|acquisition|industry|公司|融资|行业|收购|估值/.test(t)) return '行业';
  if (/tutorial|how.to|guide|tips|教程|技巧|实践|入门|实战/.test(t)) return '技巧';
  if (/product|launch|release|app|api|tool|产品|发布|上线|开源/.test(t)) return '产品';
  return '产品';
}

function timeDecay(publishedAt) {
  if (!publishedAt) return 0.5;
  const hours = (Date.now() - new Date(publishedAt).getTime()) / 3600000;
  if (hours < 0) return 1;
  return Math.exp(-hours / 72);
}

function fetchUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'AIHot/1.0', ...options.headers }, timeout: 15000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location, options).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function collectRSS(feedList) {
  const items = [];
  for (const feed of feedList) {
    try {
      const parsed = await parser.parseURL(feed.url);
      for (const item of (parsed.items || [])) {
        items.push({
          title: (item.title || '').trim(),
          link: item.link || '',
          summary: (item.contentSnippet || item.content || item.summary || '').substring(0, 500).replace(/<[^>]+>/g, '').trim(),
          source_name: feed.name,
          source_type: 'rss',
          published_at: item.isoDate || item.pubDate || null
        });
      }
      db.prepare('UPDATE sources SET last_fetched = ? WHERE name = ?').run(new Date().toISOString(), feed.name);
    } catch (e) {
      console.error('[RSS] ' + feed.name + ': ' + e.message);
    }
  }
  return items;
}

async function collectHN() {
  const cfg = sources.hackernews;
  if (!cfg.enabled) return [];
  const items = [];
  try {
    const topIds = JSON.parse(await fetchUrl('https://hacker-news.firebaseio.com/v0/topstories.json'));
    const topN = topIds.slice(0, cfg.top_n);
    const results = await Promise.allSettled(topN.map(id => fetchUrl('https://hacker-news.firebaseio.com/v0/item/' + id + '.json')));
    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      const item = JSON.parse(r.value);
      if (!item || !item.title) continue;
      const titleLower = item.title.toLowerCase();
      const hasKeyword = cfg.keywords.some(kw => titleLower.includes(kw));
      if (!hasKeyword && (item.score || 0) < cfg.min_score) continue;
      items.push({
        title: item.title.trim(),
        link: item.url || 'https://news.ycombinator.com/item?id=' + item.id,
        summary: item.text ? item.text.substring(0, 500).replace(/<[^>]+>/g, '').trim() : '',
        source_name: 'Hacker News',
        source_type: 'hn',
        published_at: item.time ? new Date(item.time * 1000).toISOString() : null
      });
    }
  } catch (e) {
    console.error('[HN] ' + e.message);
  }
  return items;
}

async function collectReddit() {
  const items = [];
  for (const sub of sources.reddit) {
    if (!sub.enabled) continue;
    try {
      const url = 'https://www.reddit.com/r/' + sub.name + '/hot.json?limit=' + (sub.limit || 25);
      const data = JSON.parse(await fetchUrl(url, { headers: { 'User-Agent': 'AIHot/1.0' } }));
      for (const child of (data && data.data && data.data.children || [])) {
        const post = child.data;
        if (post.stickied) continue;
        items.push({
          title: (post.title || '').trim(),
          link: post.url || 'https://reddit.com' + post.permalink,
          summary: (post.selftext || '').substring(0, 500).trim(),
          source_name: 'r/' + sub.name,
          source_type: 'reddit',
          published_at: post.created_utc ? new Date(post.created_utc * 1000).toISOString() : null
        });
      }
    } catch (e) {
      console.error('[Reddit] r/' + sub.name + ': ' + e.message);
    }
  }
  return items;
}

async function collectArxiv() {
  const cfg = sources.arxiv;
  if (!cfg.enabled) return [];
  const items = [];
  try {
    const catQuery = cfg.categories.map(c => 'cat:' + c).join('+OR+');
    const url = 'http://export.arxiv.org/api/query?search_query=' + catQuery + '&sortBy=submittedDate&sortOrder=descending&max_results=' + cfg.max_results;
    const xml = await fetchUrl(url);
    const entries = xml.split('<entry>').slice(1);
    for (const entry of entries) {
      const title = (entry.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
      const link = (entry.match(/<id>([\s\S]*?)<\/id>/) || [])[1] || '';
      const summary = (entry.match(/<summary>([\s\S]*?)<\/summary>/) || [])[1] || '';
      const published = (entry.match(/<published>([\s\S]*?)<\/published>/) || [])[1] || '';
      const cleanTitle = title.replace(/\s+/g, ' ').trim();
      if (!cleanTitle) continue;
      items.push({
        title: cleanTitle,
        link: (link || '').trim(),
        summary: summary.replace(/\s+/g, ' ').trim().substring(0, 500),
        source_name: 'arXiv',
        source_type: 'arxiv',
        published_at: (published || '').trim() || null
      });
    }
  } catch (e) {
    console.error('[arXiv] ' + e.message);
  }
  return items;
}

 async function collectGitHub() {
  const cfg = sources.github;
  if (!cfg || !cfg.enabled) return [];
  const items = [];
  try {
    const data = JSON.parse(await fetchUrl(cfg.trending_url));
    for (const repo of (data.items || [])) {
      items.push({
        title: repo.full_name + ': ' + (repo.description || '').substring(0, 100),
        link: repo.html_url,
        summary: '? ' + repo.stargazers_count + ' stars · ' + (repo.description || ''),
        source_name: 'GitHub Trending',
        source_type: 'github',
        published_at: repo.updated_at
      });
    }
  } catch (e) {
    console.error('[GitHub] ' + e.message);
  }
  return items;
}
function isEnglish(text) {
  if (!text) return false;
  const asciiChars = text.replace(/[^\x00-\x7F]/g, '').length;
  return asciiChars / text.length > 0.5;
}

async function translateToZh(text) {
  if (!text || !isEnglish(text)) return text;
  try {
    const encoded = encodeURIComponent(text.substring(0, 500));
    const url = 'https://api.mymemory.translated.net/get?q=' + encoded + '&langpair=en|zh-CN';
    const res = await fetch(url);
    const data = await res.json();
    if (data.responseStatus === 200 && data.responseData && data.responseData.translatedText) {
      return data.responseData.translatedText;
    }
    return text;
  } catch (e) {
    return text;
  }
}

async function translateItems(items) {
  const engItems = items.filter(i => isEnglish(i.title));
  console.log('[Translate] ' + engItems.length + ' English items to translate');
  for (let i = 0; i < engItems.length; i++) {
    const item = engItems[i];
    item.title = await translateToZh(item.title);
    if (item.summary) {
      item.summary = await translateToZh(item.summary);
    }
    if ((i + 1) % 20 === 0) {
      console.log('[Translate] Progress: ' + (i + 1) + '/' + engItems.length);
    }
  }
  console.log('[Translate] Done');
}
async function collectAll() {
  console.log('[Collector] Starting at ' + new Date().toISOString());
  const allItems = [];

  const rssFeeds = [...sources.rss_en, ...sources.rss_cn, ...sources.rss_blogs];
  for (const feed of rssFeeds) {
    db.prepare('INSERT OR IGNORE INTO sources (name, type, url) VALUES (?, ?, ?)').run(feed.name, 'rss', feed.url);
  }

  const [rss, hn, reddit, arxiv, github] = await Promise.all([
    collectRSS(rssFeeds),
    collectHN(),
    collectReddit(),
    collectArxiv(),
    collectGitHub()
  ]);

  allItems.push(...rss, ...hn, ...reddit, ...arxiv, ...github);
  console.log('[Collector] Raw: ' + allItems.length);

  const unique = [];
  const normTitles = [];
  for (const item of allItems) {
    if (!item.title || !item.link) continue;
    const norm = normalize(item.title);
    if (norm.length < 3) continue;
    let isDup = false;
    for (let i = 0; i < normTitles.length; i++) {
      if (similarity(norm, normTitles[i]) > 0.7) {
        unique[i].source_count = (unique[i].source_count || 1) + 1;
        isDup = true;
        break;
      }
    }
    if (!isDup) {
      item.source_count = 1;
      normTitles.push(norm);
      unique.push(item);
    }
  }
  console.log('[Collector] Unique: ' + unique.length);

  await translateItems(unique);

  for (const item of unique) {
    item.category = detectCategory(item.title + ' ' + (item.summary || ''));
    item.score = (item.source_count || 1) * 10 * timeDecay(item.published_at);
    item.id = makeId(item.title, item.link);
    item.dup_group = item.source_count > 1 ? item.id : '';
  }

  unique.sort((a, b) => b.score - a.score);
  const curatedIds = new Set(unique.slice(0, 50).map(i => i.id));

  // Track which items are new (not previously in DB)
  const existingIds = new Set(
    db.prepare('SELECT id FROM items').all().map(r => r.id)
  );

  const insert = db.prepare('INSERT OR REPLACE INTO items (id, title, link, summary, source_name, source_type, category, published_at, collected_at, score, source_count, is_curated, dup_group) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const tx = db.transaction(() => {
    for (const item of unique) {
      insert.run(item.id, item.title, item.link, item.summary || '', item.source_name, item.source_type || 'rss', item.category, item.published_at, new Date().toISOString(), item.score, item.source_count || 1, curatedIds.has(item.id) ? 1 : 0, item.dup_group || '');
    }
  });
  tx();

  const newItems = unique.filter(i => !existingIds.has(i.id)).map(i => ({
    id: i.id, title: i.title, link: i.link, summary: i.summary,
    source_name: i.source_name, source_type: i.source_type,
    category: i.category, published_at: i.published_at,
    score: i.score, source_count: i.source_count
  }));

  console.log('[Collector] Saved ' + unique.length + ', curated ' + curatedIds.size + ', new ' + newItems.length);
  return { total: allItems.length, unique: unique.length, curated: curatedIds.size, newItems };
}

module.exports = { collectAll };
