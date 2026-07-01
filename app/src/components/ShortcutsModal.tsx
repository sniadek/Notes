import { useState } from 'react';
import type { NotesAppVM } from '../hooks/useNotesApp';

const SHORTCUTS = [
  { label: 'Command palette / quick open', keys: '⌘K' },
  { label: 'Find & replace', keys: '⌘F' },
  { label: 'Toggle edit / preview', keys: '⌘E' },
  { label: 'Graph view', keys: '⌘G' },
  { label: 'Quick capture', keys: '⌘⇧N' },
  { label: 'Switch to tab 1–9', keys: '⌘1–9' },
  { label: 'Close tab', keys: '⌘W' },
  { label: 'Toggle sidebar', keys: '⌘\\' },
  { label: 'This help', keys: '⌘/' },
];

export default function ShortcutsModal({ vm }: { vm: NotesAppVM }) {
  const { state, setState } = vm;
  const [closeHover, setCloseHover] = useState(false);

  if (!state.shortcutsOpen) return null;

  const close = () => setState({ shortcutsOpen: false });

  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(30,28,24,.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 51, animation: 'fade .12s ease' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 460, maxWidth: '92vw', background: 'var(--bg-surface)', borderRadius: 14, boxShadow: 'var(--shadow-modal)', border: '1px solid rgba(0,0,0,.08)', overflow: 'hidden', animation: 'pop .14s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ font: '600 15px -apple-system,system-ui', color: 'var(--text-primary)' }}>Keyboard shortcuts</div>
          <span
            onClick={close}
            onMouseEnter={() => setCloseHover(true)}
            onMouseLeave={() => setCloseHover(false)}
            style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer', background: closeHover ? 'var(--bg-subtle)' : 'transparent' }}
          >
            ×
          </span>
        </div>
        <div style={{ padding: '8px 20px 18px' }}>
          {SHORTCUTS.map((k) => (
            <div key={k.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,.04)' }}>
              <span style={{ font: '13.5px -apple-system,system-ui', color: 'var(--text-secondary)' }}>{k.label}</span>
              <span style={{ font: '600 11px ui-monospace,Menlo,monospace', color: 'var(--text-muted)', background: 'var(--bg-subtle)', padding: '3px 8px', borderRadius: 6 }}>{k.keys}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
