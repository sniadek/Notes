import { useMemo, useState } from 'react';
import type { NotesAppVM } from '../hooks/useNotesApp';
import { inNextDays, isOverdue, isToday } from '../lib/tasks';
import type { ParsedTask, TaskPriority } from '../types';

type GroupBy = 'date' | 'note' | 'priority';

const PRIORITY_LABEL: Record<TaskPriority, string> = { high: 'High', medium: 'Medium', low: 'Low' };
const PRIORITY_COLOR: Record<TaskPriority, string> = { high: '#a3466b', medium: '#b5651d', low: '#6c7686' };

function TaskRow({ vm, task }: { vm: NotesAppVM; task: ParsedTask }) {
  const overdue = !task.done && isOverdue(task.due);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 4px', borderBottom: '1px solid var(--border-soft)' }}>
      <span
        onClick={() => vm.toggleTask(task.line, task.fileId)}
        style={{
          width: 16, height: 16, borderRadius: 5, flex: 'none', cursor: 'pointer',
          border: '1.5px solid ' + (task.done ? 'oklch(0.5 0.12 264)' : '#cfc9bd'),
          background: task.done ? 'oklch(0.5 0.12 264)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10,
        }}
      >
        {task.done ? '✓' : ''}
      </span>
      <span
        style={{
          flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          font: '400 13.5px -apple-system,system-ui',
          color: task.done ? 'var(--text-faintest)' : 'var(--text-primary)',
          textDecoration: task.done ? 'line-through' : 'none',
        }}
      >
        {task.text}
      </span>
      {task.priority && (
        <span style={{ font: '600 10px -apple-system,system-ui', color: PRIORITY_COLOR[task.priority], flex: 'none' }}>
          {PRIORITY_LABEL[task.priority]}
        </span>
      )}
      {task.due && (
        <span style={{ font: '11px ui-monospace,Menlo,monospace', color: overdue ? '#b5453f' : 'var(--text-faintest)', flex: 'none' }}>
          {task.due}
        </span>
      )}
      <span
        onClick={() => vm.open(task.fileId)}
        title={task.fileTitle}
        style={{
          font: '500 10.5px -apple-system,system-ui', color: 'var(--text-faintest)', background: 'var(--bg-subtle)',
          padding: '2px 8px', borderRadius: 10, cursor: 'pointer', flex: 'none', maxWidth: 140,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {task.fileTitle}
      </span>
    </div>
  );
}

function Section({
  title, tasks, vm, collapsed, onToggle,
}: { title: string; tasks: ParsedTask[]; vm: NotesAppVM; collapsed?: boolean; onToggle?: () => void }) {
  if (!tasks.length) return null;
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, cursor: onToggle ? 'pointer' : 'default',
          font: '600 11px -apple-system,system-ui', color: 'var(--text-tertiary)', letterSpacing: '.03em',
        }}
      >
        {onToggle && <span style={{ fontSize: 9 }}>{collapsed ? '▸' : '▾'}</span>}
        <span>{title.toUpperCase()}</span>
        <span style={{ color: 'var(--text-faintest)' }}>{tasks.length}</span>
      </div>
      {!collapsed && tasks.map((t) => <TaskRow key={t.id} vm={vm} task={t} />)}
    </div>
  );
}

