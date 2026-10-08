import { useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { api } from '../api.js';
import Column from './Column.jsx';
import { CardShell } from './Card.jsx';
import useConfirm from './useConfirm.jsx';

function detectCollisions(args) {
  const type = args.active.data.current?.type;
  if (type === 'column') {
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (c) => c.data.current?.type === 'column'
      ),
    });
  }
  const byPointer = pointerWithin(args);
  return byPointer.length ? byPointer : closestCorners(args);
}

export default function BoardView({ board, setBoards, refresh, setError, onOpenCard }) {
  const [ask, confirmDialog] = useConfirm();
  const [activeCard, setActiveCard] = useState(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [colDraft, setColDraft] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [boardName, setBoardName] = useState(board.name);
  const dragJustEnded = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const patchBoard = (fn) =>
    setBoards((prev) => prev.map((b) => (b.id === board.id ? fn(b) : b)));

  const commit = async (fn) => {
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e.message);
      await refresh();
    }
  };

  const totalCards = board.columns.reduce((n, c) => n + c.cards.length, 0);

  // ---- dnd ----

  const findCardContext = (cardId) => {
    for (const col of board.columns) {
      const idx = col.cards.findIndex((c) => c.id === cardId);
      if (idx !== -1) return { col, idx };
    }
    return null;
  };

  const applyMove = (cardId, toColumnId, index) => {
    const ctx = findCardContext(cardId);
    if (!ctx) return;
    const card = ctx.col.cards[ctx.idx];
    const columns = board.columns.map((c) => ({
      ...c,
      cards: c.cards.filter((k) => k.id !== cardId),
    }));
    const target = columns.find((c) => c.id === toColumnId);
    if (!target) return;
    const cards = [...target.cards];
    cards.splice(Math.max(0, Math.min(index, cards.length)), 0, card);
    target.cards = cards;
    patchBoard((b) => ({ ...b, columns }));
  };

  const onDragStart = ({ active }) => {
    if (active.data.current?.type === 'card') {
      const ctx = findCardContext(active.data.current.cardId);
      setActiveCard(ctx ? ctx.col.cards[ctx.idx] : null);
    }
  };

  const onDragEnd = ({ active, over }) => {
    setActiveCard(null);
    dragJustEnded.current = true;
    setTimeout(() => {
      dragJustEnded.current = false;
    }, 200);

    if (!over || active.id === over.id) return;

    const activeType = active.data.current?.type;

    if (activeType === 'column') {
      const ids = board.columns.map((c) => `col:${c.id}`);
      const from = ids.indexOf(active.id);
      const to = ids.indexOf(over.id);
      if (from === -1 || to === -1) return;
      const reordered = arrayMove(board.columns, from, to);
      patchBoard((b) => ({ ...b, columns: reordered }));
      commit(() =>
        api.reorderColumns(board.id, reordered.map((c) => c.id))
      );
      return;
    }

    if (activeType !== 'card') return;
    const cardId = active.data.current.cardId;
    const overId = over.id;
    let toColumnId;
    let index;

    if (typeof overId === 'string' && overId.startsWith('col:')) {
      toColumnId = Number(overId.slice(4));
      const col = board.columns.find((c) => c.id === toColumnId);
      if (!col) return;
      index = col.cards.length;
    } else if (typeof overId === 'string' && overId.startsWith('card:')) {
      const overCardId = Number(overId.slice(5));
      const overCtx = findCardContext(overCardId);
      if (!overCtx) return;
      toColumnId = overCtx.col.id;
      index = overCtx.idx;
      const fromCtx = findCardContext(cardId);
      if (fromCtx && fromCtx.col.id === toColumnId && fromCtx.idx < index) {
        index -= 1;
      }
    } else {
      return;
    }

    applyMove(cardId, toColumnId, index);
    commit(() => api.moveCard(cardId, toColumnId, index));
  };

  // ---- mutations ----

  const addCard = (columnId, title) =>
    commit(() => api.createCard(columnId, title));

  const renameColumn = (id, name) => commit(() => api.updateColumn(id, name));

  const deleteColumn = async (col) => {
    const ok = await ask(
      col.cards.length
        ? `Delete "${col.name}" and its ${col.cards.length} card${col.cards.length === 1 ? '' : 's'}?`
        : `Delete column "${col.name}"?`
    );
    if (ok) commit(() => api.deleteColumn(col.id));
  };

  const addColumn = (e) => {
    e.preventDefault();
    const v = colDraft.trim();
    if (!v) return;
    setColDraft('');
    commit(() => api.createColumn(board.id, v));
  };

  const deleteBoard = async () => {
    const ok = await ask(`Delete board "${board.name}"? All columns and cards go with it.`);
    if (ok) commit(() => api.deleteBoard(board.id));
  };

  const submitBoardName = () => {
    const v = boardName.trim();
    setEditingName(false);
    if (!v || v === board.name) {
      setBoardName(board.name);
      return;
    }
    commit(() => api.updateBoard(board.id, v));
  };

  const openCard = (card) => {
    if (dragJustEnded.current) return;
    onOpenCard(card);
  };

  return (
    <div className="px-4 pb-10 pt-7 sm:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {editingName ? (
            <input
              autoFocus
              className="input max-w-md font-display text-3xl uppercase"
              value={boardName}
              onChange={(e) => setBoardName(e.target.value)}
              onBlur={submitBoardName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitBoardName();
                if (e.key === 'Escape') {
                  setBoardName(board.name);
                  setEditingName(false);
                }
              }}
              maxLength={60}
            />
          ) : (
            <h1
              className="cursor-text font-display text-3xl uppercase leading-none tracking-tight underline-hot sm:text-4xl"
              onClick={() => {
                setBoardName(board.name);
                setEditingName(true);
              }}
              title="Click to rename"
            >
              {board.name}
            </h1>
          )}
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-dim">
            {board.columns.length} column{board.columns.length === 1 ? '' : 's'} ·{' '}
            {totalCards} card{totalCards === 1 ? '' : 's'}
          </p>
        </div>

        <button className="btn btn-danger" onClick={deleteBoard}>
          Delete board
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={detectCollisions}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveCard(null)}
      >
        <div className="scroll-x flex items-start gap-5 overflow-x-auto pb-6">
          <SortableContext
            items={board.columns.map((c) => `col:${c.id}`)}
            strategy={horizontalListSortingStrategy}
          >
            {board.columns.map((col) => (
              <Column
                key={col.id}
                column={col}
                onAddCard={(title) => addCard(col.id, title)}
                onRenameColumn={(name) => name && renameColumn(col.id, name)}
                onDeleteColumn={() => deleteColumn(col)}
                onOpenCard={openCard}
              />
            ))}
          </SortableContext>

          <div className="w-[300px] shrink-0">
            {addingColumn ? (
              <form onSubmit={addColumn} className="border-2 border-line bg-panel p-2.5">
                <input
                  autoFocus
                  className="input text-sm font-bold"
                  placeholder="Column name"
                  value={colDraft}
                  onChange={(e) => setColDraft(e.target.value)}
                  onBlur={() => !colDraft.trim() && setAddingColumn(false)}
                  maxLength={40}
                />
              </form>
            ) : (
              <button
                className="flex h-[120px] w-full items-center justify-center border-2 border-dashed border-line/50 font-mono text-[11px] font-bold uppercase tracking-widest text-dim transition-colors hover:border-acid hover:bg-panel hover:text-acid"
                onClick={() => setAddingColumn(true)}
              >
                + Add column
              </button>
            )}
          </div>
        </div>

        <DragOverlay dropAnimation={{ duration: 180, easing: 'ease-out' }}>
          {activeCard ? <CardShell card={activeCard} dragging /> : null}
        </DragOverlay>
      </DndContext>

      {confirmDialog}
    </div>
  );
}
