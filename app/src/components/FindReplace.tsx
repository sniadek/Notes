import { useState } from 'react';
import type { NotesAppVM } from '../hooks/useNotesApp';

export default function FindReplace({ vm }: { vm: NotesAppVM }) {
  const { state, setState } = vm;
  const [closeHover, setCloseHover] = useState(false);

  if (!state.findOpen) return null;

  const regexChip = {
    font: '500 11px ui-monospace,Menlo,monospace', padding: '4px 9px', borderRadius: 7, cursor: 'pointer',
    background: state.findRegex ? 'oklch(0.92 0.045 264)' : '#f0eee9',
    color: state.findRegex ? 'oklch(0.42 0.13 264)' : '#a8a29a',
  } as const;

  return (
    <div style={{ position: 'absolute', top: 80, right: 18, zIndex: 25, width: 340, background: '#fffefb', border: '1px solid rgba(0,0,0,.12)', borderRadius: 11, boxShadow: '0 16px 44px -12px rgba(0,0,0,.32)', padding: 11, animation: 'pop .12s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <input
          value={state.findQuery}
          onChange={(e) => setState({ findQuery: e.target.value })}
          placeholder="Find"
          style={{ flex: 1, border: '1px solid rgba(0,0,0,.12)', borderRadius: 7, padding: '7px 9px', font: '12.5px ui-monospace,Menlo,monospace', color: '#26241f', outline: 'none', background: '#fffefb' }}
        />
        <span style={{ font: '11px ui-monospace,Menlo,monospace', color: '#a8a29a', minWidth: 46, textAlign: 'right' }}>{vm.findCount}</span>
        <span
          onClick={() => setState({ findOpen: false })}
          onMouseEnter={() => setCloseHover(true)}
          onMouseLeave={() => setCloseHover(false)}
          style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, color: '#8a8a8f', cursor: 'pointer', background: closeHover ? '#f0eee9' : 'transparent' }}
        >
          ×
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          value={state.replaceQuery}
          onChange={(e) => setState({ replaceQuery: e.target.value })}
          placeholder="Replace"
          style={{ flex: 1, border: '1px solid rgba(0,0,0,.12)', borderRadius: 7, padding: '7px 9px', font: '12.5px ui-monospace,Menlo,monospace', color: '#26241f', outline: 'none', background: '#fffefb' }}
        />
        <span onClick={vm.replaceAllFn} style={{ font: '500 11.5px -apple-system,system-ui', color: 'oklch(0.45 0.12 264)', background: 'oklch(0.95 0.03 264)', padding: '6px 10px', borderRadius: 7, cursor: 'pointer' }}>
          All
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9 }}>
        <span onClick={() => setState((s) => ({ findRegex: !s.findRegex }))} style={regexChip}>.* regex</span>
        <span onClick={vm.findNextFn} style={{ font: '500 11.5px -apple-system,system-ui', color: '#8a8a8f', cursor: 'pointer' }}>Next ↵</span>
      </div>
    </div>
  );
}
