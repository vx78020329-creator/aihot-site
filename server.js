const express = require('express');
const path = require('path');
const cron = require('node-cron');
const { db, stmts } = require('./db');
const { collectAll, translateUntranslatedContent, isChinese } = require('./collector');
const http = require('http');
const { WebSocketServer } = require('ws');

const app = express();
const PORT = process.env.PORT || 3456;

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; img-src 'self' data: https: *; style-src 'self' 'unsafe-inline' https: *; script-src 'self' 'unsafe-inline'; font-src 'self' data: https: *; connect-src 'self' ws: wss: https: *");
  next();
});

// Ensure UTF-8 charset on API responses only
app.use('/api', (req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});


app.use(express.json());
// Serve index.html with no-cache to prevent stale Content-Type in WeChat/WebView
app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));


// Generate summary + impact analysis from article content
function generateSummaryAndImpact(item) {
  const content = item.content || item.summary || '';
  const title = item.title || '';
  
  // Extract summary: first 2-3 meaningful sentences
  const sentences = content.split(/[。！？.!?]+/).filter(s => s.trim().length > 10);
  const summary = sentences.slice(0, 3).join('。').trim() + (sentences.length > 3 ? '...' : '');
  
  // Generate impact based on category and keywords
  const impacts = {
    '科技': '该技术进展可能改变行业格局，影响相关产业链发展方向。',
    'AI': '人工智能领域的突破将加速各行业智能化转型，带来效率提升和新应用场景。',
    '商业': '商业动态反映市场趋势变化，可能影响投资决策和竞争格局。',
    '科学': '科学研究成果推动人类认知边界扩展，为技术应用奠定理论基础。',
    '世界': '国际事件影响全球政治经济格局，值得持续关注。',
    '开发': '开发者工具和框架的更新将影响技术选型和开发效率。',
    '产品': '产品创新推动用户体验升级，可能引领行业新方向。'
  };
  
  // Detect specific impact keywords
  const impactKeywords = {
    '突破': '这一突破性进展将推动相关领域快速发展。',
    '威胁': '需要关注潜在风险，行业应提前做好应对准备。',
    '合作': '合作趋势表明行业正在走向融合，有利于生态建设。',
    '增长': '增长态势强劲，市场前景看好。',
    '下降': '市场出现调整信号，需谨慎评估风险。'
  };
  
  let impact = impacts[item.category] || '该资讯反映了行业最新动态，值得深入了解。';
  for (const [keyword, impactText] of Object.entries(impactKeywords)) {
    if (title.includes(keyword) || content.includes(keyword)) {
      impact = impactText;
      break;
    }
  }
  
  return { summary: summary.substring(0, 200), impact };
}

const rateLimit = {};
function limiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  if (!rateLimit[ip] || now - rateLimit[ip] > 60000) { rateLimit[ip] = now; return next(); }
  if (now - rateLimit[ip] < 1000) return res.status(429).json({ error: 'too many requests' });
  rateLimit[ip] = now;
  next();
}

app.get('/api/items', limiter, (req, res) => {
  const { mode = 'all', category, q, page = 1, limit = 30 } = req.query;
  const p = Math.max(1, parseInt(page));
  const l = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (p - 1) * l;
  let where = [], params = [];
  if (mode === 'curated') where.push('is_curated = 1');
  if (mode === 'hot') where.push('score > 60');
  if (category) { where.push('category = ?'); params.push(category); }
  if (q) { where.push('(title LIKE ? OR summary LIKE ?)'); params.push('%'+q+'%', '%'+q+'%'); }
  const wc = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = db.prepare('SELECT COUNT(*) as cnt FROM items ' + wc).get(...params).cnt;
  const items = db.prepare(
    'SELECT id, title, summary, content, source, category, lang, image_url, published_at, collected_at, score, is_curated, source_count FROM items ' + wc + ' ORDER BY score DESC, published_at DESC LIMIT ? OFFSET ?'
  ).all(...params, l, offset);
  res.json({ items, total, page: p, limit: l, pages: Math.ceil(total / l) });
});

