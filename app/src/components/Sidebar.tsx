import { useState, type CSSProperties, type DragEvent } from 'react';
import type { NotesAppVM } from '../hooks/useNotesApp';
import type { NoteFile } from '../types';

const ACCENT_SOFT = 'var(--accent-soft)';

type NoteZone = 'before' | 'after' | 'inside';
type FolderDragOver = { name: string; zone: 'before' | 'after' } | null;

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

function sectionLabelStyle(cowork: boolean): CSSProperties {
  return cowork
    ? {
        font: '500 13px -apple-system,system-ui', color: 'var(--text-muted)', textTransform: 'capitalize', padding: '20px 11px 8px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer',
      }
    : {
        font: '600 10.5px ui-monospace,Menlo,monospace', color: 'var(--text-faint)', letterSpacing: '.05em', padding: '18px 11px 7px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer',
      };
}

const chevronStyle: CSSProperties = {
  color: 'var(--text-muted)', fontSize: 11, width: 16, height: 16, flex: 'none',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

function Bullet({ cowork, bc, type }: { cowork: boolean; bc: { c: string; b: string }; type: string }) {
  if (cowork) {
    return <span style={{ flex: 'none', width: 14, textAlign: 'center', fontSize: 12, color: 'var(--text-faintest)' }}>○</span>;
  }
  return <span style={{ font: '600 8px ui-monospace,Menlo,monospace', flex: 'none', padding: '1px 3px', borderRadius: 3, color: bc.c, background: bc.b }}>{type.toUpperCase()}</span>;
}

function RecentRow({ vm, file, cowork, timestamp }: { vm: NotesAppVM; file: NoteFile; cowork: boolean; timestamp: number | undefined }) {
  const { state, badgeColors, agoLabel } = vm;
  const on = file.id === state.activeId;
  const bc = badgeColors[file.type];
  return (
    <div
      onClick={() => vm.open(file.id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: cowork ? '8px 11px' : '6px 11px', borderRadius: 8, fontSize: cowork ? 14.5 : 12.5, cursor: 'pointer',
        ...(on ? { background: ACCENT_SOFT, color: 'var(--accent-strong)', fontWeight: 500 } : { color: '#6e6e73' }),
      }}
    >
      <Bullet cowork={cowork} bc={bc} type={file.type} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.title}</span>
      <span style={{ font: '10.5px ui-monospace,Menlo,monospace', color: 'var(--text-faintest)', flex: 'none' }}>{timestamp ? agoLabel(timestamp) : ''}</span>
    </div>
  );
}

