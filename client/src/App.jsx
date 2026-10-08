import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { getTheme, toggleTheme } from './theme.js';
import { accentValue } from './accent.js';
import Topbar from './components/Topbar.jsx';
import BoardView from './components/BoardView.jsx';
import CardModal from './components/CardModal.jsx';

export default function App() {
  const [boards, setBoards] = useState([]);
  const [activeId, setActiveId] = useState(() => {
    const v = Number(localStorage.getItem('ohno-board'));
    return Number.isFinite(v) && v > 0 ? v : null;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openCardId, setOpenCardId] = useState(null);
  const [theme, setTheme] = useState(getTheme);

  const refresh = useCallback(async () => {
    try {
      const data = await api.boards();
      setBoards(data);
      setError(null);
      return data;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const activeBoard = boards.find((b) => b.id === activeId) || boards[0] || null;

  useEffect(() => {
    if (activeBoard) localStorage.setItem('ohno-board', String(activeBoard.id));
  }, [activeBoard]);

  useEffect(() => {
    const accent = accentValue(activeBoard?.accent);
    const el = document.documentElement.style;
    el.setProperty('--c-acid', accent);
    if (theme === 'dark') {
      el.setProperty('--c-shadow', accent);
    } else {
      el.removeProperty('--c-shadow');
    }
  }, [activeBoard?.accent, theme]);

  const openCard =
    activeBoard && openCardId != null
      ? activeBoard.columns.flatMap((c) => c.cards).find((c) => c.id === openCardId)
      : null;

  const addBoard = async (name) => {
    try {
      const board = await api.createBoard(name);
      await refresh();
      setActiveId(board.id);
    } catch (e) {
      setError(e.message);
    }
  };

  const toggle = () => setTheme(toggleTheme());

  const setAccent = async (key) => {
    if (!activeBoard) return;
    setBoards((prev) =>
      prev.map((b) => (b.id === activeBoard.id ? { ...b, accent: key } : b))
    );
    try {
      await api.updateBoard(activeBoard.id, { accent: key });
      await refresh();
    } catch (e) {
      setError(e.message);
      await refresh();
    }
  };

  return (
    <div className="min-h-screen">
      <Topbar
        boards={boards}
        activeId={activeBoard?.id}
        onSelect={setActiveId}
        onAddBoard={addBoard}
        theme={theme}
        onToggleTheme={toggle}
        accent={activeBoard?.accent}
        onAccentChange={setAccent}
      />

      {error && (
        <div className="mx-4 mt-4 flex items-center justify-between gap-4 border-2 border-danger bg-panel px-4 py-2.5 shadow-[4px_4px_0_var(--c-shadow)] sm:mx-8">
          <span className="font-mono text-[11px] uppercase tracking-widest text-danger">
            Error — {error}
          </span>
          <button className="btn" onClick={refresh}>
            Retry
          </button>
        </div>
      )}

      <main>
        {loading ? (
          <div className="flex min-h-[50vh] items-center justify-center font-mono text-xs uppercase tracking-[0.3em] text-dim">
            Loading…
          </div>
        ) : boards.length === 0 ? (
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4 text-center">
            <h1 className="font-display text-5xl uppercase sm:text-7xl">Ohno.</h1>
            <p className="max-w-sm font-mono text-xs leading-relaxed uppercase tracking-widest text-dim">
              No boards. Hit “+ Board” up top to start one.
            </p>
          </div>
        ) : activeBoard ? (
          <BoardView
            key={activeBoard.id}
            board={activeBoard}
            setBoards={setBoards}
            refresh={refresh}
            setError={setError}
            onOpenCard={(card) => setOpenCardId(card.id)}
          />
        ) : null}
      </main>

      {openCard && (
        <CardModal
          key={openCard.id}
          card={openCard}
          onClose={() => setOpenCardId(null)}
          onChange={refresh}
        />
      )}
    </div>
  );
}
