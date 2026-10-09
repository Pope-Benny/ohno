import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { ACCENTS, DEFAULT_ACCENT, accentValue } from '../accent.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const uid = () => Math.random().toString(36).slice(2, 10);

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  const x = ax + t * dx - px;
  const y = ay + t * dy - py;
  return Math.hypot(x, y);
}

function polyDist(points, pt) {
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    best = Math.min(
      best,
      segDist(pt.x, pt.y, points[i - 1][0], points[i - 1][1], points[i][0], points[i][1])
    );
  }
  return best;
}

const NOTE_W = 160;
const NOTE_H = 100;

export default function Whiteboard({ boardId, accent, setError }) {
  const [data, setData] = useState(() => ({ strokes: [], notes: [], shapes: [] }));
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState({ zoom: 1, panX: 0, panY: 0 });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [tool, setTool] = useState('select');
  const [color, setColor] = useState(
    ACCENTS[accent] || ACCENTS[DEFAULT_ACCENT] ? accent : DEFAULT_ACCENT
  );
  const [selectedId, setSelectedId] = useState(null);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const dataRef = useRef(data);
  const viewRef = useRef(view);
  const selectedRef = useRef(selectedId);
  const loadedRef = useRef(false);
  const dirtyRef = useRef(false);
  const saveTimer = useRef(null);
  const pastRef = useRef([]);
  const futureRef = useRef([]);
  const drawRef = useRef(null);
  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  const panRef = useRef(false);
  const spaceRef = useRef(false);
  const pointers = useRef(new Map());
  const pointerPrev = useRef(new Map());

  dataRef.current = data;
  viewRef.current = view;
  selectedRef.current = selectedId;

  // ---- persistence ----

  const flushSave = useCallback(async () => {
    clearTimeout(saveTimer.current);
    if (!dirtyRef.current || !loadedRef.current) return;
    dirtyRef.current = false;
    try {
      await api.saveWhiteboard(boardId, dataRef.current);
    } catch (e) {
      dirtyRef.current = true;
      setError(e.message);
    }
  }, [boardId, setError]);

  const scheduleSave = useCallback(() => {
    if (!loadedRef.current) return;
    dirtyRef.current = true;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushSave, 1200);
  }, [flushSave]);

  useEffect(() => {
    scheduleSave();
  }, [data, scheduleSave]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await api.whiteboard(boardId);
        if (!cancelled) {
          setData({ strokes: [], notes: [], shapes: [], ...res.data });
          loadedRef.current = true;
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [boardId, setError]);

  useEffect(() => () => flushSave(), [flushSave]);

  // ---- history ----

  const pushHistory = useCallback(() => {
    pastRef.current.push(JSON.stringify(dataRef.current));
    if (pastRef.current.length > 100) pastRef.current.shift();
    futureRef.current = [];
  }, []);

  const applySnapshot = (snap) => {
    setData((prev) => {
      const merged = { ...prev, ...JSON.parse(snap) };
      return merged;
    });
  };

  const undo = useCallback(() => {
    if (!pastRef.current.length) return;
    futureRef.current.push(JSON.stringify(dataRef.current));
    applySnapshot(pastRef.current.pop());
  }, []);

  const redo = useCallback(() => {
    if (!futureRef.current.length) return;
    pastRef.current.push(JSON.stringify(dataRef.current));
    applySnapshot(futureRef.current.pop());
  }, []);

  // ---- view helpers ----

  const toWorld = (clientX, clientY) => {
    const rect = svgRef.current.getBoundingClientRect();
    const v = viewRef.current;
    return {
      x: (clientX - rect.left) / v.zoom + v.panX,
      y: (clientY - rect.top) / v.zoom + v.panY,
    };
  };

  const zoomAt = useCallback((cx, cy, factor) => {
    setView((v) => {
      const zoom = clamp(v.zoom * factor, 0.2, 4);
      const wx = v.panX + cx / v.zoom;
      const wy = v.panY + cy / v.zoom;
      return { zoom, panX: wx - cx / zoom, panY: wy - cy / zoom };
    });
  }, []);

  const zoomBy = (factor) => {
    const c = () => ({ x: size.w / 2, y: size.h / 2 });
    const { x, y } = c();
    zoomAt(x, y, factor);
  };

  const fitView = () => {
    const all = [...dataRef.current.strokes, ...dataRef.current.notes, ...dataRef.current.shapes];
    if (!all.length || !size.w || !size.h) {
      setView({ zoom: 1, panX: 0, panY: 0 });
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const item of all) {
      let pts = [];
      if (item.points) pts = item.points;
      else if (item.x1 !== undefined)
        pts = [
          [item.x1, item.y1],
          [item.x2, item.y2],
        ];
      else pts = [
        [item.x, item.y],
        [item.x + item.w, item.y + item.h],
      ];
      for (const [px, py] of pts) {
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);
      }
    }
    const bw = maxX - minX;
    const bh = maxY - minY;
    const zoom = clamp(Math.min(size.w / (bw + 80), size.h / (bh + 80)), 0.2, 2);
    setView({
      zoom,
      panX: minX - (size.w / zoom - bw) / 2,
      panY: minY - (size.h / zoom - bh) / 2,
    });
  };

  // ---- hit testing ----

  const hitTest = (pt) => {
    const d = dataRef.current;
    const tol = 8 / viewRef.current.zoom;
    for (let i = d.notes.length - 1; i >= 0; i--) {
      const n = d.notes[i];
      if (pt.x >= n.x && pt.x <= n.x + n.w && pt.y >= n.y && pt.y <= n.y + n.h)
        return { type: 'note', id: n.id };
    }
    for (let i = d.shapes.length - 1; i >= 0; i--) {
      const s = d.shapes[i];
      if (s.type === 'rect') {
        if (
          pt.x >= Math.min(s.x1, s.x2) &&
          pt.x <= Math.max(s.x1, s.x2) &&
          pt.y >= Math.min(s.y1, s.y2) &&
          pt.y <= Math.max(s.y1, s.y2)
        )
          return { type: 'shape', id: s.id };
      } else if (segDist(pt.x, pt.y, s.x1, s.y1, s.x2, s.y2) < tol + s.width / 2) {
        return { type: 'shape', id: s.id };
      }
    }
    for (let i = d.strokes.length - 1; i >= 0; i--) {
      const s = d.strokes[i];
      if (polyDist(s.points, pt) < tol + s.width / 2) return { type: 'stroke', id: s.id };
    }
    return null;
  };

  const findItem = (id) => {
    const d = dataRef.current;
    return (
      d.notes.find((n) => n.id === id) ||
      d.shapes.find((s) => s.id === id) ||
      d.strokes.find((s) => s.id === id)
    );
  };

  const removeById = (id) => {
    setData((prev) => ({
      ...prev,
      notes: prev.notes.filter((n) => n.id !== id),
      shapes: prev.shapes.filter((s) => s.id !== id),
      strokes: prev.strokes.filter((s) => s.id !== id),
    }));
    setSelectedId(null);
  };

  const deleteSelected = () => {
    if (selectedRef.current == null) return;
    pushHistory();
    removeById(selectedRef.current);
  };

  // ---- pointer interactions ----

  const onPointerDown = (e) => {
    svgRef.current.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      panRef.current = false;
      return;
    }
    if (e.button === 1 || spaceRef.current) {
      panRef.current = true;
      return;
    }

    const pt = toWorld(e.clientX, e.clientY);

    if (tool === 'pen') {
      pushHistory();
      setSelectedId(null);
      const id = uid();
      drawRef.current = { kind: 'stroke', id, type: 'stroke', color, width: 3, originalPoints: [[pt.x, pt.y]] };
      setData((prev) => ({
        ...prev,
        strokes: [...prev.strokes, { id, points: [[pt.x, pt.y]], color, width: 3 }],
      }));
      return;
    }

    if (tool === 'line' || tool === 'arrow' || tool === 'rect') {
      pushHistory();
      setSelectedId(null);
      const id = uid();
      drawRef.current = { kind: 'shape', id, type: tool, color };
      setData((prev) => ({
        ...prev,
        shapes: [
          ...prev.shapes,
          { id, type: tool, x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y, color, width: 3 },
        ],
      }));
      return;
    }

    if (tool === 'note') {
      pushHistory();
      const id = uid();
      const note = { id, x: pt.x - NOTE_W / 2, y: pt.y - NOTE_H / 2, w: NOTE_W, h: NOTE_H, text: '', color };
      setData((prev) => ({ ...prev, notes: [...prev.notes, note] }));
      setTool('select');
      setSelectedId(id);
      setEditingNoteId(id);
      return;
    }

    if (tool === 'eraser') {
      const hit = hitTest(pt);
      if (hit) {
        pushHistory();
        removeById(hit.id);
      }
      return;
    }

    const hit = hitTest(pt);
    if (hit) {
      setSelectedId(hit.id);
      const item = findItem(hit.id);
      dragRef.current = {
        id: hit.id,
        type: hit.type,
        start: pt,
        pushed: false,
        original: JSON.parse(JSON.stringify(item)),
      };
    } else {
      setSelectedId(null);
    }
  };

  const onPointerMove = (e) => {
    if (pointers.current.size === 2 && pointers.current.has(e.pointerId)) {
      pointerPrev.current.set(
        e.pointerId,
        pointers.current.get(e.pointerId) || { x: e.clientX, y: e.clientY }
      );
      const other = [...pointers.current.entries()].find(([id]) => id !== e.pointerId);
      if (other) {
        const [oid, opos] = other;
        const myPrev = pointerPrev.current.get(e.pointerId);
        const oPrev = pointerPrev.current.get(oid) || opos;
        const dPrev = Math.hypot(myPrev.x - oPrev.x, myPrev.y - oPrev.y) || 1;
        const dCur = Math.hypot(e.clientX - opos.x, e.clientY - opos.y);
        if (dCur > 0) {
          const rect = svgRef.current.getBoundingClientRect();
          zoomAt(
            (e.clientX + opos.x) / 2 - rect.left,
            (e.clientY + opos.y) / 2 - rect.top,
            dCur / dPrev
          );
        }
      }
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      return;
    }
    if (panRef.current && pointers.current.has(e.pointerId)) {
      const prev = pointers.current.get(e.pointerId);
      const dx = (e.clientX - prev.x) / viewRef.current.zoom;
      const dy = (e.clientY - prev.y) / viewRef.current.zoom;
      setView((v) => ({ ...v, panX: v.panX - dx, panY: v.panY - dy }));
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      return;
    }
    if (pointers.current.has(e.pointerId)) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    const pt = toWorld(e.clientX, e.clientY);

    if (drawRef.current) {
      const d = drawRef.current;
      if (d.kind === 'stroke') {
        const pts = d.originalPoints || (d.originalPoints = [[pt.x, pt.y]]);
        const last = pts[pts.length - 1];
        if (Math.hypot(pt.x - last[0], pt.y - last[1]) > 0.75) pts.push([pt.x, pt.y]);
        setData((prev) => ({
          ...prev,
          strokes: prev.strokes.map((s) => (s.id === d.id ? { ...s, points: [...pts] } : s)),
        }));
      } else {
        setData((prev) => ({
          ...prev,
          shapes: prev.shapes.map((s) =>
            s.id === d.id ? { ...s, x2: pt.x, y2: pt.y } : s
          ),
        }));
      }
      return;
    }

    if (dragRef.current) {
      const g = dragRef.current;
      const dx = pt.x - g.start.x;
      const dy = pt.y - g.start.y;
      if (!g.pushed) {
        if (Math.abs(dx) + Math.abs(dy) < 3 / viewRef.current.zoom) return;
        g.pushed = true;
        pushHistory();
      }
      setData((prev) => {
        const move = {
          note: (n) => ({ ...n, x: g.original.x + dx, y: g.original.y + dy }),
          shape: (s) => ({
            ...s,
            x1: g.original.x1 + dx,
            y1: g.original.y1 + dy,
            x2: g.original.x2 + dx,
            y2: g.original.y2 + dy,
          }),
          stroke: (s) => ({ ...s, points: s.points.map(([px, py]) => [px + dx, py + dy]) }),
        };
        if (g.type === 'note')
          return { ...prev, notes: prev.notes.map((n) => (n.id === g.id ? move.note(n) : n)) };
        if (g.type === 'shape')
          return { ...prev, shapes: prev.shapes.map((s) => (s.id === g.id ? move.shape(s) : s)) };
        return { ...prev, strokes: prev.strokes.map((s) => (s.id === g.id ? move.stroke(s) : s)) };
      });
      return;
    }

    if (resizeRef.current) {
      const g = resizeRef.current;
      const dx = pt.x - g.start.x;
      const dy = pt.y - g.start.y;
      setData((prev) => ({
        ...prev,
        notes: prev.notes.map((n) =>
          n.id === g.id
            ? { ...n, w: Math.max(g.original.w + dx, 90), h: Math.max(g.original.h + dy, 60) }
            : n
        ),
      }));
      return;
    }
  };

  const onPointerUp = (e) => {
    if (drawRef.current?.kind === 'stroke') {
      const id = drawRef.current.id;
      const st = dataRef.current.strokes.find((s) => s.id === id);
      const malformed = !st || !Array.isArray(st.points[0]) || st.points.length < 2;
      if (malformed) {
        pastRef.current.pop();
        setData((prev) => ({ ...prev, strokes: prev.strokes.filter((s) => s.id !== id) }));
      }
    }
    pointers.current.delete(e.pointerId);
    pointerPrev.current.delete(e.pointerId);
    drawRef.current = null;
    dragRef.current = null;
    resizeRef.current = null;
    panRef.current = false;
  };

  const onNoteResizeDown = (e, note) => {
    e.stopPropagation();
    e.preventDefault();
    svgRef.current.setPointerCapture?.(e.pointerId);
    pushHistory();
    resizeRef.current = { id: note.id, start: toWorld(e.clientX, e.clientY), original: { ...note } };
  };

  const onNoteEditStart = (n) => {
    if (selectedRef.current !== n.id) setSelectedId(n.id);
    setEditingNoteId(n.id);
  };

  const onNoteTextBlur = (n, draft) => {
    setEditingNoteId(null);
    if (draft === n.text) return;
    pushHistory();
    setData((prev) => ({
      ...prev,
      notes: prev.notes.map((x) => (x.id === n.id ? { ...x, text: draft } : x)),
    }));
  };

  const onWheel = (e) => {
    e.preventDefault();
    const rect = svgRef.current.getBoundingClientRect();
    zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.1 : 1 / 1.1);
  };

  // ---- global keys ----

  useEffect(() => {
    const onKeyDown = (e) => {
      const t = e.target;
      if (t instanceof HTMLElement && t.closest('input, textarea, select, [contenteditable]')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        spaceRef.current = true;
        return;
      }
      if (e.key === 'Escape') {
        setSelectedId(null);
        setEditingNoteId(null);
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedRef.current != null) {
        e.preventDefault();
        deleteSelected();
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };
    const onKeyUp = (e) => {
      if (e.code === 'Space') spaceRef.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [deleteSelected, redo, undo]);

  // ---- layout ----

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // ---- selection / render helpers ----

  const selected = selectedId == null ? null : findItem(selectedId);
  const selBox = (() => {
    if (!selected) return null;
    if (selected.points) {
      const xs = selected.points.map((p) => p[0]);
      const ys = selected.points.map((p) => p[1]);
      return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), note: false };
    }
    if (selected.x1 !== undefined)
      return {
        x: Math.min(selected.x1, selected.x2),
        y: Math.min(selected.y1, selected.y2),
        w: Math.abs(selected.x2 - selected.x1),
        h: Math.abs(selected.y2 - selected.y1),
        note: false,
      };
    return { x: selected.x, y: selected.y, w: selected.w, h: selected.h, note: true };
  })();

  const TOOLS = [
    ['select', 'Select'],
    ['pen', 'Pen'],
    ['note', 'Note'],
    ['arrow', 'Arrow'],
    ['line', 'Line'],
    ['rect', 'Rect'],
    ['eraser', 'Eraser'],
  ];

  const cursor =
    panRef.current || spaceRef.current
      ? 'grabbing'
      : tool === 'select'
        ? 'default'
        : tool === 'eraser'
          ? 'cell'
          : tool === 'note'
            ? 'copy'
            : tool === 'pen'
              ? 'crosshair'
              : 'crosshair';

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TOOLS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => {
              setTool(key);
              setPaletteOpen(false);
              setSelectedId(null);
            }}
            className={`btn ${tool === key ? 'btn-acid' : 'btn-ghost'}`}
          >
            {label}
          </button>
        ))}

        <div className="relative mx-1">
          <button
            className="btn btn-ghost"
            onClick={() => setPaletteOpen((o) => !o)}
            title="Note / ink color"
            aria-label="Note / ink color"
          >
            <span
              className="mr-2 inline-block h-3 w-3 border border-line align-middle"
              style={{ backgroundColor: accentValue(color) }}
            />
            Ink
          </button>
          {paletteOpen && (
            <div className="absolute left-0 z-50 mt-2 grid w-max grid-cols-4 gap-2 border-2 border-line bg-panel p-3 shadow-[4px_4px_0_var(--c-shadow)]">
              {Object.entries(ACCENTS).map(([key, a]) => (
                <button
                  key={key}
                  className={`tap h-6 w-6 border-2 transition-transform hover:scale-110 ${
                    color === key
                      ? 'border-ink shadow-[2px_2px_0_var(--c-shadow)]'
                      : 'border-line/60'
                  }`}
                  style={{ backgroundColor: a.value }}
                  onClick={() => {
                    setColor(key);
                    setPaletteOpen(false);
                  }}
                  title={a.label}
                  aria-label={a.label}
                />
              ))}
            </div>
          )}
        </div>

        <button className="btn btn-ghost" onClick={undo} title="Undo (Ctrl+Z)">
          Undo
        </button>
        <button className="btn btn-ghost" onClick={redo} title="Redo (Ctrl+Shift+Z)">
          Redo
        </button>

        <div className="ml-auto flex items-center gap-1">
          <button className="btn btn-ghost" onClick={() => zoomBy(0.8)} title="Zoom out">
            −
          </button>
          <span className="w-14 text-center font-mono text-[11px] tabular-nums text-dim">
            {Math.round(view.zoom * 100)}%
          </span>
          <button className="btn btn-ghost" onClick={() => zoomBy(1.25)} title="Zoom in">
            +
          </button>
          <button className="btn btn-ghost ml-2" onClick={fitView} title="Fit board to view">
            Fit
          </button>
        </div>
      </div>

      <div
        ref={wrapRef}
        className="hard relative h-[68vh] min-h-[420px] overflow-hidden"
        style={{ touchAction: 'none' }}
      >
        {loading ? (
          <div className="flex h-full items-center justify-center font-mono text-xs uppercase tracking-[0.3em] text-dim">
            Loading…
          </div>
) : size.w > 0 && size.h > 0 ? (
          <svg
            ref={svgRef}
            className="absolute inset-0 h-full w-full"
            viewBox={`${view.panX} ${view.panY} ${size.w / view.zoom} ${size.h / view.zoom}`}
            style={{ cursor, touchAction: 'none' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
            onDoubleClick={(e) => {
              const pt = toWorld(e.clientX, e.clientY);
              const hit = hitTest(pt);
              if (hit && hit.type === 'note') setEditingNoteId(hit.id);
            }}
          >
            <defs>
              <pattern id="wb-grid" width="48" height="48">
                <path
                  d="M48 0H0V48"
                  fill="none"
                  stroke="color-mix(in oklab, var(--c-line) 8%, transparent)"
                  strokeWidth={1 / view.zoom}
                />
              </pattern>
              <marker
                id="wb-arrow"
                viewBox="0 0 10 10"
                refX="7.5"
                refY="5"
                markerWidth={9 / view.zoom}
                markerHeight={9 / view.zoom}
                orient="auto-start-reverse"
              >
                <path d="M0 0L10 5L0 10z" fill="currentColor" />
              </marker>
            </defs>

            <rect
              x={view.panX}
              y={view.panY}
              width={size.w / view.zoom}
              height={size.h / view.zoom}
              fill="url(#wb-grid)"
            />

            {data.shapes.map((s) =>
              s.type === 'rect' ? (
                <rect
                  key={s.id}
                  x={Math.min(s.x1, s.x2)}
                  y={Math.min(s.y1, s.y2)}
                  width={Math.abs(s.x2 - s.x1)}
                  height={Math.abs(s.y2 - s.y1)}
                  fill="none"
                  stroke={accentValue(s.color)}
                  strokeWidth={s.width}
                />
              ) : (
                <line
                  key={s.id}
                  x1={s.x1}
                  y1={s.y1}
                  x2={s.x2}
                  y2={s.y2}
                  stroke={accentValue(s.color)}
                  strokeWidth={s.width}
                  strokeLinecap="round"
                  color={accentValue(s.color)}
                  markerEnd={s.type === 'arrow' ? 'url(#wb-arrow)' : undefined}
                />
              )
            )}

            {data.strokes.map((s) => {
              const pts =
                Array.isArray(s.points) && Array.isArray(s.points[0]) ? s.points : [];
              return pts.length >= 2 ? (
                <polyline
                  key={s.id}
                  points={pts.map((p) => p.join(',')).join(' ')}
                  fill="none"
                  stroke={accentValue(s.color)}
                  strokeWidth={s.width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null;
            })}

            {data.notes.map((n) => (
              <g key={n.id}>
                <rect
                  x={n.x + 4 / view.zoom}
                  y={n.y + 4 / view.zoom}
                  width={n.w}
                  height={n.h}
                  fill="var(--c-shadow)"
                />
                <rect
                  x={n.x}
                  y={n.y}
                  width={n.w}
                  height={n.h}
                  fill={accentValue(n.color)}
                  stroke="var(--c-line)"
                  strokeWidth={2 / view.zoom}
                />
                <foreignObject
                  x={n.x}
                  y={n.y}
                  width={n.w}
                  height={n.h}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 13,
                    lineHeight: 1.45,
                    color: 'oklch(0.15 0.02 95)',
                    overflow: 'hidden',
                  }}
                >
                  {editingNoteId === n.id ? (
                    <textarea
                      style={{
                        width: '100%',
                        height: '100%',
                        resize: 'none',
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        fontFamily: 'inherit',
                        fontSize: 13,
                        lineHeight: 1.45,
                        color: 'inherit',
                        padding: 10,
                        display: 'block',
                        boxSizing: 'border-box',
                      }}
                      defaultValue={n.text}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          e.currentTarget.blur();
                        }
                      }}
                      onBlur={(e) => onNoteTextBlur(n, e.currentTarget.value)}
                      onPointerDown={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div
                      style={{
                        padding: 10,
                        fontFamily: 'inherit',
                        fontSize: 13,
                        lineHeight: 1.45,
                        color: 'inherit',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        pointerEvents: 'none',
                        overflow: 'hidden',
                        height: '100%',
                        boxSizing: 'border-box',
                      }}
                    >
                      {n.text}
                    </div>
                  )}
                </foreignObject>
              </g>
            ))}

            {selBox && view.zoom > 0.5 && (
              <g pointerEvents="none">
                <rect
                  x={selBox.x - 2 / view.zoom}
                  y={selBox.y - 2 / view.zoom}
                  width={selBox.w + 4 / view.zoom}
                  height={selBox.h + 4 / view.zoom}
                  fill="none"
                  stroke="var(--c-acid)"
                  strokeWidth={2 / view.zoom}
                  strokeDasharray={`${4 / view.zoom} ${3 / view.zoom}`}
                />
                {selBox.note && (
                  <rect
                    x={selBox.x + selBox.w - 9 / view.zoom}
                    y={selBox.y + selBox.h - 9 / view.zoom}
                    width={16 / view.zoom}
                    height={16 / view.zoom}
                    fill="var(--c-acid)"
                    stroke="var(--c-ink)"
                    strokeWidth={2 / view.zoom}
                    style={{ cursor: 'nwse-resize', pointerEvents: 'all' }}
                    onPointerDown={(e) => {
                      const note = data.notes.find((n) => n.id === selectedId);
                      if (note) onNoteResizeDown(e, note);
                    }}
                  />
                )}
              </g>
            )}
          </svg>
        ) : null}
      </div>

      <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-dim">
        Double-click a note to edit · drag to move · Delete removes · Space drag to pan · wheel zooms · Ctrl+Z undo
      </p>
    </div>
  );
}