import { Fragment, useEffect, useRef } from 'react';
import type { NotesAppVM } from '../hooks/useNotesApp';
import type { ViewMode } from '../types';

const SPLIT_VIEWS: { k: ViewMode; label: string }[] = [
  { k: 'edit', label: 'edit' },
  { k: 'split', label: 'split' },
  { k: 'preview', label: 'preview' },
];

const lockStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: 11, flex: 'none',
} as const;

export default function TabBar({ vm }: { vm: NotesAppVM }) {
  const { state, setState, fileOf, badgeColors, closeTab } = vm;
  const cowork = state.design === 'cowork-plus';
  const activeTabRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [state.activeId]);

  const panedSplit = !!state.secondaryId;

  return (
    <div className="sc" style={{ display: 'flex', alignItems: 'stretch', height: 40, background: 'var(--bg-tab)', borderBottom: '1px solid var(--border)', flex: 'none', overflowX: 'auto' }}>
      {state.openTabs.map((id, i) => {
        const f = fileOf(id);
        if (!f) return null;
        const on = id === state.activeId;
        const paired = panedSplit && (id === state.activeId || id === state.secondaryId);
        const bc = badgeColors[f.type];
        // The two paired tabs sit adjacent (openSplit inserts the split doc right after the
        // primary). At that boundary we render two lock icons — one trailing the first tab,
        // one standalone before the second — to signal they're shown together in a shared view.
        const nextId = state.openTabs[i + 1];
        const atPairBoundary = panedSplit
          && ((id === state.activeId && nextId === state.secondaryId) || (id === state.secondaryId && nextId === state.activeId));
        return (
          <Fragment key={id}>
            <div
              ref={on ? activeTabRef : undefined}
              onClick={() => setState({ activeId: id })}
              title={paired ? 'Shown in split view' : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '0 12px', flex: 'none', cursor: 'pointer', borderRight: '1px solid var(--border)',
                ...(on
                  ? cowork
                    ? { background: 'var(--bg-surface)', color: 'var(--text-primary)', fontWeight: 600 }
                    : { background: 'var(--bg-surface)', color: 'var(--text-primary)', boxShadow: 'inset 0 -2px 0 oklch(0.55 0.12 var(--accent-hue))' }
                  : paired
                    ? { background: 'oklch(0.96 0.025 var(--accent-hue))', color: 'var(--text-secondary)' }
                    : { color: 'var(--text-muted)' }),
              }}
            >
              {paired && !atPairBoundary && <span style={{ fontSize: 10, color: 'oklch(0.5 0.12 var(--accent-hue))' }} title="Shown in split view">⧉</span>}
              {cowork
                ? <span style={{ fontSize: 11, color: 'var(--text-faintest)' }}>○</span>
                : <span style={{ font: '600 8px ui-monospace,Menlo,monospace', padding: '1px 3px', borderRadius: 3, color: bc.c, background: bc.b }}>{f.type.toUpperCase()}</span>}
              <span style={{ font: '12px/1 ui-monospace,Menlo,monospace' }}>{f.file}</span>
              {atPairBoundary && <span style={lockStyle} title="Linked — shown in shared view">🔒</span>}
              <span
                onClick={(e) => { e.stopPropagation(); closeTab(id); }}
                style={{ marginLeft: 4, color: 'var(--text-faint)', fontSize: 13, width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-faint)'; }}
              >
                ×
              </span>
            </div>
            {atPairBoundary && (
              <span style={{ ...lockStyle, padding: '0 4px', borderRight: '1px solid var(--border)' }} title="Synced in shared view">🔒</span>
            )}
          </Fragment>
        );
      })}
      <div
        onClick={() => setState({ paletteOpen: true, paletteQuery: '', paletteIdx: 0 })}
        title="Open file (⌘K)"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, color: 'var(--text-tertiary)', fontSize: 16, cursor: 'pointer', flex: 'none' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}
      >
        ＋
      </div>

      {panedSplit && (
        <>
          <div style={{ flex: 1, minWidth: 12 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', flex: 'none' }}>
            <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderRadius: 8, padding: 2, font: '500 10.5px ui-monospace,Menlo,monospace' }}>
              {SPLIT_VIEWS.map((v) => (
                <span
                  key={v.k}
                  onClick={() => setState({ secondaryView: v.k })}
                  title="Split pane view"
                  style={{
                    padding: '3px 9px', borderRadius: 6, cursor: 'pointer',
                    ...(state.secondaryView === v.k ? { background: 'var(--bg-surface)', color: 'var(--text-primary)' } : { color: 'var(--text-muted)' }),
                  }}
                >
                  {v.label}
                </span>
              ))}
            </div>
            <span
              onClick={vm.closeSplitPane}
              title="Close split pane"
              style={{ color: 'var(--text-faint)', fontSize: 14, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, cursor: 'pointer', flex: 'none' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-faint)'; }}
            >
              ×
            </span>
          </div>
        </>
      )}
    </div>
  );
}
