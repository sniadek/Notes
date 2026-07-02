import type { KeyboardEvent } from 'react';
import type { NotesAppVM } from '../hooks/useNotesApp';
import type { TaskPriority } from '../types';

const PRIORITIES: { value: TaskPriority | ''; label: string }[] = [
  { value: '', label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export default function AddTaskModal({ vm }: { vm: NotesAppVM }) {
  const {
    state, setState, all, closeAddTask, saveAddTask, addTaskInputRef,
  } = vm;

  if (!state.addTaskOpen) return null;

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); saveAddTask(); }
  };

  const noteOptions = all.filter((f) => f.type === 'md');

  return (
    <div onClick={closeAddTask} style={{ position: 'fixed', inset: 0, background: 'rgba(30,28,24,.28)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '16vh', zIndex: 51, animation: 'fade .12s ease' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 480, maxWidth: '92vw', background: 'var(--bg-surface)', borderRadius: 14, boxShadow: 'var(--shadow-modal)', border: '1px solid rgba(0,0,0,.08)', overflow: 'hidden', animation: 'pop .14s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 15 }}>☑</span>
          <span style={{ font: '600 13.5px -apple-system,system-ui', color: 'var(--text-primary)' }}>Add task</span>
        </div>

        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            value={state.addTaskText}
            onChange={(e) => setState({ addTaskText: e.target.value })}
            onKeyDown={onKeyDown}
            ref={addTaskInputRef}
            placeholder="What needs to be done?"
            style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, outline: 'none', padding: '9px 11px', font: '14px -apple-system,system-ui', color: 'var(--text-primary)', background: 'var(--bg-surface)' }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ font: '12.5px -apple-system,system-ui', color: 'var(--text-secondary)' }}>Due</span>
              <input
                type="date"
                value={state.addTaskDue}
                onChange={(e) => setState({ addTaskDue: e.target.value })}
                style={{ font: '12.5px -apple-system,system-ui', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 6px', background: 'var(--bg-surface)' }}
              />
            </div>

            <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderRadius: 8, padding: 2, font: '500 11.5px -apple-system,system-ui' }}>
              {PRIORITIES.map((p) => (
                <span
                  key={p.value}
                  onClick={() => setState({ addTaskPriority: p.value })}
                  style={{
                    padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
                    ...(state.addTaskPriority === p.value
                      ? { background: 'var(--bg-surface)', color: 'var(--text-primary)', boxShadow: '0 1px 2px rgba(0,0,0,.1)' }
                      : { color: 'var(--text-muted)' }),
                  }}
                >
                  {p.label}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ font: '12.5px -apple-system,system-ui', color: 'var(--text-secondary)' }}>Add to</span>
            <select
              value={state.addTaskTargetId ?? ''}
              onChange={(e) => setState({ addTaskTargetId: e.target.value || null })}
              style={{ flex: 1, font: '12.5px -apple-system,system-ui', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 6px', background: 'var(--bg-surface)', minWidth: 0 }}
            >
              <option value="">Today's Daily Note</option>
              {noteOptions.map((f) => <option key={f.id} value={f.id}>{f.folder} / {f.title}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 9, padding: '11px 16px', borderTop: '1px solid var(--border)' }}>
          <span onClick={closeAddTask} style={{ font: '500 12.5px -apple-system,system-ui', color: 'var(--text-muted)', padding: '7px 13px', borderRadius: 8, cursor: 'pointer' }}>Cancel</span>
          <span onClick={saveAddTask} style={{ font: '500 12.5px -apple-system,system-ui', color: '#fff', background: 'oklch(0.5 0.12 var(--accent-hue))', padding: '7px 15px', borderRadius: 8, cursor: 'pointer' }}>Add ↵</span>
        </div>
      </div>
    </div>
  );
}