function FileRow({ vm, file, depth, dragOverId, dragZone, setDragOverId, setDragZone }: {
  vm: NotesAppVM; file: NoteFile; depth: number;
  dragOverId: string | null; dragZone: NoteZone | null;
  setDragOverId: (id: string | null) => void; setDragZone: (z: NoteZone | null) => void;
}) {
  const { state, badgeColors } = vm;
  const cowork = state.design === 'cowork-plus';
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(file.title);
  const on = file.id === state.activeId;
  const bc = badgeColors[file.type];
  const kids = vm.childrenOf(file.id);
  const expanded = state.expandedDocs[file.id];
  const isOver = dragOverId === file.id;

  const commitRename = () => {
    vm.renameFile(file.id, renameValue);
    setRenaming(false);
  };

  return (
    <div>
      <div
        draggable={!renaming}
        onDragStart={(e: DragEvent) => e.dataTransfer.setData('text/note-id', file.id)}
        onDragOver={(e: DragEvent) => {
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          const y = e.clientY - rect.top;
          const zone: NoteZone = y < rect.height / 3 ? 'before' : y > (rect.height * 2) / 3 ? 'after' : 'inside';
          setDragOverId(file.id);
          setDragZone(zone);
        }}
        onDragLeave={() => { setDragOverId(null); setDragZone(null); }}
        onDrop={(e: DragEvent) => {
          e.preventDefault();
          e.stopPropagation();
          const draggedId = e.dataTransfer.getData('text/note-id');
          const zone = dragZone;
          setDragOverId(null);
          setDragZone(null);
          if (draggedId && draggedId !== file.id && zone) vm.reorderNote(draggedId, file.id, zone);
        }}
        onClick={() => { if (!renaming) vm.open(file.id); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 7, padding: cowork ? `7px 11px 7px ${30 + depth * 16}px` : `5px 11px 5px ${30 + depth * 16}px`,
          borderRadius: 8, fontSize: cowork ? 14.5 : 12.5, cursor: 'pointer',
          ...(on ? { background: ACCENT_SOFT, color: 'var(--accent-strong)', fontWeight: 500 } : { color: '#6e6e73' }),
          ...(isOver && dragZone === 'inside' ? { outline: '1.5px dashed var(--accent)' } : {}),
          ...(isOver && dragZone === 'before' ? { boxShadow: 'inset 0 2px 0 var(--accent)' } : {}),
          ...(isOver && dragZone === 'after' ? { boxShadow: 'inset 0 -2px 0 var(--accent)' } : {}),
        }}
      >
        {kids.length > 0
          ? (
            <span
              onClick={(e) => { e.stopPropagation(); vm.toggleExpand(file.id); }}
              style={{ ...chevronStyle, marginLeft: -21, cursor: 'pointer' }}
            >
              {expanded ? '▾' : '▸'}
            </span>
          )
          : <span style={{ width: 0, flex: 'none' }} />}
        <Bullet cowork={cowork} bc={bc} type={file.type} />
        {renaming
          ? (
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onBlur={commitRename}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') e.currentTarget.blur();
                else if (e.key === 'Escape') setRenaming(false);
              }}
              style={{ flex: 1, minWidth: 0, font: 'inherit', color: 'inherit', background: 'var(--bg-surface)', border: '1px solid var(--accent)', borderRadius: 4, padding: '1px 4px' }}
            />
          )
          : (
            <span
              onDoubleClick={(e) => { e.stopPropagation(); setRenameValue(file.title); setRenaming(true); }}
              style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {file.title}
            </span>
          )}
        {file.pinned && <span style={{ color: '#d6a419', fontSize: 10 }}>★</span>}
        <span
          onClick={(e) => { e.stopPropagation(); setMenuOpen((m) => !m); }}
          style={{ color: 'var(--text-faintest)', fontSize: 12, padding: '0 2px', flex: 'none' }}
          title="More"
        >
          ⋯
        </span>
      </div>
      {menuOpen && (
        <div style={{ margin: `2px 11px 4px ${30 + depth * 16}px`, background: 'var(--bg-surface)', border: '1px solid rgba(0,0,0,.08)', borderRadius: 8, boxShadow: '0 4px 14px -6px rgba(0,0,0,.2)', overflow: 'hidden', width: 160 }}>
          {[
            { label: 'Rename', run: () => { setRenameValue(file.title); setRenaming(true); } },
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
        <FileRow key={c.id} vm={vm} file={c} depth={depth + 1} dragOverId={dragOverId} dragZone={dragZone} setDragOverId={setDragOverId} setDragZone={setDragZone} />
      ))}
    </div>
  );
}

