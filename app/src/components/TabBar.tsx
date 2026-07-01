import { useEffect, useRef } from 'react';
import type { NotesAppVM } from '../hooks/useNotesApp';

export default function TabBar({ vm }: { vm: NotesAppVM }) {
  const { state, setState, fileOf, badgeColors, closeTab } = vm;
  const cowork = state.design === 'cowork-plus';
  const activeTabRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [state.activeId]);

  return (
    <div className="sc" style={{ display: 'flex', alignItems: 'stretch', height: 40, background: '#f3f1ec', borderBottom: '1px solid var(--border)', flex: 'none', overflowX: 'auto' }}>
      {state.openTabs.map((id) => {
        const f = fileOf(id);
        if (!f) return null;
        const on = id === state.activeId;
        const bc = badgeColors[f.type];
        return (
          <div
            key={id}
            ref={on ? activeTabRef : undefined}
            onClick={() => setState({ activeId: id })}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '0 12px', flex: 'none', cursor: 'pointer', borderRight: '1px solid rgba(0,0,0,.06)',
              ...(on
                ? cowork
                  ? { background: 'var(--bg-surface)', color: 'var(--text-primary)', fontWeight: 600 }
                  : { background: 'var(--bg-surface)', color: 'var(--text-primary)', boxShadow: 'inset 0 -2px 0 oklch(0.55 0.12 var(--accent-hue))' }
                : { color: 'var(--text-muted)' }),
            }}
          >
            {cowork
              ? <span style={{ fontSize: 11, color: 'var(--text-faintest)' }}>○</span>
              : <span style={{ font: '600 8px ui-monospace,Menlo,monospace', padding: '1px 3px', borderRadius: 3, color: bc.c, background: bc.b }}>{f.type.toUpperCase()}</span>}
            <span style={{ font: '12px/1 ui-monospace,Menlo,monospace' }}>{f.file}</span>
            <span
              onClick={(e) => { e.stopPropagation(); closeTab(id); }}
              style={{ marginLeft: 4, color: 'var(--text-faint)', fontSize: 13, width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,.08)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-faint)'; }}
            >
              ×
            </span>
          </div>
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
    </div>
  );
}
