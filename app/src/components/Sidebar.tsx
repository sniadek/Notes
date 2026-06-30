import { useState, type CSSProperties, type DragEvent } from 'react';
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
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};

function FileRow({ vm, file, depth, dragOverId, setDragOverId }: {
  vm: NotesAppVM; file: NoteFile; depth: number;
  dragOverId: string | null; setDragOverId: (id: string | null) => void;
}) {
  const { state, badgeColors } = vm;
  const [menuOpen, setMenuOpen] = useState(false);
  const on = file.id === state.activeId;
  const bc = badgeColors[file.type];
  const kids = vm.childrenOf(file.id);
  const expanded = state.expandedDocs[file.id];
  const isOver = dragOverId === file.id;

  return (
    <div>
      <div
        draggable
        onDragStart={(e: DragEvent) => e.dataTransfer.setData('text/note-id', file.id)}
        onDragOver={(e: DragEvent) => { e.preventDefault(); setDragOverId(file.id); }}
        onDragLeave={() => setDragOverId(null)}
        onDrop={(e: DragEvent) => {
          e.preventDefault();
          setDragOverId(null);
          const draggedId = e.dataTransfer.getData('text/note-id');
          if (draggedId && draggedId !== file.id) vm.moveFileTo(draggedId, file.folder, file.id);
        }}
        onClick={() => vm.open(file.id)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7, padding: `5px 11px 5px ${30 + depth * 16}px`, borderRadius: 8, fontSize: 12.5, cursor: 'pointer',
          ...(on ? { background: ACCENT_SOFT, color: 'oklch(0.45 0.11 264)', fontWeight: 500 } : { color: '#6e6e73' }),
          ...(isOver ? { outline: '1.5px dashed oklch(0.6 0.12 264)' } : {}),
        }}
      >
        {kids.length > 0
          ? (
            <span
              onClick={(e) => { e.stopPropagation(); vm.toggleExpand(file.id); }}
              style={{ color: '#bdb8af', fontSize: 9, width: 10, flex: 'none', cursor: 'pointer', marginLeft: -15 }}
            >
              {expanded ? '▾' : '▸'}
            </span>
          )
          : <span style={{ width: 0, flex: 'none' }} />}
        <span style={{ font: '600 8px ui-monospace,Menlo,monospace', flex: 'none', padding: '1px 3px', borderRadius: 3, color: bc.c, background: bc.b }}>{file.type.toUpperCase()}</span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.title}</span>
        {file.pinned && <span style={{ color: '#d6a419', fontSize: 10 }}>★</span>}
        <span
          onClick={(e) => { e.stopPropagation(); setMenuOpen((m) => !m); }}
          style={{ color: '#bdb8af', fontSize: 12, padding: '0 2px', flex: 'none' }}
          title="More"
        >
          ⋯
        </span>
      </div>
      {menuOpen && (
        <div style={{ margin: `2px 11px 4px ${30 + depth * 16}px`, background: '#fffefb', border: '1px solid rgba(0,0,0,.08)', borderRadius: 8, boxShadow: '0 4px 14px -6px rgba(0,0,0,.2)', overflow: 'hidden', width: 160 }}>
          {[
            { label: 'Duplicate', run: () => vm.duplicateFile(file.id) },
            ...vm.allFolderNames.filter((n) => n !== file.folder).map((n) => ({
              label: 'Copy to ' + n, run: () => { vm.duplicateFile(file.id); vm.moveFileTo(file.id, n); },
            })),
          ].map((item) => (
            <div
              key={item.label}
              onClick={(e) => { e.stopPropagation(); item.run(); setMenuOpen(false); }}
              style={{ padding: '7px 11px', fontSize: 12, color: '#4a4a4c', cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f1ec'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}
      {expanded && kids.map((c) => (
        <FileRow key={c.id} vm={vm} file={c} depth={depth + 1} dragOverId={dragOverId} setDragOverId={setDragOverId} />
      ))}
    </div>
  );
}

export default function Sidebar({ vm }: { vm: NotesAppVM }) {
  const { state, setState, all, folders, tagCount, recentDocs, badgeColors, agoLabel } = vm;
  const defs = filterDefs(all);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

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

      <div style={sectionLabel}>
        <span>FOLDERS</span>
        <span
          onClick={() => vm.refreshVault()}
          title={vm.isTauri ? 'Refresh from disk' : 'Refresh'}
          style={{ cursor: 'pointer', color: '#bdb8af', fontSize: 12 }}
        >
          ↻
        </span>
      </div>
      {folders.map((g) => {
        const folderKey = 'folder:' + g.name;
        const folderExpanded = state.expandedDocs[folderKey] !== false;
        return (
          <div
            key={g.name}
            style={{ marginBottom: 2 }}
            onDragOver={(e: DragEvent) => { e.preventDefault(); setDragOverId(folderKey); }}
            onDragLeave={() => setDragOverId(null)}
            onDrop={(e: DragEvent) => {
              e.preventDefault();
              setDragOverId(null);
              const draggedId = e.dataTransfer.getData('text/note-id');
              if (draggedId) vm.moveFileTo(draggedId, g.name, undefined);
            }}
          >
            <div
              onClick={() => vm.toggleExpand(folderKey)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '5px 11px', fontSize: 12.5, color: '#4a4a4c', cursor: 'pointer',
                ...(dragOverId === folderKey ? { outline: '1.5px dashed oklch(0.6 0.12 264)', borderRadius: 6 } : {}),
              }}
            >
              <span style={{ color: '#bdb8af', fontSize: 9 }}>{folderExpanded ? '▾' : '▸'}</span>
              <svg width="14" height="14" viewBox="0 0 16 16" style={{ flex: 'none' }}>
                <path d="M1.5 4.6c0-.6.4-1 1-1h3.1c.3 0 .5.1.7.3l.8.8c.2.2.4.3.7.3h5.2c.6 0 1 .4 1 1v5.7c0 .6-.4 1-1 1H2.5c-.6 0-1-.4-1-1z" fill="#c9b89a" />
              </svg>
              <span style={{ fontWeight: 500, flex: 1 }}>{g.name}</span>
              <span
                onClick={(e) => { e.stopPropagation(); vm.newFile(g.name); }}
                title="New file"
                style={{ color: '#bdb8af', fontSize: 13, padding: '0 3px' }}
              >
                +
              </span>
            </div>
            {folderExpanded && g.roots.map((f) => (
              <FileRow key={f.id} vm={vm} file={f} depth={0} dragOverId={dragOverId} setDragOverId={setDragOverId} />
            ))}
          </div>
        );
      })}

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
