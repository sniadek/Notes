import { Fragment, useEffect, useRef, useState, type DragEvent } from 'react';
import { createPortal } from 'react-dom';
import type { NotesAppVM } from '../hooks/useNotesApp';

interface MenuAnchor { id: string; left: number; top: number; }
type DropZone = 'before' | 'after';

// Subtle accent used to visually fuse a paired tab + its lock icon + partner tab into one
// group, without disturbing the existing "on" (current tab) background/underline styling.
const PAIR_CAP = 'inset 0 2px 0 oklch(0.55 0.12 var(--accent-hue) / 0.4)';

export default function TabBar({ vm }: { vm: NotesAppVM }) {
  const { state, fileOf, badgeColors, closeTab } = vm;
  const cowork = state.design === 'cowork-plus';
  const activeTabRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [state.activeId]);

  // Which tab's "⋯" menu is open — component-local, mirrors the sidebar's per-row menu state.
  // The menu itself is portaled to <body> and fixed-positioned from this anchor: the tab bar
  // scrolls horizontally (overflowX), which per the CSS spec makes overflowY compute to 'auto'
  // too, clipping any absolutely-positioned child that extends past the 40px-tall bar — so an
  // in-place popover would silently render invisible instead of just "not working".
  const [menu, setMenu] = useState<MenuAnchor | null>(null);
  const [splitSearch, setSplitSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // "All open tabs" panel — same portal-to-<body> approach as the per-tab "⋯" menu, for the
  // same overflow-clipping reason.
  const [tabListAnchor, setTabListAnchor] = useState<{ left: number; top: number } | null>(null);
  const [tabListQuery, setTabListQuery] = useState('');
  const tabListInputRef = useRef<HTMLInputElement | null>(null);

  // Drag-to-reorder — mirrors the sidebar's own drag state pattern (Sidebar.tsx's FileRow),
  // but zones are left/right (before/after) since tabs are a flat horizontal strip, not a tree.
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragZone, setDragZone] = useState<DropZone | null>(null);

  useEffect(() => {
    if (menu) {
      setSplitSearch('');
      setTimeout(() => { try { searchInputRef.current?.focus(); } catch { /* ignore */ } }, 20);
    }
  }, [menu]);

  useEffect(() => {
    if (tabListAnchor) {
      setTabListQuery('');
      setTimeout(() => { try { tabListInputRef.current?.focus(); } catch { /* ignore */ } }, 20);
    }
  }, [tabListAnchor]);

  const panedSplit = !!state.secondaryId;
  const menuFile = menu ? fileOf(menu.id) : undefined;
  const menuPaired = menu ? panedSplit && (menu.id === state.activeId || menu.id === state.secondaryId) : false;

  // Empty search shows currently-open tabs (cheap, focused default); typing searches the
  // whole vault by title/filename so you can split with a note that isn't open yet — pairTabs
  // already opens it if needed, so no separate "open then pair" step is required.
  const q = splitSearch.trim().toLowerCase();
  const splitCandidates = menu
    ? (q
      ? vm.all.filter((f) => f.id !== menu.id && (f.title.toLowerCase().includes(q) || f.file.toLowerCase().includes(q))).slice(0, 8)
      : state.openTabs.filter((t) => t !== menu.id).map((t) => fileOf(t)).filter((f): f is NonNullable<typeof f> => !!f))
    : [];

  const tq = tabListQuery.trim().toLowerCase();
  const openTabFiles = state.openTabs
    .map((id) => ({ id, f: fileOf(id) }))
    .filter((x): x is { id: string; f: NonNullable<typeof x.f> } => !!x.f);
  const tabListResults = tq
    ? openTabFiles.filter(({ f }) => f.title.toLowerCase().includes(tq) || f.file.toLowerCase().includes(tq))
    : openTabFiles;
  const canCloseAll = state.openTabs.length > 0;
  const canCloseOthers = state.openTabs.length > 1 && !!state.activeId;

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', height: 40, background: 'var(--bg-tab)', borderBottom: '1px solid var(--border)', flex: 'none' }}>
    <div className="sc" style={{ display: 'flex', alignItems: 'stretch', flex: '1 1 auto', overflowX: 'auto', minWidth: 0 }}>
      {state.openTabs.map((id, i) => {
        const f = fileOf(id);
        if (!f) return null;
        const paired = panedSplit && (id === state.activeId || id === state.secondaryId);
        // The two paired tabs sit adjacent (openSplit/pairTabs insert the split doc right after
        // the primary) and stay that way — neither their order nor which one is primary/secondary
        // changes on click. At that boundary we render a single lock icon between them; clicking
        // it severs the link.
        const prevId = state.openTabs[i - 1];
        const nextId = state.openTabs[i + 1];
        const isPairPrimary = paired && id === state.activeId && nextId === state.secondaryId;
        const isPairSecondary = paired && id === state.secondaryId && prevId === state.activeId;
        const atPairBoundary = isPairPrimary;
        // The "current" tab highlight follows whichever half of the pair last had interaction
        // focus (secondaryFocused) — a pure UI indicator, distinct from activeId/secondaryId,
        // which stay pinned to their left/right panes regardless of focus.
        const on = paired ? (state.secondaryFocused ? id === state.secondaryId : id === state.activeId) : id === state.activeId;
        const bc = badgeColors[f.type];

        // Compose every box-shadow this tab might need (pair group cap, current-tab underline,
        // drop-indicator edge) into one value — CSS only keeps the last boxShadow it's given,
        // so these can't just be separate conditional style objects like the rest.
        const shadows: string[] = [];
        if (paired) shadows.push(PAIR_CAP);
        if (on && !cowork) shadows.push('inset 0 -2px 0 oklch(0.55 0.12 var(--accent-hue))');
        if (dragOverId === id && dragZone === 'before') shadows.push('inset 2px 0 0 var(--accent)');
        if (dragOverId === id && dragZone === 'after') shadows.push('inset -2px 0 0 var(--accent)');

        return (
          <Fragment key={id}>
            <div
              ref={on ? activeTabRef : undefined}
              draggable
              onDragStart={(e: DragEvent) => e.dataTransfer.setData('text/tab-id', id)}
              onDragOver={(e: DragEvent) => {
                e.preventDefault();
                const rect = e.currentTarget.getBoundingClientRect();
                const zone: DropZone = e.clientX - rect.left < rect.width / 2 ? 'before' : 'after';
                setDragOverId(id);
                setDragZone(zone);
              }}
              onDragLeave={() => { setDragOverId(null); setDragZone(null); }}
              onDrop={(e: DragEvent) => {
                e.preventDefault();
                const draggedId = e.dataTransfer.getData('text/tab-id');
                const zone = dragZone;
                setDragOverId(null);
                setDragZone(null);
                if (draggedId && draggedId !== id && zone) vm.reorderTab(draggedId, id, zone);
              }}
              onClick={() => vm.open(id)}
              title={paired ? 'Shown in split view' : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '0 12px', flex: 'none', cursor: 'pointer',
                borderRight: isPairPrimary ? 'none' : '1px solid var(--border)',
                ...(isPairPrimary ? { borderTopLeftRadius: 8, borderBottomLeftRadius: 8 } : {}),
                ...(isPairSecondary ? { borderTopRightRadius: 8, borderBottomRightRadius: 8 } : {}),
                ...(shadows.length ? { boxShadow: shadows.join(', ') } : {}),
                ...(on
                  ? cowork
                    ? { background: 'var(--bg-surface)', color: 'var(--text-primary)', fontWeight: 600 }
                    : { background: 'var(--bg-surface)', color: 'var(--text-primary)' }
                  : { color: 'var(--text-muted)' }),
              }}
            >
              {cowork
                ? <span style={{ fontSize: 11, color: 'var(--text-faintest)' }}>○</span>
                : <span style={{ font: '600 8px ui-monospace,Menlo,monospace', padding: '1px 3px', borderRadius: 3, color: bc.c, background: bc.b }}>{f.type.toUpperCase()}</span>}
              <span style={{ font: '12px/1 ui-monospace,Menlo,monospace' }}>{f.file}</span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  const tabRect = e.currentTarget.parentElement!.getBoundingClientRect();
                  setMenu((m) => (m?.id === id ? null : { id, left: tabRect.left, top: tabRect.bottom }));
                }}
                title="Tab options"
                style={{ color: 'var(--text-faint)', fontSize: 12, width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-faint)'; }}
              >
                ⋯
              </span>
              <span
                onClick={(e) => { e.stopPropagation(); closeTab(id); }}
                style={{ color: 'var(--text-faint)', fontSize: 13, width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-faint)'; }}
              >
                ×
              </span>
            </div>
            {atPairBoundary && (
              <span
                onClick={(e) => { e.stopPropagation(); vm.closeSplitPane(); }}
                title="Linked — click to unlink split view"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px', color: 'var(--text-faint)', fontSize: 11,
                  flex: 'none', background: 'var(--bg-subtle)', boxShadow: PAIR_CAP, cursor: 'pointer',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)'; }}
              >
                🔒
              </span>
            )}
          </Fragment>
        );
      })}
    </div>
    <div style={{ display: 'flex', alignItems: 'stretch', flex: 'none', borderLeft: '1px solid var(--border)' }}>
      <div
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setTabListAnchor((a) => (a ? null : { left: rect.right - 280, top: rect.bottom }));
        }}
        title="All open tabs"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '0 8px', color: 'var(--text-tertiary)', fontSize: 12, cursor: 'pointer', flex: 'none' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}
      >
        <span>▾</span>
        <span style={{ font: '600 11px ui-monospace,Menlo,monospace', minWidth: 12, textAlign: 'center' }}>{state.openTabs.length}</span>
      </div>
      <div
        onClick={() => vm.setState({ paletteOpen: true, paletteQuery: '', paletteIdx: 0 })}
        title="Open file (⌘K)"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, color: 'var(--text-tertiary)', fontSize: 16, cursor: 'pointer', flex: 'none' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}
      >
        ＋
      </div>
    </div>

      {menu && menuFile && createPortal(
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 29 }} onClick={() => setMenu(null)} />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed', top: menu.top, left: menu.left, zIndex: 30, width: 220, background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 10, boxShadow: '0 16px 44px -12px rgba(0,0,0,.3)', overflow: 'hidden', animation: 'pop .1s ease', padding: 5,
            }}
          >
            <div style={{ font: '600 10px ui-monospace,Menlo,monospace', color: 'var(--text-faint)', letterSpacing: '.05em', padding: '6px 9px 4px' }}>SPLIT WITH</div>
            <input
              ref={searchInputRef}
              value={splitSearch}
              onChange={(e) => setSplitSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setMenu(null);
                else if (e.key === 'Enter' && splitCandidates[0]) { vm.pairTabs(menu.id, splitCandidates[0].id); setMenu(null); }
              }}
              placeholder="Search notes…"
              style={{
                width: 'calc(100% - 18px)', boxSizing: 'border-box', margin: '2px 9px 6px', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 6,
                font: '12.5px -apple-system,system-ui', color: 'var(--text-primary)', background: 'var(--bg-subtle)', outline: 'none',
              }}
            />
            {splitCandidates.length === 0 && (
              <div style={{ padding: '6px 9px 8px', font: '12.5px -apple-system,system-ui', color: 'var(--text-faintest)' }}>
                {q ? 'No matching notes' : 'No other tabs open'}
              </div>
            )}
            {splitCandidates.map((of) => {
              const obc = badgeColors[of.type];
              return (
                <div
                  key={of.id}
                  onClick={() => { vm.pairTabs(menu.id, of.id); setMenu(null); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 7, cursor: 'pointer', font: '12.5px -apple-system,system-ui', color: 'var(--text-primary)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ font: '600 8px ui-monospace,Menlo,monospace', padding: '1px 3px', borderRadius: 3, color: obc.c, background: obc.b, flex: 'none' }}>{of.type.toUpperCase()}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{of.file}</span>
                </div>
              );
            })}
            {menuPaired && (
              <div
                onClick={() => { vm.closeSplitPane(); setMenu(null); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 7, cursor: 'pointer', font: '12.5px -apple-system,system-ui', color: 'var(--text-primary)', borderTop: '1px solid var(--border-soft)', marginTop: 4 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                Unlink split
              </div>
            )}
          </div>
        </>,
        document.body,
      )}

      {tabListAnchor && createPortal(
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 29 }} onClick={() => setTabListAnchor(null)} />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed', top: tabListAnchor.top, left: tabListAnchor.left, zIndex: 30, width: 280, maxHeight: 380, display: 'flex', flexDirection: 'column',
              background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 16px 44px -12px rgba(0,0,0,.3)', overflow: 'hidden', animation: 'pop .1s ease',
            }}
          >
            <div style={{ padding: '8px 9px 6px', flex: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 3px 6px' }}>
                <div style={{ font: '600 10px ui-monospace,Menlo,monospace', color: 'var(--text-faint)', letterSpacing: '.05em' }}>OPEN TABS</div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
                  <span
                    onClick={() => {
                      if (!canCloseOthers) return;
                      vm.closeOtherTabs(state.activeId!);
                      setTabListAnchor(null);
                    }}
                    title="Close all tabs except the active one"
                    style={{
                      font: '500 11px -apple-system,system-ui', padding: '3px 7px', borderRadius: 6,
                      color: canCloseOthers ? 'var(--text-muted)' : 'var(--text-faintest)', cursor: canCloseOthers ? 'pointer' : 'default',
                    }}
                    onMouseEnter={(e) => { if (canCloseOthers) { e.currentTarget.style.background = 'var(--bg-subtle)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                    onMouseLeave={(e) => { if (canCloseOthers) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; } }}
                  >
                    Close Others
                  </span>
                  <span
                    onClick={() => {
                      if (!canCloseAll) return;
                      vm.closeAllTabs();
                      setTabListAnchor(null);
                    }}
                    title="Close all open tabs"
                    style={{
                      font: '500 11px -apple-system,system-ui', padding: '3px 7px', borderRadius: 6,
                      color: canCloseAll ? 'var(--text-muted)' : 'var(--text-faintest)', cursor: canCloseAll ? 'pointer' : 'default',
                    }}
                    onMouseEnter={(e) => { if (canCloseAll) { e.currentTarget.style.background = 'var(--bg-subtle)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                    onMouseLeave={(e) => { if (canCloseAll) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; } }}
                  >
                    Close All
                  </span>
                </div>
              </div>
              <input
                ref={tabListInputRef}
                value={tabListQuery}
                onChange={(e) => setTabListQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setTabListAnchor(null);
                  else if (e.key === 'Enter' && tabListResults[0]) { vm.open(tabListResults[0].id); setTabListAnchor(null); }
                }}
                placeholder="Search open tabs…"
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 6,
                  font: '12.5px -apple-system,system-ui', color: 'var(--text-primary)', background: 'var(--bg-subtle)', outline: 'none',
                }}
              />
            </div>
            <div className="sc" style={{ overflow: 'auto', padding: '0 5px 5px' }}>
              {tabListResults.length === 0 && (
                <div style={{ padding: '6px 9px 8px', font: '12.5px -apple-system,system-ui', color: 'var(--text-faintest)' }}>
                  {tq ? 'No matching tabs' : 'No open tabs'}
                </div>
              )}
              {tabListResults.map(({ id, f }) => {
                const on = id === state.activeId || id === state.secondaryId;
                const tbc = badgeColors[f.type];
                return (
                  <div
                    key={id}
                    onClick={() => { vm.open(id); setTabListAnchor(null); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 7, cursor: 'pointer', font: '12.5px -apple-system,system-ui',
                      ...(on ? { background: 'var(--accent-soft)', color: 'var(--accent-strong)', fontWeight: 500 } : { color: 'var(--text-primary)' }),
                    }}
                    onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'var(--hover)'; }}
                    onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ font: '600 8px ui-monospace,Menlo,monospace', padding: '1px 3px', borderRadius: 3, color: tbc.c, background: tbc.b, flex: 'none' }}>{f.type.toUpperCase()}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.file}</span>
                    <span
                      onClick={(e) => { e.stopPropagation(); closeTab(id); }}
                      style={{ color: 'var(--text-faint)', fontSize: 13, width: 16, height: 16, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4 }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-faint)'; }}
                    >
                      ×
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
