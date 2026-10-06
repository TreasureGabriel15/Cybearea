import sqlite3
import time

from flask import current_app, g

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT,                       -- NULL for Google-only accounts
  google_sub    TEXT UNIQUE,
  role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  name          TEXT NOT NULL DEFAULT '',
  notes         TEXT NOT NULL DEFAULT '',
  active_spec   TEXT,
  created_at    INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,              -- sha256 of the cookie value, never the cookie itself
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS user_specs (
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  spec_id  TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (user_id, spec_id)
);
CREATE TABLE IF NOT EXISTS lesson_progress (
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  spec_id      TEXT NOT NULL,
  lesson       INTEGER NOT NULL,
  completed_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, spec_id, lesson)
);
CREATE TABLE IF NOT EXISTS quiz_scores (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  spec_id    TEXT NOT NULL,
  best       INTEGER NOT NULL,
  total      INTEGER NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, spec_id)
);
"""


def now_ms():
    return int(time.time() * 1000)


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(current_app.config["DB_PATH"])
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


def close_db(_exc=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    db = get_db()
    db.execute("PRAGMA journal_mode = WAL")
    db.executescript(SCHEMA)
    db.commit()
