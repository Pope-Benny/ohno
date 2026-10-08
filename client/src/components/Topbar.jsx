import { useState } from 'react';

export default function Topbar({
  boards,
  activeId,
  onSelect,
  onAddBoard,
  theme,
  onToggleTheme,
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const v = name.trim();
    if (!v) return;
    onAddBoard(v);
    setName('');
    setAdding(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b-4 border-line bg-paper/95 backdrop-blur-[2px]">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center border-2 border-line bg-acid font-display text-lg text-black shadow-[3px_3px_0_var(--c-shadow)]">
            O
          </span>
          <span className="font-display text-xl uppercase tracking-tight sm:text-2xl">
            Ohno
          </span>
          <span className="mt-0.5 font-mono text-sm text-dim">大野</span>
        </div>

        <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {boards.map((b) => (
            <button
              key={b.id}
              onClick={() => onSelect(b.id)}
              className={`border-2 border-line px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-all ${
                b.id === activeId
                  ? 'bg-acid text-black shadow-[3px_3px_0_var(--c-shadow)]'
                  : 'bg-panel text-dim hover:text-ink hover:shadow-[3px_3px_0_var(--c-shadow)]'
              }`}
            >
              {b.name}
            </button>
          ))}

          {adding ? (
            <form onSubmit={submit} className="w-44">
              <input
                autoFocus
                className="input py-1.5 text-[11px]"
                placeholder="Board name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => name.trim() || setAdding(false)}
                maxLength={40}
              />
            </form>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="border-2 border-dashed border-line/50 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-dim transition-colors hover:border-acid hover:text-acid"
              title="New board"
            >
              + Board
            </button>
          )}
        </nav>

        <button
          className="btn btn-ghost shrink-0"
          onClick={onToggleTheme}
          title="Toggle theme"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? '☾ Dark' : '☀ Light'}
        </button>
      </div>
    </header>
  );
}
