import type { CSSProperties } from 'react';
import type { NotesAppVM } from '../hooks/useNotesApp';
import type { ViewMode } from '../types';

const iconBtnStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 30, height: 28, borderRadius: 7, cursor: 'pointer', flex: 'none',
};

function IconBtn({ title, onClick, children, style }: { title: string; onClick: () => void; children: React.ReactNode; style?: CSSProperties }) {
  return (
    <div
      onClick={onClick}
      title={title}
      style={{ ...iconBtnStyle, color: '#8a8a8f', fontSize: 16, ...style }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#efece6'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = style?.background as string || 'transparent'; }}
    >
      {children}
    </div>
  );
}

export default function Toolbar({ vm }: { vm: NotesAppVM }) {
  const { state, setState, active } = vm;
  const views: { k: ViewMode; label: string }[] = [
    { k: 'edit', label: 'edit' },
    { k: 'split', label: 'split' },
    { k: 'preview', label: 'preview' },
  ];
  const railOn = !state.railHidden && vm.showRightSidebar && !!active;

  return (
    <div style={{ display: 'flex', alignItems: 'center', height: 52, background: '#faf9f7', borderBottom: '1px solid rgba(0,0,0,.08)', flex: 'none', padding: '0 16px', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57' }} />
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e' }} />
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840' }} />
      </div>

      <IconBtn title="Toggle sidebar (⌘\)" onClick={() => setState((s) => ({ collapsed: !s.collapsed }))}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1.5" y="2.5" width="13" height="11" rx="2.5" stroke="#8a8a8f" strokeWidth="1.3" />
          <line x1="6" y1="2.8" x2="6" y2="13.2" stroke="#8a8a8f" strokeWidth="1.3" />
        </svg>
      </IconBtn>

      <div
        onClick={() => setState({ paletteOpen: true, paletteQuery: '', paletteIdx: 0 })}
        style={{ flex: 1, maxWidth: 440, height: 30, borderRadius: 8, background: '#f0eee9', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 9, color: '#a8a29a', fontSize: 12.5, cursor: 'text' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#ebe8e1'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = '#f0eee9'; }}
      >
        <span style={{ fontSize: 13 }}>⌕</span>Go to file or command
        <span style={{ marginLeft: 'auto', font: '600 10px ui-monospace,Menlo,monospace', color: '#bdb8af', background: '#fffefb', border: '1px solid rgba(0,0,0,.07)', padding: '2px 6px', borderRadius: 5 }}>⌘K</span>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, flex: 'none' }}>
        <div style={{ display: 'flex', background: '#f0eee9', borderRadius: 8, padding: 2, font: '500 11.5px ui-monospace,Menlo,monospace' }}>
          {views.map((v) => (
            <span
              key={v.k}
              onClick={() => setState({ view: v.k })}
              style={{
                padding: '4px 11px', borderRadius: 6, cursor: 'pointer',
                ...(state.view === v.k
                  ? { background: '#fffefb', color: '#26241f', boxShadow: '0 1px 2px rgba(0,0,0,.1)' }
                  : { color: '#8a8a8f' }),
              }}
            >
              {v.label}
            </span>
          ))}
        </div>
        <IconBtn title="Quick capture (⌘⇧N)" onClick={vm.openCapture} style={{ fontSize: 15 }}>✎</IconBtn>
        <IconBtn title="Graph view (⌘G)" onClick={() => setState({ graphOpen: true })}>⬡</IconBtn>
        <IconBtn
          title="Toggle right sidebar (⌘⇧\)"
          onClick={() => setState((s) => ({ railHidden: !s.railHidden }))}
          style={railOn ? { background: vm.accentSoft } : undefined}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1.5" y="2.5" width="13" height="11" rx="2.5" stroke="#8a8a8f" strokeWidth="1.3" />
            <line x1="10" y1="2.8" x2="10" y2="13.2" stroke="#8a8a8f" strokeWidth="1.3" />
          </svg>
        </IconBtn>
        <IconBtn title="Settings" onClick={() => setState({ settingsOpen: true })}>⚙</IconBtn>
      </div>
    </div>
  );
}
