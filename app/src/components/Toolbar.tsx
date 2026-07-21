import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { NotesAppVM } from '../hooks/useNotesApp';
import type { ViewMode } from '../types';

const CLOCKS: { code: string; tz: string }[] = [
  { code: 'PL', tz: 'Europe/Warsaw' },
  { code: 'TH', tz: 'Asia/Bangkok' },
  { code: 'PH', tz: 'Asia/Manila' },
];

function useWindowWidth() {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return width;
}

function WorldClock({ hideWeekday, hideSeconds }: { hideWeekday: boolean; hideSeconds: boolean }) {
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
            {!hideWeekday && <span>{get('weekday')}</span>}
            <span style={{ font: '11px ui-monospace,Menlo,monospace', color: 'var(--text-secondary)' }}>
              {get('hour')}:{get('minute')}{!hideSeconds && `:${get('second')}`}
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

type TileKey =
  | 'left-half' | 'right-half' | 'top-half' | 'bottom-half'
  | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  | 'fill' | 'center' | 'restore';

type TileRect = [number, number, number, number]; // fractional x, y, w, h

const MOVE_RESIZE: { key: TileKey; label: string; rect: TileRect }[] = [
  { key: 'left-half', label: 'Left Half', rect: [0, 0, 0.5, 1] },
  { key: 'right-half', label: 'Right Half', rect: [0.5, 0, 0.5, 1] },
  { key: 'top-half', label: 'Top Half', rect: [0, 0, 1, 0.5] },
  { key: 'bottom-half', label: 'Bottom Half', rect: [0, 0.5, 1, 0.5] },
  { key: 'top-left', label: 'Top Left', rect: [0, 0, 0.5, 0.5] },
  { key: 'top-right', label: 'Top Right', rect: [0.5, 0, 0.5, 0.5] },
  { key: 'bottom-left', label: 'Bottom Left', rect: [0, 0.5, 0.5, 0.5] },
  { key: 'bottom-right', label: 'Bottom Right', rect: [0.5, 0.5, 0.5, 0.5] },
];

const FILL_ARRANGE: { key: TileKey; label: string; rect: TileRect }[] = [
  { key: 'fill', label: 'Fill Screen', rect: [0, 0, 1, 1] },
  { key: 'center', label: 'Center', rect: [0.18, 0.18, 0.64, 0.64] },
];

// Rect of the window before the last tile/fill action, so "Return to Previous Size" can undo it.
let savedRect: { x: number; y: number; width: number; height: number } | null = null;

async function applyTile(key: TileKey) {
  if (!isTauri()) return;
  const { getCurrentWindow, currentMonitor, PhysicalPosition, PhysicalSize } = await import('@tauri-apps/api/window');
  const win = getCurrentWindow();

  if (key === 'restore') {
    if (!savedRect) return;
    const r = savedRect;
    savedRect = null;
    await win.setSize(new PhysicalSize(r.width, r.height));
    await win.setPosition(new PhysicalPosition(r.x, r.y));
    return;
  }

  const monitor = await currentMonitor();
  if (!monitor) return;
  const { position, size } = monitor.workArea;
  const fullX = position.x, fullY = position.y, fullW = size.width, fullH = size.height;
  const halfW = Math.round(fullW / 2), halfH = Math.round(fullH / 2);

  let rect: { x: number; y: number; width: number; height: number };
  switch (key) {
    case 'left-half': rect = { x: fullX, y: fullY, width: halfW, height: fullH }; break;
    case 'right-half': rect = { x: fullX + fullW - halfW, y: fullY, width: halfW, height: fullH }; break;
    case 'top-half': rect = { x: fullX, y: fullY, width: fullW, height: halfH }; break;
    case 'bottom-half': rect = { x: fullX, y: fullY + fullH - halfH, width: fullW, height: halfH }; break;
    case 'top-left': rect = { x: fullX, y: fullY, width: halfW, height: halfH }; break;
    case 'top-right': rect = { x: fullX + fullW - halfW, y: fullY, width: halfW, height: halfH }; break;
    case 'bottom-left': rect = { x: fullX, y: fullY + fullH - halfH, width: halfW, height: halfH }; break;
    case 'bottom-right': rect = { x: fullX + fullW - halfW, y: fullY + fullH - halfH, width: halfW, height: halfH }; break;
    case 'fill': rect = { x: fullX, y: fullY, width: fullW, height: fullH }; break;
    case 'center': {
      const cur = await win.outerSize();
      const w = Math.min(cur.width, fullW), h = Math.min(cur.height, fullH);
      rect = { x: fullX + Math.round((fullW - w) / 2), y: fullY + Math.round((fullH - h) / 2), width: w, height: h };
      break;
    }
    default: return;
  }

  const beforePos = await win.outerPosition();
  const beforeSize = await win.outerSize();
  savedRect = { x: beforePos.x, y: beforePos.y, width: beforeSize.width, height: beforeSize.height };

  await win.setSize(new PhysicalSize(rect.width, rect.height));
  await win.setPosition(new PhysicalPosition(rect.x, rect.y));
}

function TileIcon({ rect }: { rect: TileRect }) {
  const W = 28, H = 18;
  const [x, y, w, h] = rect;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" style={{ flex: 'none' }}>
      <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={3} stroke="var(--border)" strokeWidth="1" fill="var(--bg-subtle)" />
      <rect x={x * (W - 3) + 1.5} y={y * (H - 3) + 1.5} width={Math.max(w * (W - 3), 2)} height={Math.max(h * (H - 3), 2)} rx={1.5} fill="var(--accent)" />
    </svg>
  );
}

