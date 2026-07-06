import { useState } from 'react';
import type { FolderNode, NotesAppVM } from '../hooks/useNotesApp';
import { FileRow, FolderRow, type FolderDragOver, type NoteZone } from './Sidebar';

function findFolderNode(nodes: FolderNode[], path: string): FolderNode | undefined {
  for (const n of nodes) {
    if (n.path === path) return n;
    const hit = findFolderNode(n.children, path);
    if (hit) return hit;
  }
  return undefined;
}

export default function FolderTreePane({ vm }: { vm: NotesAppVM }) {
  const path = vm.state.activeId!.slice('folder:'.length);
  const node = findFolderNode(vm.folderTree, path);
  const cowork = vm.state.design === 'cowork-plus';
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragZone, setDragZone] = useState<NoteZone | null>(null);
  const [folderDragOver, setFolderDragOver] = useState<FolderDragOver>(null);

  const parts = path.split('/');

  if (!node) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faintest)', font: '13px -apple-system,system-ui' }}>
        This folder is no longer available.
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 32, flex: 'none', padding: '0 18px', borderBottom: '1px solid var(--border-soft)' }}>
        {parts.map((part, i) => {
          const current = i === parts.length - 1;
          const prefixPath = parts.slice(0, i + 1).join('/');
          return (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {i > 0 && <span style={{ font: '500 11px ui-monospace,Menlo,monospace', color: 'var(--text-faint)', flex: 'none' }}>/</span>}
              <span
                onClick={() => { if (!current) vm.openFolder(prefixPath); }}
                style={{
                  font: '500 11px ui-monospace,Menlo,monospace', flex: 'none', whiteSpace: 'nowrap', borderRadius: 5, padding: '2px 5px',
                  ...(current ? { color: 'var(--text-muted)' } : { color: 'var(--text-faintest)', cursor: 'pointer' }),
                }}
                onMouseEnter={(e) => { if (!current) { e.currentTarget.style.background = 'var(--bg-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
                onMouseLeave={(e) => { if (!current) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-faintest)'; } }}
              >
                {part}
              </span>
            </span>
          );
        })}
      </div>
      <div className="sc" style={{ flex: 1, overflow: 'auto', minHeight: 0, padding: '14px 10px' }}>
        {node.roots.map((f) => (
          <FileRow key={f.id} vm={vm} file={f} depth={0} dragOverId={dragOverId} dragZone={dragZone} setDragOverId={setDragOverId} setDragZone={setDragZone} />
        ))}
        {node.children.map((child) => (
          <FolderRow
            key={child.path} vm={vm} node={child} depth={0} cowork={cowork}
            dragOverId={dragOverId} dragZone={dragZone} setDragOverId={setDragOverId} setDragZone={setDragZone}
            folderDragOver={folderDragOver} setFolderDragOver={setFolderDragOver} onNavigate={vm.openFolder}
          />
        ))}
        {!node.roots.length && !node.children.length && (
          <div style={{ padding: '4px 11px 10px', font: '400 12px -apple-system,system-ui', color: 'var(--text-faintest)' }}>
            This folder is empty
          </div>
        )}
      </div>
    </div>
  );
}
