import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { api } from '../api.js';
import useConfirm from './useConfirm.jsx';

export default function CardModal({ card, onClose, onChange }) {
  const [ask, confirmDialog] = useConfirm();
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description);
  const [status, setStatus] = useState('saved'); // saved | saving | error

  const baseline = useRef({ title: card.title, description: card.description });
  const latest = useRef({ title, description });
  latest.current = { title, description };

  const dirty =
    title !== baseline.current.title || description !== baseline.current.description;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const timer = useRef(null);
  const saving = useRef(false);

  const flush = async () => {
    if (!dirtyRef.current || saving.current) return;
    const payload = latest.current;
    if (!payload.title.trim()) {
      setStatus('error');
      return;
    }
    saving.current = true;
    clearTimeout(timer.current);
    setStatus('saving');
    try {
      await api.updateCard(card.id, payload);
      baseline.current = { ...payload };
      dirtyRef.current = false;
      await onChange();
      setStatus('saved');
    } catch (e) {
      setStatus('error');
      console.error(e);
    } finally {
      saving.current = false;
    }
  };

  useEffect(() => {
    if (!dirty) return;
    setStatus('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 450);
    return () => clearTimeout(timer.current);
  }, [title, description]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = async () => {
    clearTimeout(timer.current);
    if (dirtyRef.current) await flush();
    onClose();
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async () => {
    const ok = await ask(`Delete card "${card.title}"?`);
    if (ok) {
      await api.deleteCard(card.id);
      await onChange();
      onClose();
    }
  };

  const statusLabel =
    status === 'saving' ? 'Saving…' : status === 'error' ? 'Not saved' : 'Saved';

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-[8vh] sm:pt-[12vh]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.12 }}
        onClick={close}
      >
        <motion.div
          className="hard w-full max-w-2xl bg-panel"
          style={{ boxShadow: '8px 8px 0 var(--c-shadow)' }}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 10, opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Edit card"
        >
          <div className="flex items-center justify-between border-b-2 border-line px-5 py-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-dim">
              Card #{card.id}
            </span>
            <div className="flex items-center gap-4">
              <span
                className={`font-mono text-[10px] uppercase tracking-widest ${
                  status === 'error' ? 'text-danger' : 'text-dim'
                }`}
              >
                {statusLabel}
              </span>
              <button
                className="btn btn-ghost px-2 py-1"
                onClick={close}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="p-5">
            <input
              className="w-full border-b-2 border-line bg-transparent pb-2 font-display text-2xl uppercase leading-tight outline-none focus:border-acid"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Card title"
              maxLength={200}
              autoFocus
            />
            {title.trim() ? null : (
              <p className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-danger">
                Title cannot be empty
              </p>
            )}

            <textarea
              className="input mt-5 min-h-[180px] resize-y text-sm leading-relaxed"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description — what needs to happen, gotchas, links…"
            />
          </div>

          <div className="flex items-center justify-between border-t-2 border-line px-5 py-3">
            <span className="font-mono text-[10px] text-dim">
              Autosaves as you type
            </span>
            <div className="flex gap-3">
              <button className="btn" onClick={close}>
                Close
              </button>
              <button className="btn btn-danger" onClick={handleDelete}>
                Delete card
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
      {confirmDialog}
    </AnimatePresence>
  );
}
