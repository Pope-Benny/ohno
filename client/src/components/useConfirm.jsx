import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

export default function useConfirm() {
  const [state, setState] = useState(null);

  const ask = (message) =>
    new Promise((resolve) => {
      setState({ message, resolve });
    });

  const settle = (value) => {
    state?.resolve(value);
    setState(null);
  };

  const dialog = (
    <AnimatePresence>
      {state && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => settle(false)}
        >
          <motion.div
            className="hard w-full max-w-sm bg-panel p-5"
            style={{ boxShadow: '8px 8px 0 var(--c-shadow)' }}
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            transition={{ duration: 0.15 }}
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
              <button className="btn btn-acid" onClick={() => settle(true)} autoFocus>
                Yes
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return [ask, dialog];
}