export default function TaskManagerPane({ vm }: { vm: NotesAppVM }) {
  const { tasks, taskCounts } = vm;
  const [groupBy, setGroupBy] = useState<GroupBy>('date');
  const [query, setQuery] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [quickText, setQuickText] = useState('');
  const [quickDue, setQuickDue] = useState('');
  const [quickPriority, setQuickPriority] = useState<TaskPriority | ''>('');

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () => tasks.filter((t) => !q || t.text.toLowerCase().includes(q) || t.fileTitle.toLowerCase().includes(q)),
    [tasks, q],
  );
  const open = filtered.filter((t) => !t.done);
  const done = filtered.filter((t) => t.done);

  const overdue = open.filter((t) => isOverdue(t.due));
  const today = open.filter((t) => isToday(t.due));
  const upcoming = open.filter((t) => inNextDays(t.due, 7));
  const later = open.filter((t) => !isOverdue(t.due) && !isToday(t.due) && !inNextDays(t.due, 7));

  const byNote = useMemo(() => {
    const map = new Map<string, ParsedTask[]>();
    open.forEach((t) => {
      if (!map.has(t.fileTitle)) map.set(t.fileTitle, []);
      map.get(t.fileTitle)!.push(t);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [open]);

  const byPriority = useMemo(() => {
    const groups: Record<'high' | 'medium' | 'low' | 'none', ParsedTask[]> = {
      high: [], medium: [], low: [], none: [],
    };
    open.forEach((t) => groups[t.priority || 'none'].push(t));
    return groups;
  }, [open]);

  const submitQuick = () => {
    if (!quickText.trim()) return;
    vm.addTaskLine({ text: quickText, due: quickDue || undefined, priority: quickPriority || undefined, navigate: false });
    setQuickText('');
    setQuickDue('');
    setQuickPriority('');
  };

  return (
    <div className="sc" style={{ flex: 1, overflow: 'auto', padding: '28px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 18 }}>
        <span style={{ font: '600 22px -apple-system,system-ui', color: 'var(--text-primary)' }}>Tasks</span>
        <span style={{ font: '13px -apple-system,system-ui', color: 'var(--text-tertiary)' }}>
          {taskCounts} due today or overdue · {open.length} open · {done.length} done
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, padding: '9px 10px', borderRadius: 10, background: 'var(--bg-subtle)' }}>
        <input
          value={quickText}
          onChange={(e) => setQuickText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submitQuick(); }}
          placeholder="Add a task…"
          style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', font: '13.5px -apple-system,system-ui', color: 'var(--text-primary)' }}
        />
        <input
          type="date"
          value={quickDue}
          onChange={(e) => setQuickDue(e.target.value)}
          style={{ font: '12px -apple-system,system-ui', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 6px', background: 'var(--bg-surface)' }}
        />
        <select
          value={quickPriority}
          onChange={(e) => setQuickPriority(e.target.value as TaskPriority | '')}
          style={{ font: '12px -apple-system,system-ui', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 6px', background: 'var(--bg-surface)' }}
        >
          <option value="">Priority</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <span onClick={submitQuick} style={{ font: '500 12px -apple-system,system-ui', color: '#fff', background: 'var(--accent)', padding: '6px 12px', borderRadius: 7, cursor: 'pointer' }}>Add</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter tasks…"
          style={{ flex: 1, maxWidth: 260, font: '12.5px -apple-system,system-ui', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
        />
        <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderRadius: 8, padding: 2, font: '500 11.5px -apple-system,system-ui', marginLeft: 'auto' }}>
          {(['date', 'note', 'priority'] as GroupBy[]).map((g) => (
            <span
              key={g}
              onClick={() => setGroupBy(g)}
              style={{
                padding: '5px 11px', borderRadius: 6, cursor: 'pointer',
                ...(groupBy === g
                  ? { background: 'var(--bg-surface)', color: 'var(--text-primary)', boxShadow: '0 1px 2px rgba(0,0,0,.1)' }
                  : { color: 'var(--text-muted)' }),
              }}
            >
              {g === 'date' ? 'By date' : g === 'note' ? 'By note' : 'By priority'}
            </span>
          ))}
        </div>
      </div>

      {groupBy === 'date' && (
        <>
          <Section title="Overdue" tasks={overdue} vm={vm} />
          <Section title="Today" tasks={today} vm={vm} />
          <Section title="Upcoming" tasks={upcoming} vm={vm} />
          <Section title="Later / no date" tasks={later} vm={vm} />
        </>
      )}

      {groupBy === 'note' && byNote.map(([title, ts]) => (
        <Section key={title} title={title} tasks={ts} vm={vm} />
      ))}

      {groupBy === 'priority' && (
        <>
          <Section title="High priority" tasks={byPriority.high} vm={vm} />
          <Section title="Medium priority" tasks={byPriority.medium} vm={vm} />
          <Section title="Low priority" tasks={byPriority.low} vm={vm} />
          <Section title="No priority" tasks={byPriority.none} vm={vm} />
        </>
      )}

      {!open.length && (
        <div style={{ color: 'var(--text-faintest)', font: '13px -apple-system,system-ui', padding: '20px 0' }}>Nothing open. Nice.</div>
      )}

      <Section title="Done" tasks={done} vm={vm} collapsed={!showDone} onToggle={() => setShowDone((v) => !v)} />
    </div>
  );
}
