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
      <div onClick={(e) => e.stopPropagation()} style={{ width: 460, maxWidth: '92vw', background: '#fffefb', borderRadius: 14, boxShadow: '0 30px 80px -16px rgba(0,0,0,.45)', border: '1px solid rgba(0,0,0,.08)', overflow: 'hidden', animation: 'pop .14s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,.07)' }}>
          <div style={{ font: '600 15px -apple-system,system-ui', color: '#26241f' }}>Keyboard shortcuts</div>
          <span
            onClick={close}
            onMouseEnter={() => setCloseHover(true)}
            onMouseLeave={() => setCloseHover(false)}
            style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, color: '#8a8a8f', fontSize: 16, cursor: 'pointer', background: closeHover ? '#f0eee9' : 'transparent' }}
          >
            ×
          </span>
        </div>
        <div style={{ padding: '8px 20px 18px' }}>
          {SHORTCUTS.map((k) => (
            <div key={k.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,.04)' }}>
              <span style={{ font: '13.5px -apple-system,system-ui', color: '#403d37' }}>{k.label}</span>
              <span style={{ font: '600 11px ui-monospace,Menlo,monospace', color: '#8a8a8f', background: '#f0eee9', padding: '3px 8px', borderRadius: 6 }}>{k.keys}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
