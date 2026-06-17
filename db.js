const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    link        TEXT UNIQUE,
    title       TEXT NOT NULL,
    summary     TEXT DEFAULT '',
    content     TEXT DEFAULT '',
    source      TEXT DEFAULT '',
    category    TEXT DEFAULT '综合',
    lang        TEXT DEFAULT 'en',
    image_url   TEXT DEFAULT '',
    published_at TEXT DEFAULT '',
    collected_at TEXT DEFAULT '',
    score       INTEGER DEFAULT 0,
    is_curated  INTEGER DEFAULT 0,
    reason      TEXT DEFAULT '',
    tags        TEXT DEFAULT '[]',
    source_count INTEGER DEFAULT 1
  );
  CREATE INDEX IF NOT EXISTS idx_items_score ON items(score DESC);
  CREATE INDEX IF NOT EXISTS idx_items_published ON items(published_at DESC);
  CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);

  CREATE TABLE IF NOT EXISTS sources (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT UNIQUE,
    url       TEXT DEFAULT '',
    type      TEXT DEFAULT 'rss',
    category  TEXT DEFAULT '综合',
    lang      TEXT DEFAULT 'en',
    enabled   INTEGER DEFAULT 1,
    last_fetch TEXT DEFAULT ''
  );
`);

const stmts = {
  insertItem: db.prepare(`
    INSERT OR IGNORE INTO items (link, title, summary, content, source, category, lang, image_url, published_at, collected_at, score, tags)
    VALUES (@link, @title, @summary, @content, @source, @category, @lang, @image_url, @published_at, @collected_at, @score, @tags)
  `),
  getById: db.prepare('SELECT * FROM items WHERE id = ?'),
  countItems: db.prepare('SELECT COUNT(*) as cnt FROM items'),
  countToday: db.prepare("SELECT COUNT(*) as cnt FROM items WHERE collected_at >= date('now')"),
};

// 初始化源表
const sources = require('./sources');
const upsert = db.prepare(`INSERT OR REPLACE INTO sources (name, url, type, category, lang, enabled) VALUES (@name, @url, @type, @category, @lang, 1)`);
const upsertMany = db.transaction((list) => {
  for (const s of list) {
    upsert.run({
      name: s.name,
      url: s.url || '',
      type: s.type || 'rss',
      category: s.category || '综合',
      lang: s.lang || 'en',
    });
  }
});
upsertMany(sources);

module.exports = { db, stmts };