export default function Sidebar({ vm }: { vm: NotesAppVM }) {
  const { state, setState, all, folders, tagCount, recentDocs, recentlyCreated } = vm;
  const cowork = state.design === 'cowork-plus';
  const defs = filterDefs(all);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragZone, setDragZone] = useState<NoteZone | null>(null);
  const [folderDragOver, setFolderDragOver] = useState<FolderDragOver>(null);

  const recentExpanded = state.expandedDocs['section:recent'] === true;
  const createdExpanded = state.expandedDocs['section:created'] === true;
  const tagsExpanded = state.expandedDocs['section:tags'] === true;

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
                : cowork
                  ? <span style={{ fontSize: 14, color: 'var(--text-faintest)' }}>○</span>
                  : <span style={{ width: 11, height: 11, borderRadius: 3, background: f.color, display: 'block' }} />}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="sc" style={{ width: 248, background: '#f7f5f1', borderRight: '1px solid rgba(0,0,0,.06)', overflow: 'auto', flex: 'none', padding: '14px 10px' }}>
      {cowork && (
        <div
          onClick={() => vm.newFile('Notes')}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 11px', marginBottom: 6, borderRadius: 8, fontSize: 14.5, fontWeight: 500, color: 'var(--text-primary)', cursor: 'pointer' }}
        >
          <span style={{
            width: 24, height: 24, borderRadius: '50%', background: 'var(--bg-subtle)', color: 'var(--text-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flex: 'none',
          }}
          >
            +
          </span>
          New note
        </div>
      )}
      <div style={{ ...sectionLabelStyle(cowork), padding: cowork ? '4px 11px 8px' : '4px 11px 7px', cursor: 'default' }}>{cowork ? 'Smart filters' : 'SMART FILTERS'}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {defs.map((f) => {
          const on = state.filter === f.key;
          return (
            <div
              key={f.key}
              onClick={() => setState({ filter: f.key })}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: cowork ? '8px 11px' : '6px 11px', borderRadius: 8, fontSize: cowork ? 14.5 : 13, cursor: 'pointer',
                ...(on ? { background: ACCENT_SOFT, color: 'var(--accent-strong)', fontWeight: 500 } : { color: '#4a4a4c' }),
              }}
            >
              {f.star
                ? <span style={{ color: '#d6a419', fontSize: 12, width: 8, display: 'flex', justifyContent: 'center' }}>★</span>
                : cowork
                  ? <span style={{ width: 8, flex: 'none', fontSize: 11, color: 'var(--text-faintest)' }}>○</span>
                  : <span style={{ width: 8, height: 8, borderRadius: 2, flex: 'none', background: f.color, display: 'block' }} />}
              <span style={{ flex: 1 }}>{f.label}</span>
              <span style={{ fontSize: 11, color: on ? 'var(--accent-strong)' : 'var(--text-faintest)' }}>{f.count}</span>
            </div>
          );
        })}
      </div>

      <div style={{ ...sectionLabelStyle(cowork), cursor: 'default' }}>
        <span>{cowork ? 'Folders' : 'FOLDERS'}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <span
            onClick={() => {
              const name = window.prompt('Folder name:');
              if (name) vm.createFolder(name);
            }}
            title="New folder"
            style={{ cursor: 'pointer', color: 'var(--text-faintest)', fontSize: 13 }}
          >
            +
          </span>
          <span
            onClick={() => vm.collapseAllFolders()}
            title="Collapse all folders"
            style={{ cursor: 'pointer', color: 'var(--text-faintest)', fontSize: 12 }}
          >
            ⊟
          </span>
          <span
            onClick={() => vm.refreshVault()}
            title={vm.isTauri ? 'Refresh from disk' : 'Refresh'}
            style={{ cursor: 'pointer', color: 'var(--text-faintest)', fontSize: 12 }}
          >
            ↻
          </span>
        </div>
      </div>
      {folders.map((g) => {
        const folderKey = 'folder:' + g.name;
        const folderExpanded = state.expandedDocs[folderKey] !== false;
        const fOver = folderDragOver?.name === g.name ? folderDragOver.zone : null;
        return (
          <div key={g.name} style={{ marginBottom: 2 }}>
            <div
              draggable
              onDragStart={(e: DragEvent) => e.dataTransfer.setData('text/folder-name', g.name)}
              onDragOver={(e: DragEvent) => {
                e.preventDefault();
                if (e.dataTransfer.types.includes('text/folder-name')) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const zone: 'before' | 'after' = e.clientY - rect.top < rect.height / 2 ? 'before' : 'after';
                  setFolderDragOver({ name: g.name, zone });
                  setDragOverId(null);
                } else {
                  setDragOverId(folderKey);
                  setFolderDragOver(null);
                }
              }}
              onDragLeave={() => { setDragOverId(null); setFolderDragOver(null); }}
              onDrop={(e: DragEvent) => {
                e.preventDefault();
                e.stopPropagation();
                const folderName = e.dataTransfer.getData('text/folder-name');
                const noteId = e.dataTransfer.getData('text/note-id');
                const zone = fOver;
                setDragOverId(null);
                setFolderDragOver(null);
                if (folderName && folderName !== g.name && zone) { vm.reorderFolder(folderName, g.name, zone); return; }
                if (noteId) vm.moveFileTo(noteId, g.name, undefined);
              }}
              onClick={() => vm.toggleExpand(folderKey)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: cowork ? '7px 11px' : '5px 11px', fontSize: cowork ? 14.5 : 12.5, color: '#4a4a4c', cursor: 'pointer',
                ...(dragOverId === folderKey ? { outline: '1.5px dashed var(--accent)', borderRadius: 6 } : {}),
                ...(fOver === 'before' ? { boxShadow: 'inset 0 2px 0 var(--accent)' } : {}),
                ...(fOver === 'after' ? { boxShadow: 'inset 0 -2px 0 var(--accent)' } : {}),
              }}
            >
              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{folderExpanded ? '▾' : '▸'}</span>
              <svg width="14" height="14" viewBox="0 0 16 16" style={{ flex: 'none' }}>
                <path d="M1.5 4.6c0-.6.4-1 1-1h3.1c.3 0 .5.1.7.3l.8.8c.2.2.4.3.7.3h5.2c.6 0 1 .4 1 1v5.7c0 .6-.4 1-1 1H2.5c-.6 0-1-.4-1-1z" fill={cowork ? 'var(--text-faintest)' : '#c9b89a'} />
              </svg>
              <span style={{ fontWeight: 500, flex: 1 }}>{g.name}</span>
              <span
                onClick={(e) => { e.stopPropagation(); vm.newFile(g.name); }}
                title="New file"
                style={{ color: 'var(--text-faintest)', fontSize: 13, padding: '0 3px' }}
              >
                +
              </span>
            </div>
            {folderExpanded && g.roots.map((f) => (
              <FileRow key={f.id} vm={vm} file={f} depth={0} dragOverId={dragOverId} dragZone={dragZone} setDragOverId={setDragOverId} setDragZone={setDragZone} />
            ))}
          </div>
        );
      })}

      <div style={sectionLabelStyle(cowork)} onClick={() => vm.toggleExpand('section:recent')}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'var(--text-faintest)', fontSize: 9 }}>{recentExpanded ? '▾' : '▸'}</span>
          {cowork ? 'Recently edited' : 'RECENTLY EDITED'}
        </span>
      </div>
      {recentExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {recentDocs.map((f) => (
            <RecentRow key={f.id} vm={vm} file={f} cowork={cowork} timestamp={state.editedAt[f.id]} />
          ))}
        </div>
      )}

      <div style={sectionLabelStyle(cowork)} onClick={() => vm.toggleExpand('section:created')}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'var(--text-faintest)', fontSize: 9 }}>{createdExpanded ? '▾' : '▸'}</span>
          {cowork ? 'Recently created' : 'RECENTLY CREATED'}
        </span>
      </div>
      {createdExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {recentlyCreated.map((f) => (
            <RecentRow key={f.id} vm={vm} file={f} cowork={cowork} timestamp={state.createdAt[f.id]} />
          ))}
        </div>
      )}

      <div style={sectionLabelStyle(cowork)} onClick={() => vm.toggleExpand('section:tags')}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'var(--text-faintest)', fontSize: 9 }}>{tagsExpanded ? '▾' : '▸'}</span>
          {cowork ? 'Tags' : 'TAGS'}
        </span>
      </div>
      {tagsExpanded && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 11px' }}>
          {Object.keys(tagCount).sort().map((t) => {
            const on = state.filter === 'tag:' + t;
            return (
              <span
                key={t}
                onClick={() => setState({ filter: 'tag:' + t })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, font: cowork ? '500 12.5px -apple-system,system-ui' : '500 11px -apple-system,system-ui', padding: cowork ? '4px 10px' : '3px 9px', borderRadius: 11, cursor: 'pointer',
                  ...(on ? { background: 'var(--accent-soft)', color: 'var(--accent-strong)' } : { background: '#ece9e2', color: '#6e6e73' }),
                }}
              >
                #{t}<span style={{ opacity: 0.6 }}>{tagCount[t]}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
