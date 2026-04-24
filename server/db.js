const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'treehole.db');

const db = new Database(DB_PATH);

// 启用 WAL 模式提升并发性能
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// 创建表
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    vein_id     TEXT UNIQUE NOT NULL,
    nickname    TEXT,
    avatar_style TEXT DEFAULT 'emoji',
    avatar_emoji TEXT,
    avatar_color TEXT,
    mbti        TEXT,
    role        TEXT,
    bio         TEXT,
    show_vein_id INTEGER DEFAULT 1,
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS posts (
    id          TEXT PRIMARY KEY,
    author_id   TEXT NOT NULL REFERENCES users(id),
    show_vein   INTEGER DEFAULT 1,
    title       TEXT,
    content     TEXT NOT NULL,
    channel     TEXT DEFAULT 'default',
    tags        TEXT DEFAULT '[]',
    mood        TEXT,
    image       TEXT,
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id          TEXT PRIMARY KEY,
    from_id     TEXT NOT NULL REFERENCES users(id),
    to_id       TEXT NOT NULL REFERENCES users(id),
    content     TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    read        INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS letters (
    id          TEXT PRIMARY KEY,
    from_id     TEXT NOT NULL REFERENCES users(id),
    to_id       TEXT NOT NULL REFERENCES users(id),
    content     TEXT NOT NULL,
    written_at  TEXT NOT NULL,
    open_at     TEXT,
    opened      INTEGER DEFAULT 0
  );
`);

module.exports = db;
