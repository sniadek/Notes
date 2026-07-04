import type { NotesAppVM } from '../hooks/useNotesApp';

export default function StatusBar({ vm, pane = 'primary' }: { vm: NotesAppVM; pane?: 'primary' | 'secondary' }) {
  const { typeLabels } = vm;
  const secondary = pane === 'secondary';
  const file = secondary ? vm.secondary.file : vm.active;
  const words = secondary ? vm.secondary.words : vm.words;
  const backlinks = secondary ? vm.secondary.backlinks : vm.backlinks;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, height: 26, flex: 'none', background: 'var(--bg-bar)', borderTop: '1px solid var(--border)', padding: '0 18px', font: '11px ui-monospace,Menlo,monospace', color: 'var(--text-tertiary)' }}>
      <span>{file ? typeLabels[file.type] : ''}</span>
      <span>UTF-8</span>
      <span style={{ marginLeft: 'auto' }}>{backlinks.length} backlinks</span>
      <span>{words} words</span>
    </div>
  );
}