function TileRow({ label, rect, onSelect, disabled }: { label: string; rect: TileRect; onSelect: () => void; disabled?: boolean }) {
  return (
    <div
      onClick={disabled ? undefined : onSelect}
      title={label}
      style={{
        display: 'flex', alignItems: 'center', gap: 9, padding: '5px 9px', borderRadius: 6, font: '400 12.5px -apple-system,system-ui',
        cursor: disabled ? 'default' : 'pointer', color: disabled ? 'var(--text-faintest)' : 'var(--text-secondary)', opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = 'var(--hover)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <TileIcon rect={rect} />
      <span>{label}</span>
    </div>
  );
}

const sectionLabelStyle: CSSProperties = { font: '600 10px ui-monospace,Menlo,monospace', color: 'var(--text-faint)', letterSpacing: '.05em', padding: '7px 9px 3px' };

function ZoomButton() {
  const dotRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);

  const clearTimers = () => {
    if (openTimer.current !== null) { window.clearTimeout(openTimer.current); openTimer.current = null; }
    if (closeTimer.current !== null) { window.clearTimeout(closeTimer.current); closeTimer.current = null; }
  };

  useEffect(() => () => clearTimers(), []);

  const scheduleOpen = () => {
    if (closeTimer.current !== null) { window.clearTimeout(closeTimer.current); closeTimer.current = null; }
    if (open || openTimer.current !== null) return;
    openTimer.current = window.setTimeout(() => {
      openTimer.current = null;
      const r = dotRef.current?.getBoundingClientRect();
      if (r) setAnchor({ top: r.bottom + 8, left: r.left - 6 });
      setOpen(true);
    }, 380);
  };

  const scheduleClose = () => {
    if (openTimer.current !== null) { window.clearTimeout(openTimer.current); openTimer.current = null; }
    if (closeTimer.current !== null) return;
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      setOpen(false);
    }, 200);
  };

  const select = (key: TileKey) => {
    clearTimers();
    setOpen(false);
    void applyTile(key);
  };

  const canRestore = savedRect !== null;

  return (
    <>
      <span
        ref={dotRef}
        onClick={() => { clearTimers(); setOpen(false); void windowControl('toggleMaximize'); }}
        onMouseEnter={scheduleOpen}
        onMouseLeave={scheduleClose}
        style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840', cursor: 'pointer' }}
      />
      {open && anchor && createPortal(
        <div
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={() => { if (closeTimer.current !== null) { window.clearTimeout(closeTimer.current); closeTimer.current = null; } }}
          onMouseLeave={scheduleClose}
          style={{
            position: 'fixed', top: anchor.top, left: anchor.left, zIndex: 60, width: 190, background: 'var(--bg-surface)',
            border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 16px 44px -12px rgba(0,0,0,.3)', overflow: 'hidden', animation: 'pop .1s ease', padding: 5,
          }}
        >
          <div style={sectionLabelStyle}>MOVE & RESIZE</div>
          {MOVE_RESIZE.map((t) => (
            <TileRow key={t.key} label={t.label} rect={t.rect} onSelect={() => select(t.key)} />
          ))}
          <div style={{ height: 1, background: 'var(--border-soft)', margin: '5px 4px' }} />
          <div style={sectionLabelStyle}>FILL & ARRANGE</div>
          {FILL_ARRANGE.map((t) => (
            <TileRow key={t.key} label={t.label} rect={t.rect} onSelect={() => select(t.key)} />
          ))}
          <TileRow
            label="Return to Previous Size"
            rect={[0.3, 0.3, 0.4, 0.4]}
            disabled={!canRestore}
            onSelect={() => select('restore')}
          />
        </div>,
        document.body,
      )}
    </>
  );
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
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = style?.background as string || 'transparent'; }}
    >
      {children}
    </div>
  );
}

