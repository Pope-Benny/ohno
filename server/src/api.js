import express from 'express';
import db from './db.js';

const router = express.Router();

const fail = (res, msg, code = 400) => res.status(code).json({ error: msg });

const cleanName = (v) => (typeof v === 'string' ? v.trim() : '');

const ACCENT_KEYS = new Set([
  'lime',
  'yellow',
  'orange',
  'red',
  'pink',
  'purple',
  'blue',
  'teal',
]);

const nextPosition = (table, where, id) => {
  const row = db
    .prepare(`SELECT COALESCE(MAX(position) + 1, 0) AS p FROM ${table} WHERE ${where} = ?`)
    .get(id);
  return row.p;
};

// ---- boards ----

router.get('/boards', (req, res) => {
  const boards = db.prepare('SELECT * FROM boards ORDER BY position, id').all();
  const columns = db.prepare('SELECT * FROM columns ORDER BY position, id').all();
  const cards = db.prepare('SELECT * FROM cards ORDER BY position, id').all();

  const colsByBoard = new Map(boards.map((b) => [b.id, []]));
  const cardsByCol = new Map(columns.map((c) => [c.id, []]));
  for (const card of cards) cardsByCol.get(card.column_id)?.push(card);
  for (const col of columns) {
    colsByBoard.get(col.board_id)?.push({ ...col, cards: cardsByCol.get(col.id) });
  }
  res.json(boards.map((b) => ({ ...b, columns: colsByBoard.get(b.id) })));
});

router.post('/boards', (req, res) => {
  const name = cleanName(req.body?.name);
  if (!name) return fail(res, 'Board name is required');
  const info = db
    .prepare('INSERT INTO boards (name, position) VALUES (?, ?)')
    .run(name, nextPosition('boards', '1=1', 1));
  res.status(201).json(db.prepare('SELECT * FROM boards WHERE id = ?').get(info.lastInsertRowid));
});

router.patch('/boards/:id', (req, res) => {
  const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(req.params.id);
  if (!board) return fail(res, 'Board not found', 404);
  const name = cleanName(req.body?.name);
  const accent = req.body?.accent;
  const sets = [];
  const vals = [];
  if (name) {
    sets.push('name = ?');
    vals.push(name);
  }
  if (accent !== undefined) {
    if (typeof accent !== 'string' || !ACCENT_KEYS.has(accent)) {
      return fail(res, 'Invalid accent color');
    }
    sets.push('accent = ?');
    vals.push(accent);
  }
  if (!sets.length) return fail(res, 'Nothing to update');
  db.prepare(`UPDATE boards SET ${sets.join(', ')} WHERE id = ?`).run(...vals, board.id);
  res.json(db.prepare('SELECT * FROM boards WHERE id = ?').get(board.id));
});

router.delete('/boards/:id', (req, res) => {
  const info = db.prepare('DELETE FROM boards WHERE id = ?').run(req.params.id);
  if (!info.changes) return fail(res, 'Board not found', 404);
  res.json({ ok: true });
});

// ---- columns ----

router.post('/boards/:id/columns', (req, res) => {
  const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(req.params.id);
  if (!board) return fail(res, 'Board not found', 404);
  const name = cleanName(req.body?.name);
  if (!name) return fail(res, 'Column name is required');
  const info = db
    .prepare('INSERT INTO columns (board_id, name, position) VALUES (?, ?, ?)')
    .run(board.id, name, nextPosition('columns', 'board_id', board.id));
  res.status(201).json(db.prepare('SELECT * FROM columns WHERE id = ?').get(info.lastInsertRowid));
});

