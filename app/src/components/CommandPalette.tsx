import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { NotesAppVM } from '../hooks/useNotesApp';

export default function CommandPalette({ vm }: { vm: NotesAppVM }) {
  const { state, setState, paletteResults, runPaletteResult } = vm;
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const cowork = state.design === 'cowork' || state.design === 'cowork-plus';

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
      <div role="dialog" aria-modal="true" aria-label="Command palette" onClick={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: '92vw', background: 'var(--bg-surface)', borderRadius: cowork ? 24 : 14, boxShadow: 'var(--shadow-modal)', border: '1px solid rgba(0,0,0,.08)', overflow: 'hidden', animation: 'pop .14s ease' }}>
        <div style={{ padding: cowork ? '14px 14px 10px' : 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 11, padding: '15px 18px',
            ...(cowork
              ? { background: 'var(--bg-subtle)', borderRadius: 'var(--radius-pill)' }
              : { borderBottom: '1px solid var(--border)' }),
          }}
          >
            <span style={{ color: 'var(--text-tertiary)', fontSize: 16 }}>⌕</span>
            <input
              value={state.paletteQuery}
              onChange={(e) => setState({ paletteQuery: e.target.value, paletteIdx: 0 })}
              onKeyDown={onKeyDown}
              ref={vm.paletteInputRef}
              placeholder="Search files, or type a command…"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', font: '15px -apple-system,system-ui', color: 'var(--text-primary)' }}
            />
            <span style={{ font: '600 10px ui-monospace,Menlo,monospace', color: 'var(--text-faintest)', background: 'var(--bg-subtle)', padding: '3px 7px', borderRadius: 5 }}>ESC</span>
          </div>
        </div>
        <div className="sc" tabIndex={0} style={{ maxHeight: 340, overflow: 'auto', padding: 7 }}>
          {paletteResults.map((r, i) => (
            <div
              key={r.kind + r.id}
              onClick={() => runPaletteResult(r)}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', borderRadius: 9, cursor: 'pointer',
                background: i === state.paletteIdx ? 'var(--accent-soft)' : hoverIdx === i ? '#f7f5f1' : 'transparent',
              }}
            >
              <span style={{ width: 26, textAlign: 'center', font: '600 10px ui-monospace,Menlo,monospace', color: 'var(--text-tertiary)' }}>{r.icon}</span>
              <span style={{ flex: 1, font: '13.5px -apple-system,system-ui', color: 'var(--text-primary)' }}>{r.title}</span>
              <span style={{ font: '11px ui-monospace,Menlo,monospace', color: 'var(--text-faintest)' }}>{r.hint}</span>
            </div>
          ))}
          {paletteResults.length === 0 && (
            <div style={{ padding: 22, textAlign: 'center', font: '13px -apple-system,system-ui', color: 'var(--text-faintest)' }}>No matches</div>
          )}
        </div>
      </div>
    </div>
  );
}