const BP_COMPACT_SEARCH = 1100;
const BP_HIDE_WEEKDAY = 950;
const BP_HIDE_SECONDS = 870;
const BP_HIDE_CLOCKS = 810;

export default function Toolbar({ vm }: { vm: NotesAppVM }) {
  const { state, setState, active } = vm;
  const width = useWindowWidth();
  const compactSearch = width < BP_COMPACT_SEARCH;
  const hideWeekday = width < BP_HIDE_WEEKDAY;
  const hideSeconds = width < BP_HIDE_SECONDS;
  const hideClocks = width < BP_HIDE_CLOCKS;
  const views: { k: ViewMode; label: string }[] = [
    { k: 'edit', label: 'edit' },
    { k: 'split', label: 'split' },
    { k: 'preview', label: 'preview' },
  ];
  const railOn = !state.railHidden && vm.showRightSidebar && !!active;
  // The edit/split/preview toggle has no effect on a PDF or image (always preview-only), so hide
  // it when the focused tab (whichever one Toolbar controls) is one.
  const focusedFile = (state.secondaryFocused && vm.secondary.file) ? vm.secondary.file : active;
  const showViewToggle = focusedFile?.type !== 'pdf' && focusedFile?.type !== 'image';

  return (
    <header data-tauri-drag-region style={{ display: 'flex', alignItems: 'center', height: 52, background: 'var(--bg-bar)', borderBottom: '1px solid var(--border)', flex: 'none', padding: '0 16px', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
        <span onClick={() => windowControl('close')} style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57', cursor: 'pointer' }} />
        <span onClick={() => windowControl('minimize')} style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e', cursor: 'pointer' }} />
        <ZoomButton />
      </div>

      <IconBtn title="Left Half" onClick={() => void applyTile('left-half')}>
        <TileIcon rect={[0, 0, 0.5, 1]} />
      </IconBtn>
      <IconBtn title="Fill Screen" onClick={() => void applyTile('fill')}>
        <TileIcon rect={[0, 0, 1, 1]} />
      </IconBtn>

      <IconBtn title="Toggle sidebar (⌘\)" onClick={() => setState((s) => ({ collapsed: !s.collapsed }))}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1.5" y="2.5" width="13" height="11" rx="2.5" stroke="var(--text-muted)" strokeWidth="1.3" />
          <line x1="6" y1="2.8" x2="6" y2="13.2" stroke="var(--text-muted)" strokeWidth="1.3" />
        </svg>
      </IconBtn>

      {compactSearch ? (
        <IconBtn title="Go to file or command (⌘K)" onClick={() => setState({ paletteOpen: true, paletteQuery: '', paletteIdx: 0, paletteScope: 'all' })} style={{ fontSize: 13 }}>⌕</IconBtn>
      ) : (
        <div
          onClick={() => setState({ paletteOpen: true, paletteQuery: '', paletteIdx: 0, paletteScope: 'all' })}
          style={{ flex: 1, minWidth: 0, maxWidth: 440, height: 30, borderRadius: 8, background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 9, color: 'var(--text-tertiary)', fontSize: 12.5, cursor: 'text', overflow: 'hidden' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-subtle)'; }}
        >
          <span style={{ fontSize: 13, flex: 'none' }}>⌕</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Go to file or command</span>
          <span style={{ marginLeft: 'auto', flex: 'none', font: '600 10px ui-monospace,Menlo,monospace', color: 'var(--text-faintest)', background: 'var(--bg-surface)', border: '1px solid var(--border)', padding: '2px 6px', borderRadius: 5 }}>⌘K</span>
        </div>
      )}

      {!hideClocks && <WorldClock hideWeekday={hideWeekday} hideSeconds={hideSeconds} />}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, flex: 'none' }}>
        {showViewToggle && (
        <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderRadius: 8, padding: 2, font: '500 11.5px ui-monospace,Menlo,monospace' }}>
          {views.map((v) => (
            <span
              key={v.k}
              onClick={() => vm.setView(v.k)}
              style={{
                padding: '4px 11px', borderRadius: 6, cursor: 'pointer',
                ...(vm.currentView === v.k
                  ? { background: 'var(--bg-surface)', color: 'var(--text-primary)', boxShadow: '0 1px 2px rgba(0,0,0,.1)' }
                  : { color: 'var(--text-muted)' }),
              }}
            >
              {v.label}
            </span>
          ))}
        </div>
        )}
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
    </header>
  );
}