router.patch('/boards/:id/columns/order', (req, res) => {
  const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(req.params.id);
  if (!board) return fail(res, 'Board not found', 404);
  const ids = req.body?.columnIds;
  if (!Array.isArray(ids)) return fail(res, 'columnIds must be an array');
  const own = db.prepare('SELECT id FROM columns WHERE board_id = ?').all(board.id).map((r) => r.id);
  if (ids.length !== own.length || ids.some((id) => !own.includes(id))) {
    return fail(res, 'columnIds must list every column on this board exactly once');
  }
  const tx = db.transaction(() => {
    const upd = db.prepare('UPDATE columns SET position = ? WHERE id = ?');
    ids.forEach((id, i) => upd.run(i, id));
  });
  tx();
  res.json({ ok: true });
});

router.patch('/columns/:id', (req, res) => {
  const col = db.prepare('SELECT * FROM columns WHERE id = ?').get(req.params.id);
  if (!col) return fail(res, 'Column not found', 404);
  const name = cleanName(req.body?.name);
  if (!name) return fail(res, 'Column name is required');
  db.prepare('UPDATE columns SET name = ? WHERE id = ?').run(name, col.id);
  res.json({ ...col, name });
});

router.delete('/columns/:id', (req, res) => {
  const info = db.prepare('DELETE FROM columns WHERE id = ?').run(req.params.id);
  if (!info.changes) return fail(res, 'Column not found', 404);
  res.json({ ok: true });
});

// ---- cards ----

router.post('/columns/:id/cards', (req, res) => {
  const col = db.prepare('SELECT * FROM columns WHERE id = ?').get(req.params.id);
  if (!col) return fail(res, 'Column not found', 404);
  const title = cleanName(req.body?.title);
  if (!title) return fail(res, 'Card title is required');
  const info = db
    .prepare('INSERT INTO cards (column_id, title, position) VALUES (?, ?, ?)')
    .run(col.id, title, nextPosition('cards', 'column_id', col.id));
  res.status(201).json(db.prepare('SELECT * FROM cards WHERE id = ?').get(info.lastInsertRowid));
});

router.patch('/cards/:id', (req, res) => {
  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
  if (!card) return fail(res, 'Card not found', 404);
  const patch = {};
  if ('title' in req.body) {
    const title = cleanName(req.body.title);
    if (!title) return fail(res, 'Card title cannot be empty');
    patch.title = title;
  }
  if ('description' in req.body) {
    if (typeof req.body.description !== 'string') return fail(res, 'Description must be a string');
    patch.description = req.body.description;
  }
  if (Object.keys(patch).length) {
    const set = Object.keys(patch).map((k) => `${k} = ?`).join(', ');
    db.prepare(`UPDATE cards SET ${set} WHERE id = ?`).run(...Object.values(patch), card.id);
  }
  res.json({ ...card, ...patch });
});

router.delete('/cards/:id', (req, res) => {
  const info = db.prepare('DELETE FROM cards WHERE id = ?').run(req.params.id);
  if (!info.changes) return fail(res, 'Card not found', 404);
  res.json({ ok: true });
});

router.patch('/cards/:id/move', (req, res) => {
  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
  if (!card) return fail(res, 'Card not found', 404);
  const toColumnId = Number(req.body?.toColumnId);
  const rawIndex = req.body?.index;
  const target = db.prepare('SELECT * FROM columns WHERE id = ?').get(toColumnId);
  if (!target) return fail(res, 'Target column not found', 404);
  if (rawIndex === undefined || !Number.isFinite(Number(rawIndex))) {
    return fail(res, 'index must be a number');
  }
  const index = Number(rawIndex);

  const tx = db.transaction(() => {
    const ids = db
      .prepare('SELECT id FROM cards WHERE column_id = ? ORDER BY position, id')
      .all(toColumnId)
      .map((r) => r.id)
      .filter((id) => id !== card.id);
    const at = Math.max(0, Math.min(index, ids.length));
    ids.splice(at, 0, card.id);
    db.prepare('UPDATE cards SET column_id = ? WHERE id = ?').run(toColumnId, card.id);
    const upd = db.prepare('UPDATE cards SET position = ? WHERE id = ?');
    ids.forEach((id, i) => upd.run(i, id));
  });
  tx();
  res.json({ ok: true });
});

export default router;