app.get('/api/items/:id', limiter, async (req, res) => {
    const id = parseInt(req.params.id);
    if (!id || id < 1) return res.status(400).json({ error: 'invalid id' });
    const item = stmts.getById.get(id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    // On-demand translate English content to Chinese (Railway server can access Google)
    if (item.lang && item.lang !== 'zh' && item.content && item.content.length > 20 && !isChinese(item.content.slice(0, 500))) {
      try {
        const { translateToZh } = require('./collector');
        // Split content into paragraphs and translate in batches
        const paragraphs = item.content.split(/\n{2,}/);
        const translatedParts = [];
        for (let pi = 0; pi < paragraphs.length; pi += 3) {
          const batch = paragraphs.slice(pi, pi + 3).join('\n\n');
          if (batch.length < 5) { translatedParts.push(batch); continue; }
          const t = await translateToZh(batch);
          translatedParts.push(t || batch);
        }
        const newContent = translatedParts.join('\n\n');
        if (newContent && newContent.length > 10) {
          item.content = newContent;
          try { db.prepare('UPDATE items SET content = ? WHERE id = ?').run(item.content, id); } catch {}
        }
      } catch (e) { console.error('[API Translate]', e.message); }
    }
    const related = db.prepare(
      'SELECT id, title, source, published_at FROM items WHERE id != ? AND category = ? ORDER BY published_at DESC LIMIT 10'
    ).all(item.id, item.category);
    const { summary, impact } = generateSummaryAndImpact(item);
      item.summary_analysis = summary;
      item.impact = impact;
      res.json({ item, related });
    });


app.get('/api/last-update', (req, res) => {
  const row = db.prepare("SELECT MAX(collected_at) as last FROM items").get();
  const count5m = db.prepare("SELECT COUNT(*) as cnt FROM items WHERE collected_at > datetime('now', '-5 minutes')").get();
  const count1h = db.prepare("SELECT COUNT(*) as cnt FROM items WHERE collected_at > datetime('now', '-1 hour')").get();
  const total = db.prepare("SELECT COUNT(*) as cnt FROM items").get();
  res.json({ lastUpdate: row.last || '', recentCount5m: count5m.cnt, recentCount1h: count1h.cnt, total: total.cnt, serverTime: new Date().toISOString(), collecting: isCollecting, lastCollect: lastCollectTime || '' });
});

app.get('/api/hot', (req, res) => {
  res.json({ items: db.prepare('SELECT id,title,summary,source,category,published_at,score FROM items WHERE score>=60 ORDER BY score DESC LIMIT 20').all() });
});

app.get('/api/stats', (req, res) => {
  const total = stmts.countItems.get().cnt;
  const today = stmts.countToday.get().cnt;
  const sourcesCount = db.prepare('SELECT COUNT(*) as cnt FROM sources WHERE enabled=1').get().cnt;
  const categories = db.prepare('SELECT category, COUNT(*) as cnt FROM items GROUP BY category ORDER BY cnt DESC').all();
  res.json({ total, today, sources: sourcesCount, categories });
});

app.post('/api/collect', (req, res) => {
  res.json({ ok: true, message: 'collecting in background' });
  collectAll().then(r => {
    if (r && r.newItems && r.newItems.length > 0 && global._wss) {
      const payload = JSON.stringify({ type: 'new_items', items: r.newItems.map(i => ({ id:i.id, title:i.title })) });
      global._wss.clients.forEach(c => { if (c.readyState === 1) c.send(payload); });
    }
    console.log('[Collect] Done: ' + (r ? r.newItems.length : 0) + ' new');
  }).catch(e => console.error('[Collect]', e));
});

function buildRSS(title, desc, items) {
  const esc = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n<channel>\n<title>' + esc(title) + '</title>\n<description>' + esc(desc) + '</description>\n';
  for (const it of items) {
    xml += '<item><title>' + esc(it.title) + '</title><link>' + esc(it.link) + '</link><description>' + esc(it.summary) + '</description>';
    if (it.published_at) xml += '<pubDate>' + new Date(it.published_at).toUTCString() + '</pubDate>';
    xml += '<category>' + esc(it.category) + '</category></item>\n';
  }
  return xml + '</channel>\n</rss>';
}


// Health check endpoint for keep-alive services
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), time: new Date().toISOString(), items: stmts.countItems.get().cnt, collecting: isCollecting, lastCollect: lastCollectTime || '' });
});

