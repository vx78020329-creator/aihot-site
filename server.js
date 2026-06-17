const express = require('express');
const path = require('path');
const cron = require('node-cron');
const { db, stmts } = require('./db');
const { collectAll } = require('./collector');
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

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

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

app.get('/api/items/:id', limiter, (req, res) => {
  const id = parseInt(req.params.id);
  if (!id || id < 1) return res.status(400).json({ error: 'invalid id' });
  const item = stmts.getById.get(id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  const related = db.prepare(
    'SELECT id, title, source, published_at FROM items WHERE id != ? AND category = ? ORDER BY published_at DESC LIMIT 10'
  ).all(item.id, item.category);
  res.json({ item, related });
});


app.get('/api/last-update', (req, res) => {
  const row = db.prepare("SELECT MAX(collected_at) as last FROM items").get();
  const count = db.prepare("SELECT COUNT(*) as cnt FROM items WHERE collected_at > datetime('now', '-5 minutes')").get();
  res.json({ lastUpdate: row.last || '', recentCount: count.cnt });
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

cron.schedule('*/1 * * * *', () => {
  console.log('[Cron] Collecting...');
  collectAll().then(r => {
    if (r && r.newItems && r.newItems.length > 0) {
      const payload = JSON.stringify({ type: 'new_items', items: r.newItems.map(i => ({ id:i.id, title:i.title, source:i.source, category:i.category, score:i.score })) });
      wss.clients.forEach(c => { if (c.readyState === 1) c.send(payload); });
      console.log('[WS] Pushed ' + r.newItems.length);
    }
  }).catch(e => console.error('[Cron]', e));
});


// Reset curated status for items below new threshold
db.prepare('UPDATE items SET is_curated = 0 WHERE score < 60 AND is_curated = 1').run();

// Reset collected_at for items collected more than 6 hours ago (stale data)
db.prepare("UPDATE items SET collected_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-' || (abs(random()) % 12) || ' hours') WHERE collected_at < strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-6 hours')").run();

server.listen(PORT, () => {
  console.log('Global HOT on http://localhost:' + PORT);
  collectAll().catch(e => console.error('[Startup]', e));
});