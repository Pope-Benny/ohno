import { useEffect, useRef, useState } from 'react';
import { ACCENTS, accentValue } from '../accent.js';

export default function Topbar({
  boards,
  activeId,
  onSelect,
  onAddBoard,
  theme,
  onToggleTheme,
  accent,
  onAccentChange,
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [accentOpen, setAccentOpen] = useState(false);
  const accentRef = useRef(null);

  useEffect(() => {
    const onDown = (e) => {
      if (accentRef.current && !accentRef.current.contains(e.target)) setAccentOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:gap-x-5 sm:gap-y-3 sm:px-6 sm:py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center border-2 border-line bg-acid font-mono text-xs font-bold text-black shadow-[3px_3px_0_var(--c-shadow)]">
            大野
          </span>
          <span className="font-display text-xl uppercase tracking-tight sm:text-2xl">
            Ohno
          </span>
        </div>

        <nav className="no-bar order-last flex w-full min-w-0 flex-nowrap items-center gap-2 overflow-x-auto sm:order-none sm:w-auto sm:flex-1 sm:flex-wrap sm:overflow-x-visible">
          {boards.map((b) => (
            <button
              key={b.id}
              onClick={() => onSelect(b.id)}
              className={`tap shrink-0 border-2 border-line px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-all ${
                b.id === activeId
                  ? 'bg-acid text-black shadow-[3px_3px_0_var(--c-shadow)]'
                  : 'bg-panel text-dim hover:text-ink hover:shadow-[3px_3px_0_var(--c-shadow)]'
              }`}
            >
              {b.name}
            </button>
          ))}

          {adding ? (
            <form onSubmit={submit} className="w-44 shrink-0">
              <input
                autoFocus
                className="input py-1.5 text-[11px] pointer-coarse:text-base"
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
              className="tap shrink-0 border-2 border-dashed border-line/50 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-dim transition-colors hover:border-acid hover:text-acid"
              title="New board"
            >
              + Board
            </button>
          )}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-4">
          {activeId && (
            <div className="relative" ref={accentRef}>
              <button
                className="btn btn-ghost shrink-0"
                onClick={() => setAccentOpen((o) => !o)}
                title="Board accent color"
                aria-label="Board accent color"
              >
                <span
                  className="mr-2 inline-block h-3 w-3 border border-line align-middle"
                  style={{ backgroundColor: accentValue(accent) }}
                />
                Accent
              </button>
              {accentOpen && (
                <div className="absolute right-0 z-50 mt-2 grid w-max grid-cols-4 gap-2 border-2 border-line bg-panel p-3 shadow-[4px_4px_0_var(--c-shadow)]">
                  {Object.entries(ACCENTS).map(([key, a]) => (
                    <button
                      key={key}
                      className={`tap h-6 w-6 border-2 transition-transform hover:scale-110 ${
                        accent === key
                          ? 'border-ink shadow-[2px_2px_0_var(--c-shadow)]'
                          : 'border-line/60'
                      }`}
                      style={{ backgroundColor: a.value }}
                      onClick={() => {
                        onAccentChange(key);
                        setAccentOpen(false);
                      }}
                      title={a.label}
                      aria-label={a.label}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            className="btn btn-ghost shrink-0"
            onClick={onToggleTheme}
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☾ Dark' : '☀ Light'}
          </button>
        </div>
      </div>
    </header>
  );
}
