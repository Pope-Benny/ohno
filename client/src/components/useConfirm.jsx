import { useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';

export default function useConfirm() {
  const [state, setState] = useState(null);
  const resolveRef = useRef(null);

  const ask = (message) =>
    new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({ message });
    });

  const settle = (value) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setState(null);
    resolve?.(value);
  };

  const dialog = (
    <AnimatePresence>
      {state && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          onClick={() => settle(false)}
        >
          <div
            className="hard w-full max-w-sm bg-panel p-5"
            style={{ boxShadow: '8px 8px 0 var(--c-shadow)' }}
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-dim">
              Confirm
            </p>
            <p className="mt-2 text-lg font-bold leading-snug">{state.message}</p>
            <div className="mt-5 flex justify-end gap-3">
              <button className="btn" onClick={() => settle(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-acid" onClick={(e) => { e.preventDefault(); settle(true); }}>
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );

  return [ask, dialog];
}
