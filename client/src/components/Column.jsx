import { useState } from 'react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Card from './Card.jsx';
export default function Column({
  column,
  onAddCard,
  onRenameColumn,
  onDeleteColumn,
  onOpenCard,
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(column.name);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);

  const { setNodeRef, attributes, listeners, transform, transition, isDragging, isOver } =
    useSortable({
      id: `col:${column.id}`,
      data: { type: 'column', columnId: column.id },
    });

  const submitName = () => {
    const v = name.trim();
    setEditing(false);
    if (!v || v === column.name) {
      setName(column.name);
      return;
    }
    onRenameColumn(v);
  };

  const submitCard = (e) => {
    e.preventDefault();
    const v = draft.trim();
    if (!v) return;
    onAddCard(v);
    setDraft('');
  };

  const handleDelete = () => {
    onDeleteColumn();
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className={`flex w-[300px] max-w-[calc(100vw-5rem)] shrink-0 flex-col border-2 bg-panel ${
        isOver && !isDragging ? 'border-acid shadow-[6px_6px_0_var(--c-shadow)]' : 'border-line'
      }`}
    >
      <div className="flex items-center gap-2 border-b-2 border-line px-3 py-2.5">
        <button
          {...attributes}
          {...listeners}
          className="tap cursor-grab touch-manipulation font-mono text-xs text-dim hover:text-acid active:cursor-grabbing"
          title="Drag column"
          aria-label="Drag column"
        >
          ::
        </button>

        {editing ? (
          <input
            autoFocus
            className="input min-w-0 flex-1 py-0.5 text-sm font-bold pointer-coarse:text-base"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={submitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitName();
              if (e.key === 'Escape') {
                setName(column.name);
                setEditing(false);
              }
            }}
            maxLength={40}
          />
        ) : (
          <button
            className="min-w-0 flex-1 truncate text-left font-mono text-xs font-bold uppercase tracking-[0.12em] underline-hot"
            onClick={() => {
              setName(column.name);
              setEditing(true);
            }}
            title="Rename column"
          >
            {column.name}
          </button>
        )}

        <button
          className="tap px-1 font-mono text-xs font-bold text-dim hover:text-danger"
          onClick={handleDelete}
          title="Delete column"
          aria-label="Delete column"
        >
          ✕
        </button>
      </div>

      <div className="scroll-y flex max-h-[calc(100dvh-320px)] min-h-24 flex-1 flex-col gap-2.5 overflow-y-auto p-2.5">
        <SortableContext
          items={column.cards.map((c) => `card:${c.id}`)}
          strategy={verticalListSortingStrategy}
        >
          {column.cards.map((card) => (
            <Card key={card.id} card={card} onOpen={onOpenCard} />
          ))}
        </SortableContext>

        {column.cards.length === 0 && (
          <div className="flex h-16 items-center justify-center border-2 border-dashed border-line/40 font-mono text-[10px] uppercase tracking-widest text-dim">
            Empty
          </div>
        )}
      </div>

      <form onSubmit={submitCard} className="border-t-2 border-line p-2.5">
        <input
          className="input py-1.5 text-[11px] pointer-coarse:text-base"
          placeholder="+ Add card"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setAdding(true)}
          onBlur={() => setAdding(false)}
          maxLength={200}
          aria-label={`Add card to ${column.name}`}
        />
      </form>

    </div>
  );
}
