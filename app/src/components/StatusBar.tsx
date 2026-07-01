import type { NotesAppVM } from '../hooks/useNotesApp';

export default function StatusBar({ vm }: { vm: NotesAppVM }) {
  const { active, typeLabels, words, backlinks } = vm;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, height: 26, flex: 'none', background: '#faf9f7', borderTop: '1px solid rgba(0,0,0,.06)', padding: '0 18px', font: '11px ui-monospace,Menlo,monospace', color: 'var(--text-tertiary)' }}>
      <span>{active ? typeLabels[active.type] : ''}</span>
      <span>UTF-8</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#1a8a4f' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#28b463' }} />Synced
      </span>
      <span style={{ marginLeft: 'auto' }}>{backlinks.length} backlinks</span>
      <span>{words} words</span>
    </div>
  );
}
