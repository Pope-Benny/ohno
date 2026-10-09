import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = path.resolve(process.env.DB_PATH || 'data/ohno.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS boards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  accent TEXT NOT NULL DEFAULT 'lime',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS columns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  column_id INTEGER NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS whiteboards (
  board_id INTEGER PRIMARY KEY REFERENCES boards(id) ON DELETE CASCADE,
  data TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_columns_board ON columns(board_id);
CREATE INDEX IF NOT EXISTS idx_cards_column ON cards(column_id);
`);

const boardCols = db.prepare('PRAGMA table_info(boards)').all().map((c) => c.name);
if (!boardCols.includes('accent')) {
  db.exec("ALTER TABLE boards ADD COLUMN accent TEXT NOT NULL DEFAULT 'lime'");
}

const hasBoards = db.prepare('SELECT COUNT(*) AS n FROM boards').get().n > 0;
if (!hasBoards) {
  const seed = db.transaction(() => {
    const boardId = db
      .prepare('INSERT INTO boards (name, position) VALUES (?, 0)')
      .run('Main Board').lastInsertRowid;
    const col = db.prepare(
      'INSERT INTO columns (board_id, name, position) VALUES (?, ?, ?)'
    );
    col.run(boardId, 'To Do', 0);
    col.run(boardId, 'In Progress', 1);
    col.run(boardId, 'Done', 2);
  });
  seed();
}

export default db;
