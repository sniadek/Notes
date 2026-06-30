import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { NotesAppVM } from '../hooks/useNotesApp';

export default function CommandPalette({ vm }: { vm: NotesAppVM }) {
  const { state, setState, paletteResults, runPaletteResult } = vm;
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (!state.paletteOpen) return null;

  const close = () => setState({ paletteOpen: false });

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setState((s) => ({ paletteIdx: Math.min(s.paletteIdx + 1, paletteResults.length - 1) }));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setState((s) => ({ paletteIdx: Math.max(s.paletteIdx - 1, 0) }));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const r = paletteResults[state.paletteIdx];
      if (r) runPaletteResult(r);
    }
  };

  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(30,28,24,.28)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '13vh', zIndex: 50, animation: 'fade .12s ease' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: '92vw', background: '#fffefb', borderRadius: 14, boxShadow: '0 30px 80px -16px rgba(0,0,0,.45)', border: '1px solid rgba(0,0,0,.08)', overflow: 'hidden', animation: 'pop .14s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '15px 18px', borderBottom: '1px solid rgba(0,0,0,.07)' }}>
          <span style={{ color: '#a8a29a', fontSize: 16 }}>⌕</span>
          <input
            value={state.paletteQuery}
            onChange={(e) => setState({ paletteQuery: e.target.value, paletteIdx: 0 })}
            onKeyDown={onKeyDown}
            ref={vm.paletteInputRef}
            placeholder="Search files, or type a command…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', font: '15px -apple-system,system-ui', color: '#26241f' }}
          />
          <span style={{ font: '600 10px ui-monospace,Menlo,monospace', color: '#bdb8af', background: '#f0eee9', padding: '3px 7px', borderRadius: 5 }}>ESC</span>
        </div>
        <div className="sc" style={{ maxHeight: 340, overflow: 'auto', padding: 7 }}>
          {paletteResults.map((r, i) => (
            <div
              key={r.kind + r.id}
              onClick={() => runPaletteResult(r)}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', borderRadius: 9, cursor: 'pointer',
                background: i === state.paletteIdx ? 'oklch(0.95 0.025 264)' : hoverIdx === i ? '#f7f5f1' : 'transparent',
              }}
            >
              <span style={{ width: 26, textAlign: 'center', font: '600 10px ui-monospace,Menlo,monospace', color: '#a8a29a' }}>{r.icon}</span>
              <span style={{ flex: 1, font: '13.5px -apple-system,system-ui', color: '#26241f' }}>{r.title}</span>
              <span style={{ font: '11px ui-monospace,Menlo,monospace', color: '#bdb8af' }}>{r.hint}</span>
            </div>
          ))}
          {paletteResults.length === 0 && (
            <div style={{ padding: 22, textAlign: 'center', font: '13px -apple-system,system-ui', color: '#bdb8af' }}>No matches</div>
          )}
        </div>
      </div>
    </div>
  );
}
