import type { NotesAppVM } from '../hooks/useNotesApp';

export default function StatusBar({ vm, pane = 'primary' }: { vm: NotesAppVM; pane?: 'primary' | 'secondary' }) {
  const { typeLabels } = vm;
  const secondary = pane === 'secondary';
  const file = secondary ? vm.secondary.file : vm.active;
  const words = secondary ? vm.secondary.words : vm.words;
  const backlinks = secondary ? vm.secondary.backlinks : vm.backlinks;
  // Same lintSource output the editor underlines inline — surfaced here so problems are
  // visible even when the offending line is scrolled off.
  const problems = secondary ? vm.secondary.problems : vm.problems;
  const errors = problems.filter((p) => p.severity === 'error').length;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, height: 26, flex: 'none', background: 'var(--bg-bar)', borderTop: '1px solid var(--border)', padding: '0 18px', font: '11px ui-monospace,Menlo,monospace', color: 'var(--text-tertiary)' }}>
      <span>{file ? typeLabels[file.type] : ''}</span>
      <span>UTF-8</span>
      {problems.length > 0 && (
        <span title={problems.map((p) => p.message).join('\n')} style={{ color: errors ? 'var(--status-danger)' : 'var(--badge-html-fg)' }}>
          {errors ? '\u2715' : '\u26a0'} {problems.length} {problems.length === 1 ? 'problem' : 'problems'}
        </span>
      )}
      <span style={{ marginLeft: 'auto' }}>{backlinks.length} backlinks</span>
      <span>{words} words</span>
    </div>
  );
}
