import { useState } from 'react';
import type { NotesAppVM } from '../hooks/useNotesApp';

export default function FindReplace({ vm }: { vm: NotesAppVM }) {
  const { state, setState } = vm;
  const [closeHover, setCloseHover] = useState(false);

  if (!state.findOpen) return null;

  const regexChip = {
    font: '500 11px ui-monospace,Menlo,monospace', padding: '4px 9px', borderRadius: 7, cursor: 'pointer',
    background: state.findRegex ? 'oklch(0.92 0.045 var(--accent-hue))' : 'var(--bg-subtle)',
    color: state.findRegex ? 'oklch(0.42 0.13 var(--accent-hue))' : 'var(--text-tertiary)',
  } as const;

  return (
    <div style={{ position: 'absolute', top: 80, right: 18, zIndex: 25, width: 340, background: 'var(--bg-surface)', border: '1px solid rgba(0,0,0,.12)', borderRadius: 11, boxShadow: '0 16px 44px -12px rgba(0,0,0,.32)', padding: 11, animation: 'pop .12s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <input
          value={state.findQuery}
          onChange={(e) => setState({ findQuery: e.target.value })}
          placeholder="Find"
          style={{ flex: 1, border: '1px solid rgba(0,0,0,.12)', borderRadius: 7, padding: '7px 9px', font: '12.5px ui-monospace,Menlo,monospace', color: 'var(--text-primary)', outline: 'none', background: 'var(--bg-surface)' }}
        />
        <span style={{ font: '11px ui-monospace,Menlo,monospace', color: 'var(--text-tertiary)', minWidth: 46, textAlign: 'right' }}>{vm.findCount}</span>
        <span
          onClick={() => setState({ findOpen: false })}
          onMouseEnter={() => setCloseHover(true)}
          onMouseLeave={() => setCloseHover(false)}
          style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, color: 'var(--text-muted)', cursor: 'pointer', background: closeHover ? 'var(--bg-subtle)' : 'transparent' }}
        >
          ×
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          value={state.replaceQuery}
          onChange={(e) => setState({ replaceQuery: e.target.value })}
          placeholder="Replace"
          style={{ flex: 1, border: '1px solid rgba(0,0,0,.12)', borderRadius: 7, padding: '7px 9px', font: '12.5px ui-monospace,Menlo,monospace', color: 'var(--text-primary)', outline: 'none', background: 'var(--bg-surface)' }}
        />
        <span onClick={vm.replaceAllFn} style={{ font: '500 11.5px -apple-system,system-ui', color: 'oklch(0.45 0.12 var(--accent-hue))', background: 'oklch(0.95 0.03 var(--accent-hue))', padding: '6px 10px', borderRadius: 7, cursor: 'pointer' }}>
          All
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9 }}>
        <span onClick={() => setState((s) => ({ findRegex: !s.findRegex }))} style={regexChip}>.* regex</span>
        <span onClick={vm.findNextFn} style={{ font: '500 11.5px -apple-system,system-ui', color: 'var(--text-muted)', cursor: 'pointer' }}>Next ↵</span>
      </div>
    </div>
  );
}
