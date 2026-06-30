import type { CSSProperties } from 'react';
import type { NotesAppVM } from '../hooks/useNotesApp';
import type { NoteFile } from '../types';

const ACCENT_SOFT = 'oklch(0.95 0.025 264)';

interface FilterDef {
  key: string;
  label: string;
  count: number;
  color?: string;
  star?: boolean;
}

function filterDefs(all: NoteFile[]): FilterDef[] {
  const cnt = (fn: (f: NoteFile) => boolean) => all.filter(fn).length;
  return [
    { key: 'all', label: 'All Notes', count: all.length, color: '#8a8a93' },
    { key: 'pinned', label: 'Pinned', count: cnt((f) => f.pinned), star: true },
    { key: 'markdown', label: 'Markdown', count: cnt((f) => f.type === 'md'), color: '#6c7686' },
    { key: 'html', label: 'HTML', count: cnt((f) => f.type === 'html'), color: '#b5651d' },
    { key: 'email', label: 'Email Templates', count: cnt((f) => f.type === 'eml'), color: '#3a6ea5' },
  ];
}

const sectionLabel: CSSProperties = {
  font: '600 10.5px ui-monospace,Menlo,monospace', color: '#b5b0a6', letterSpacing: '.05em', padding: '18px 11px 7px',
};

export default function Sidebar({ vm }: { vm: NotesAppVM }) {
  const { state, setState, all, folders, tagCount, recentDocs, badgeColors, agoLabel } = vm;
  const defs = filterDefs(all);

  if (state.collapsed) {
    return (
      <div style={{ width: 52, background: '#f7f5f1', borderRight: '1px solid rgba(0,0,0,.06)', flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', gap: 4 }}>
        {defs.map((f) => {
          const on = state.filter === f.key;
          return (
            <div
              key={f.key}
              onClick={() => setState({ filter: f.key, collapsed: false })}
              title={f.label}
              style={{ width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: on ? ACCENT_SOFT : 'transparent' }}
            >
              {f.star
                ? <span style={{ color: '#d6a419', fontSize: 14 }}>★</span>
                : <span style={{ width: 11, height: 11, borderRadius: 3, background: f.color, display: 'block' }} />}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="sc" style={{ width: 248, background: '#f7f5f1', borderRight: '1px solid rgba(0,0,0,.06)', overflow: 'auto', flex: 'none', padding: '14px 10px' }}>
      <div style={{ ...sectionLabel, padding: '4px 11px 7px' }}>SMART FILTERS</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {defs.map((f) => {
          const on = state.filter === f.key;
          return (
            <div
              key={f.key}
              onClick={() => setState({ filter: f.key })}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '6px 11px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                ...(on ? { background: ACCENT_SOFT, color: 'oklch(0.45 0.11 264)', fontWeight: 500 } : { color: '#4a4a4c' }),
              }}
            >
              {f.star
                ? <span style={{ color: '#d6a419', fontSize: 12, width: 8, display: 'flex', justifyContent: 'center' }}>★</span>
                : <span style={{ width: 8, height: 8, borderRadius: 2, flex: 'none', background: f.color, display: 'block' }} />}
              <span style={{ flex: 1 }}>{f.label}</span>
              <span style={{ fontSize: 11, color: on ? 'oklch(0.55 0.09 264)' : '#bdb8af' }}>{f.count}</span>
            </div>
          );
        })}
      </div>

      <div style={sectionLabel}>FOLDERS</div>
      {folders.map((g) => (
        <div key={g.name} style={{ marginBottom: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 11px', fontSize: 12.5, color: '#4a4a4c' }}>
            <span style={{ color: '#bdb8af', fontSize: 9 }}>▾</span>
            <svg width="14" height="14" viewBox="0 0 16 16" style={{ flex: 'none' }}>
              <path d="M1.5 4.6c0-.6.4-1 1-1h3.1c.3 0 .5.1.7.3l.8.8c.2.2.4.3.7.3h5.2c.6 0 1 .4 1 1v5.7c0 .6-.4 1-1 1H2.5c-.6 0-1-.4-1-1z" fill="#c9b89a" />
            </svg>
            <span style={{ fontWeight: 500 }}>{g.name}</span>
          </div>
          {g.files.map(({ file, depth }) => {
            const on = file.id === state.activeId;
            const bc = badgeColors[file.type];
            const kids = all.filter((f) => f.parent === file.id);
            const expanded = state.expandedDocs[file.id];
            return (
              <div
                key={file.id}
                onClick={() => vm.open(file.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7, padding: `5px 11px 5px ${30 + depth * 16}px`, borderRadius: 8, fontSize: 12.5, cursor: 'pointer',
                  ...(on ? { background: ACCENT_SOFT, color: 'oklch(0.45 0.11 264)', fontWeight: 500 } : { color: '#6e6e73' }),
                }}
              >
                {kids.length > 0
                  ? (
                    <span
                      onClick={(e) => { e.stopPropagation(); setState((s) => ({ expandedDocs: { ...s.expandedDocs, [file.id]: !s.expandedDocs[file.id] } })); }}
                      style={{ color: '#bdb8af', fontSize: 9, width: 10, flex: 'none', cursor: 'pointer', marginLeft: -15 }}
                    >
                      {expanded ? '▾' : '▸'}
                    </span>
                  )
                  : <span style={{ width: 0, flex: 'none' }} />}
                <span style={{ font: '600 8px ui-monospace,Menlo,monospace', flex: 'none', padding: '1px 3px', borderRadius: 3, color: bc.c, background: bc.b }}>{file.type.toUpperCase()}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.title}</span>
                {file.pinned && <span style={{ color: '#d6a419', fontSize: 10 }}>★</span>}
              </div>
            );
          })}
        </div>
      ))}

      <div style={sectionLabel}>TAGS</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 11px' }}>
        {Object.keys(tagCount).sort().map((t) => {
          const on = state.filter === 'tag:' + t;
          return (
            <span
              key={t}
              onClick={() => setState({ filter: 'tag:' + t })}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, font: '500 11px -apple-system,system-ui', padding: '3px 9px', borderRadius: 11, cursor: 'pointer',
                ...(on ? { background: 'oklch(0.9 0.05 264)', color: 'oklch(0.4 0.13 264)' } : { background: '#ece9e2', color: '#6e6e73' }),
              }}
            >
              #{t}<span style={{ opacity: 0.6 }}>{tagCount[t]}</span>
            </span>
          );
        })}
      </div>

      <div style={sectionLabel}>RECENTLY EDITED</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {recentDocs.map((f) => {
          const on = f.id === state.activeId;
          const bc = badgeColors[f.type];
          return (
            <div
              key={f.id}
              onClick={() => vm.open(f.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 11px', borderRadius: 8, fontSize: 12.5, cursor: 'pointer',
                ...(on ? { background: ACCENT_SOFT, color: 'oklch(0.45 0.11 264)', fontWeight: 500 } : { color: '#6e6e73' }),
              }}
            >
              <span style={{ font: '600 8px ui-monospace,Menlo,monospace', flex: 'none', padding: '1px 3px', borderRadius: 3, color: bc.c, background: bc.b }}>{f.type.toUpperCase()}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.title}</span>
              <span style={{ font: '10.5px ui-monospace,Menlo,monospace', color: '#bdb8af', flex: 'none' }}>{agoLabel(state.editedAt[f.id])}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
