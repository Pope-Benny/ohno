import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export function CardShell({ card, dragging = false, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`group w-full cursor-pointer border-2 border-line bg-panel p-3 text-left transition-colors hover:border-acid ${
        dragging ? 'rotate-[1.5deg] shadow-[8px_8px_0_var(--c-shadow)]' : 'shadow-[3px_3px_0_var(--c-shadow)]'
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="mt-[3px] font-mono text-[9px] text-dim group-hover:text-acid">
          #{card.id}
        </span>
        <h4 className="min-w-0 flex-1 text-sm font-bold leading-snug break-words">
          {card.title}
        </h4>
      </div>
      {card.description ? (
        <p className="mt-1.5 pl-7 font-mono text-[10px] leading-relaxed text-dim break-words">
          {card.description}
        </p>
      ) : null}
    </div>
  );
}

export default function Card({ card, onOpen }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } =
    useSortable({
      id: `card:${card.id}`,
      data: { type: 'card', cardId: card.id },
    });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
      }}
      {...attributes}
      {...listeners}
      className="touch-manipulation"
    >
      <CardShell card={card} onClick={() => onOpen(card)} />
    </div>
  );
}
