const express = require('express');
const path = require('path');
const cron = require('node-cron');
const { db, stmts } = require('./db');
const { collectAll } = require('./collector');
const http = require('http');
const { WebSocketServer } = require('ws');

const app = express();
const PORT = process.env.PORT || 3456;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── API: 条目列表 ──
app.get('/api/items', (req, res) => {
  const { mode = 'all', category, q, page = 1, limit = 30 } = req.query;
  const p = Math.max(1, parseInt(page));
  const l = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (p - 1) * l;

  let where = [];
  let params = [];

  if (mode === 'curated') where.push('is_curated = 1');
  if (mode === 'hot') { where.push('score > 60'); }

  if (category) { where.push('category = ?'); params.push(category); }
  if (q) { where.push('(title LIKE ? OR summary LIKE ?)'); params.push('%' + q + '%', '%' + q + '%'); }

  const wc = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = db.prepare('SELECT COUNT(*) as cnt FROM items ' + wc).get(...params).cnt;
  const items = db.prepare('SELECT id, title, summary, source, category, lang, image_url, published_at, score, is_curated, source_count FROM items ' + wc + ' ORDER BY score DESC, published_at DESC LIMIT ? OFFSET ?').all(...params, l, offset);

  res.json({ items, total, page: p, limit: l, pages: Math.ceil(total / l) });
});

// ── API: 单条详情（站内阅读） ──
app.get('/api/items/:id', (req, res) => {
  const item = stmts.getById.get(parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: 'Not found' });

  // 查找相关条目（同 category 近似标题）
  const related = db.prepare(
    `SELECT id, title, source, published_at FROM items WHERE id != ? AND category = ? ORDER BY published_at DESC LIMIT 10`
  ).all(item.id, item.category);

  res.json({ item, related });
});

// ── API: 热门 ──
app.get('/api/hot', (req, res) => {
  const items = db.prepare('SELECT id, title, summary, source, category, published_at, score FROM items WHERE score >= 60 ORDER BY score DESC LIMIT 20').all();
  res.json({ items });
});

// ── API: 统计 ──
app.get('/api/stats', (req, res) => {
  const total = stmts.countItems.get().cnt;
  const today = stmts.countToday.get().cnt;
  const sourcesCount = db.prepare('SELECT COUNT(*) as cnt FROM sources WHERE enabled = 1').get().cnt;
  const categories = db.prepare('SELECT category, COUNT(*) as cnt FROM items GROUP BY category ORDER BY cnt DESC').all();
  res.json({ total, today, sources: sourcesCount, categories });
});

// ── API: 分类列表 ──
app.get('/api/categories', (req, res) => {
  const cats = db.prepare('SELECT category, COUNT(*) as cnt FROM items GROUP BY category ORDER BY cnt DESC').all();
  res.json({ categories: cats });
});

// ── API: 手动触发采集 ──
app.post('/api/collect', async (req, res) => {
  try {
    const result = await collectAll();
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── RSS Feed ──
function buildRSS(title, desc, items) {
  const esc = s => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n<channel>\n<title>${esc(title)}</title>\n<description>${esc(desc)}</description>\n`;
  for (const it of items) {
    xml += `<item><title>${esc(it.title)}</title><link>${esc(it.link)}</link><description>${esc(it.summary)}</description>`;
    if (it.published_at) xml += `<pubDate>${new Date(it.published_at).toUTCString()}</pubDate>`;
    xml += `<category>${esc(it.category)}</category></item>\n`;
  }
  xml += '</channel>\n</rss>';
  return xml;
}

app.get('/feed.xml', (req, res) => {
  const items = db.prepare('SELECT * FROM items WHERE is_curated=1 ORDER BY score DESC LIMIT 50').all();
  res.type('application/rss+xml').send(buildRSS('全球热点 - 精选', 'Curated global hot news', items));
});
app.get('/feed/all.xml', (req, res) => {
  const items = db.prepare('SELECT * FROM items ORDER BY published_at DESC LIMIT 100').all();
  res.type('application/rss+xml').send(buildRSS('全球热点 - 全部', 'All news', items));
});
app.get('/feed/daily.xml', (req, res) => {
  const items = db.prepare("SELECT * FROM items WHERE collected_at>=date('now') ORDER BY score DESC LIMIT 50").all();
  res.type('application/rss+xml').send(buildRSS('全球热点 - 日报', 'Daily digest', items));
});

// ── SPA fallback ──
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── WebSocket + Cron ──
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('[WS] Client connected');
  ws.on('close', () => console.log('[WS] Client disconnected'));
});

global._wss = wss;

cron.schedule('*/5 * * * *', () => {
  console.log('[Cron] Collecting...');
  collectAll().then(result => {
    if (result?.newItems?.length > 0) {
      const payload = JSON.stringify({ type: 'new_items', items: result.newItems.map(i => ({ id: i.id, title: i.title, source: i.source, category: i.category, score: i.score })) });
      wss.clients.forEach(c => { if (c.readyState === 1) c.send(payload); });
      console.log(`[WS] Pushed ${result.newItems.length} new items`);
    }
  }).catch(e => console.error('[Cron]', e));
});

server.listen(PORT, () => {
  console.log(`Global Hot News running on http://localhost:${PORT}`);
  collectAll().catch(e => console.error('[Startup]', e));
});
