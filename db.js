const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'data.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec("CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, title TEXT NOT NULL, link TEXT NOT NULL, summary TEXT DEFAULT '', source_name TEXT NOT NULL, source_type TEXT NOT NULL DEFAULT 'rss', category TEXT DEFAULT 'uncategorized', published_at TEXT, collected_at TEXT NOT NULL, score REAL DEFAULT 0, source_count INTEGER DEFAULT 1, is_curated INTEGER DEFAULT 0, dup_group TEXT DEFAULT '')");
db.exec("CREATE INDEX IF NOT EXISTS idx_items_published ON items(published_at DESC)");
db.exec("CREATE INDEX IF NOT EXISTS idx_items_score ON items(score DESC)");
db.exec("CREATE INDEX IF NOT EXISTS idx_items_category ON items(category)");
db.exec("CREATE INDEX IF NOT EXISTS idx_items_dup ON items(dup_group)");
db.exec("CREATE TABLE IF NOT EXISTS sources (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, type TEXT NOT NULL DEFAULT 'rss', url TEXT NOT NULL, enabled INTEGER DEFAULT 1, last_fetched TEXT, interval_min INTEGER DEFAULT 15)");
db.exec("CREATE TABLE IF NOT EXISTS daily_digests (date TEXT PRIMARY KEY, title TEXT NOT NULL, summary TEXT DEFAULT '', items_json TEXT DEFAULT '[]', created_at TEXT NOT NULL)");
module.exports = db;
