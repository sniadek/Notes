import type { KeyboardEvent } from 'react';
import type { NotesAppVM } from '../hooks/useNotesApp';

export default function CaptureModal({ vm }: { vm: NotesAppVM }) {
  const { state, setState, closeCapture, saveCapture, captureInputRef } = vm;

  if (!state.captureOpen) return null;

  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); saveCapture(); }
  };

  return (
    <div onClick={closeCapture} style={{ position: 'fixed', inset: 0, background: 'rgba(30,28,24,.28)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '16vh', zIndex: 51, animation: 'fade .12s ease' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 520, maxWidth: '92vw', background: 'var(--bg-surface)', borderRadius: 14, boxShadow: 'var(--shadow-modal)', border: '1px solid rgba(0,0,0,.08)', overflow: 'hidden', animation: 'pop .14s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 15 }}>✎</span>
          <span style={{ font: '600 13.5px -apple-system,system-ui', color: 'var(--text-primary)' }}>Quick capture</span>
          <span style={{ marginLeft: 'auto', font: '11px -apple-system,system-ui', color: 'var(--text-tertiary)' }}>appends to today's daily note</span>
        </div>
        <textarea
          value={state.captureText}
          onChange={(e) => setState({ captureText: e.target.value })}
          onKeyDown={onKeyDown}
          ref={captureInputRef}
          placeholder="Jot a thought…"
          style={{ width: '100%', border: 'none', outline: 'none', resize: 'none', padding: '16px 18px', font: '14px/1.6 -apple-system,system-ui', color: 'var(--text-primary)', minHeight: 120, background: 'transparent' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 9, padding: '11px 16px', borderTop: '1px solid var(--border)' }}>
          <span onClick={closeCapture} style={{ font: '500 12.5px -apple-system,system-ui', color: 'var(--text-muted)', padding: '7px 13px', borderRadius: 8, cursor: 'pointer' }}>Cancel</span>
          <span onClick={saveCapture} style={{ font: '500 12.5px -apple-system,system-ui', color: '#fff', background: 'oklch(0.5 0.12 var(--accent-hue))', padding: '7px 15px', borderRadius: 8, cursor: 'pointer' }}>Save ⌘↵</span>
        </div>
      </div>
    </div>
  );
}