app.get('/api/trending', (req, res) => {
  const items = db.prepare('SELECT id, title, summary, source, category, published_at, collected_at, score, image_url FROM items WHERE score >= 50 ORDER BY score DESC, collected_at DESC LIMIT 30').all();
  res.json({ items, serverTime: new Date().toISOString() });
});

app.get('/api/status', (req, res) => {
  res.json({ collecting: isCollecting, lastCollect: lastCollectTime || '', uptime: process.uptime(), serverTime: new Date().toISOString() });
});

app.get('/feed.xml', (req, res) => {
  res.type('application/rss+xml').send(buildRSS('Global Hot - Curated','Curated', db.prepare('SELECT * FROM items WHERE is_curated=1 ORDER BY score DESC LIMIT 50').all()));
});
app.get('/feed/all.xml', (req, res) => {
  res.type('application/rss+xml').send(buildRSS('Global Hot - All','All', db.prepare('SELECT * FROM items ORDER BY published_at DESC LIMIT 100').all()));
});
app.get('/feed/daily.xml', (req, res) => {
  res.type('application/rss+xml').send(buildRSS('Global Hot - Daily','Daily', db.prepare("SELECT * FROM items WHERE collected_at>=datetime('now', '-1 day') ORDER BY score DESC LIMIT 50").all()));
});

app.use((req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
wss.on('connection', ws => {
  console.log('[WS] +1');
  ws.on('close', () => console.log('[WS] -1'));
});
global._wss = wss;

let lastCollectTime = null;
let isCollecting = false;

async function runCollect() {
  if (isCollecting) { console.log('[Cron] Skip - already collecting'); return; }
  isCollecting = true;
  const start = Date.now();
  try {
    const r = await collectAll();
    lastCollectTime = new Date().toISOString();
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log('[Cron] Done in ' + elapsed + 's, new: ' + (r ? r.newItems.length : 0));
    if (r && r.newItems && r.newItems.length > 0) {
      const payload = JSON.stringify({ type: 'new_items', count: r.newItems.length, items: r.newItems.map(i => ({ id:i.id, title:i.title, source:i.source, category:i.category, score:i.score })) });
      wss.clients.forEach(c => { if (c.readyState === 1) c.send(payload); });
    }
    // Push heartbeat so frontend knows server is alive
    const heartbeat = JSON.stringify({ type: 'heartbeat', lastCollect: lastCollectTime, newCount: r ? r.newItems.length : 0, serverTime: new Date().toISOString() });
    wss.clients.forEach(c => { if (c.readyState === 1) c.send(heartbeat); });
  } catch(e) { console.error('[Cron]', e); }
  isCollecting = false;
}

cron.schedule('*/2 * * * *', () => { runCollect(); });
cron.schedule('*/5 * * * *', () => { translateUntranslatedContent().catch(e => console.error('[Translate Cron]', e)); });


// Reset curated status for items below new threshold
db.prepare('UPDATE items SET is_curated = 0 WHERE score < 60 AND is_curated = 1').run();

// Reset collected_at for items collected more than 6 hours ago (stale data)
// [FIXED] Removed random timestamp rewriting - was causing "8h ago" for all items


// Self-ping to prevent Railway free tier from sleeping
if (process.env.RAILWAY_STATIC_URL || process.env.PORT) {
  const SELF_URL = process.env.RAILWAY_STATIC_URL || 'http://localhost:' + (process.env.PORT || 3456);
  setInterval(() => {
    fetch(SELF_URL + '/api/health').catch(() => {});
  }, 5 * 60 * 1000); // every 5 minutes
  console.log('[KeepAlive] Self-ping enabled: ' + SELF_URL);
}

server.listen(PORT, () => {
  console.log('Global HOT on http://localhost:' + PORT);
  collectAll().catch(e => console.error('[Startup]', e));
});
