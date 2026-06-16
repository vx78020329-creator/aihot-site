const express = require('express');
const path = require('path');
const cron = require('node-cron');
const db = require('./db');
const { collectAll } = require('./collector');
const http = require('http');
const { WebSocketServer } = require('ws');

const app = express();
const PORT = process.env.PORT || 3456;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- API: Items ---
app.get('/api/items', (req, res) => {
  const { mode = 'all', category, q, page = 1, limit = 30 } = req.query;
  const p = Math.max(1, parseInt(page));
  const l = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (p - 1) * l;

  let where = [];
  let params = [];

  if (mode === 'curated') {
    where.push('is_curated = 1');
  } else if (mode === 'hot') {
    where.push('score > 0');
    where.push('source_count > 1');
  }

  if (category) {
    where.push('category = ?');
    params.push(category);
  }
  if (q) {
    where.push('(title LIKE ? OR summary LIKE ?)');
    params.push('%' + q + '%', '%' + q + '%');
  }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const totalRow = db.prepare('SELECT COUNT(*) as cnt FROM items ' + whereClause).get(...params);
  const items = db.prepare('SELECT * FROM items ' + whereClause + ' ORDER BY score DESC, published_at DESC LIMIT ? OFFSET ?').all(...params, l, offset);

  res.json({ items, total: totalRow.cnt, page: p, limit: l, pages: Math.ceil(totalRow.cnt / l) });
});

// --- API: Hot ---
app.get('/api/hot', (req, res) => {
  const items = db.prepare('SELECT * FROM items WHERE source_count > 1 ORDER BY score DESC LIMIT 20').all();
  res.json({ items });
});

// --- API: Stats ---
app.get('/api/stats', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as cnt FROM items').get().cnt;
  const today = db.prepare("SELECT COUNT(*) as cnt FROM items WHERE collected_at >= date('now')").get().cnt;
  const sourcesCount = db.prepare('SELECT COUNT(*) as cnt FROM sources WHERE enabled = 1').get().cnt;
  const categories = db.prepare('SELECT category, COUNT(*) as cnt FROM items GROUP BY category ORDER BY cnt DESC').all();
  res.json({ total, today, sources: sourcesCount, categories });
});

// --- API: Collect ---
app.post('/api/collect', async (req, res) => {
  try {
    const result = await collectAll();
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// --- RSS Feed helper ---
function buildRSS(title, description, items) {
  const esc = s => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n<channel>\n';
  xml += '<title>' + esc(title) + '</title>\n';
  xml += '<link>http://localhost:' + PORT + '</link>\n';
  xml += '<description>' + esc(description) + '</description>\n';
  for (const item of items) {
    xml += '<item>\n';
    xml += '  <title>' + esc(item.title) + '</title>\n';
    xml += '  <link>' + esc(item.link) + '</link>\n';
    xml += '  <description>' + esc(item.summary) + '</description>\n';
    if (item.published_at) xml += '  <pubDate>' + new Date(item.published_at).toUTCString() + '</pubDate>\n';
    xml += '  <category>' + esc(item.category) + '</category>\n';
    xml += '</item>\n';
  }
  xml += '</channel>\n</rss>';
  return xml;
}

app.get('/feed.xml', (req, res) => {
  const items = db.prepare('SELECT * FROM items WHERE is_curated = 1 ORDER BY score DESC LIMIT 50').all();
  res.type('application/rss+xml').send(buildRSS('AI热点 - 精�?, 'AI curated news feed', items));
});

app.get('/feed/all.xml', (req, res) => {
  const items = db.prepare('SELECT * FROM items ORDER BY published_at DESC LIMIT 100').all();
  res.type('application/rss+xml').send(buildRSS('AI热点 - 全部', 'All AI news', items));
});

app.get('/feed/daily.xml', (req, res) => {
  const items = db.prepare("SELECT * FROM items WHERE collected_at >= date('now') ORDER BY score DESC LIMIT 50").all();
  res.type('application/rss+xml').send(buildRSS('AI热点 - 每日', 'Daily AI news digest', items));
});

// --- SPA fallback ---
app.use( (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('[WS] Client connected');
  ws.on('close', () => console.log('[WS] Client disconnected'));
});

// Make wss available globally for collector to push
global._wss = wss;

// --- Cron: every 5 min ---
cron.schedule('*/5 * * * *', () => {
  console.log('[Cron] Collecting...');
  collectAll().then(result => {
    if (result && result.newItems && result.newItems.length > 0) {
      const payload = JSON.stringify({ type: 'new_items', items: result.newItems });
      wss.clients.forEach(client => {
        if (client.readyState === 1) client.send(payload);
      });
      console.log('[WS] Pushed ' + result.newItems.length + ' new items to ' + wss.clients.size + ' clients');
    }
  }).catch(e => console.error('[Cron]', e));
});

server.listen(PORT, () => {
  console.log('AIHot running on http://localhost:' + PORT);
  console.log('WebSocket on ws://localhost:' + PORT);
  collectAll().catch(e => console.error('[Startup collect]', e));
});
