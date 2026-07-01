import { useEffect, useState, type CSSProperties } from 'react';
import type { NotesAppVM } from '../hooks/useNotesApp';
import type { ViewMode } from '../types';

const CLOCKS: { code: string; tz: string }[] = [
  { code: 'PL', tz: 'Europe/Warsaw' },
  { code: 'TH', tz: 'Asia/Bangkok' },
  { code: 'PH', tz: 'Asia/Manila' },
];

function WorldClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
      {CLOCKS.map((c) => {
        const parts = new Intl.DateTimeFormat('en-GB', {
          timeZone: c.tz, weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
        }).formatToParts(now);
        const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
        return (
          <div
            key={c.code}
            title={c.tz}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '0 9px', height: 30, borderRadius: 8,
              background: 'var(--bg-subtle)', font: '500 11px -apple-system,system-ui', color: 'var(--text-muted)', flex: 'none',
            }}
          >
            <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{c.code}</span>
            <span>{get('weekday')}</span>
            <span style={{ font: '11px ui-monospace,Menlo,monospace', color: 'var(--text-secondary)' }}>
              {get('hour')}:{get('minute')}:{get('second')}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function isTauri(): boolean {
  return '__TAURI_INTERNALS__' in window;
}

async function windowControl(action: 'close' | 'minimize' | 'toggleMaximize') {
  if (!isTauri()) return;
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const win = getCurrentWindow();
  await win[action]();
}

const iconBtnStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 30, height: 28, borderRadius: 7, cursor: 'pointer', flex: 'none',
};

function IconBtn({ title, onClick, children, style }: { title: string; onClick: () => void; children: React.ReactNode; style?: CSSProperties }) {
  return (
    <div
      onClick={onClick}
      title={title}
      style={{ ...iconBtnStyle, color: 'var(--text-muted)', fontSize: 16, ...style }}
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
    <div data-tauri-drag-region style={{ display: 'flex', alignItems: 'center', height: 52, background: '#faf9f7', borderBottom: '1px solid rgba(0,0,0,.08)', flex: 'none', padding: '0 16px', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
        <span onClick={() => windowControl('close')} style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57', cursor: 'pointer' }} />
        <span onClick={() => windowControl('minimize')} style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e', cursor: 'pointer' }} />
        <span onClick={() => windowControl('toggleMaximize')} style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840', cursor: 'pointer' }} />
      </div>

      <IconBtn title="Toggle sidebar (⌘\)" onClick={() => setState((s) => ({ collapsed: !s.collapsed }))}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1.5" y="2.5" width="13" height="11" rx="2.5" stroke="var(--text-muted)" strokeWidth="1.3" />
          <line x1="6" y1="2.8" x2="6" y2="13.2" stroke="var(--text-muted)" strokeWidth="1.3" />
        </svg>
      </IconBtn>

      <div
        onClick={() => setState({ paletteOpen: true, paletteQuery: '', paletteIdx: 0 })}
        style={{ flex: 1, maxWidth: 440, height: 30, borderRadius: 8, background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 9, color: 'var(--text-tertiary)', fontSize: 12.5, cursor: 'text' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#ebe8e1'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-subtle)'; }}
      >
        <span style={{ fontSize: 13 }}>⌕</span>Go to file or command
        <span style={{ marginLeft: 'auto', font: '600 10px ui-monospace,Menlo,monospace', color: 'var(--text-faintest)', background: 'var(--bg-surface)', border: '1px solid var(--border)', padding: '2px 6px', borderRadius: 5 }}>⌘K</span>
      </div>

      <WorldClock />

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, flex: 'none' }}>
        <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderRadius: 8, padding: 2, font: '500 11.5px ui-monospace,Menlo,monospace' }}>
          {views.map((v) => (
            <span
              key={v.k}
              onClick={() => setState({ view: v.k })}
              style={{
                padding: '4px 11px', borderRadius: 6, cursor: 'pointer',
                ...(state.view === v.k
                  ? { background: 'var(--bg-surface)', color: 'var(--text-primary)', boxShadow: '0 1px 2px rgba(0,0,0,.1)' }
                  : { color: 'var(--text-muted)' }),
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
            <rect x="1.5" y="2.5" width="13" height="11" rx="2.5" stroke="var(--text-muted)" strokeWidth="1.3" />
            <line x1="10" y1="2.8" x2="10" y2="13.2" stroke="var(--text-muted)" strokeWidth="1.3" />
          </svg>
        </IconBtn>
        <IconBtn title="Settings" onClick={() => setState({ settingsOpen: true })}>⚙</IconBtn>
      </div>
    </div>
  );
}
