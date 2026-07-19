import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { NotesAppVM } from '../hooks/useNotesApp';
import { todayISO } from '../lib/tasks';

const MOODS = [
  { value: '1', emoji: '😞' },
  { value: '2', emoji: '🙁' },
  { value: '3', emoji: '😐' },
  { value: '4', emoji: '🙂' },
  { value: '5', emoji: '😄' },
];

// Mirrors routeDailyCapture's routing rules (lib/utils.ts) — kept here as a plain reference
// list rather than derived from it, since the routing function has no metadata to introspect.
const ROUTING_CHEATSHEET = [
  { prefix: '(nothing)', dest: 'Log' },
  { prefix: 'todo / t', dest: 'Tasks' },
  { prefix: '? / q', dest: 'Questions' },
  { prefix: 'mood:: N', dest: 'Mood' },
  { prefix: '@Name', dest: 'links [[Name]]' },
];

function CalendarIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flex: 'none' }}>
      <rect x="2" y="3.5" width="12" height="10.5" rx="2" stroke="var(--text-secondary)" strokeWidth="1.3" />
      <line x1="2" y1="6.5" x2="14" y2="6.5" stroke="var(--text-secondary)" strokeWidth="1.3" />
      <line x1="5" y1="2" x2="5" y2="4.2" stroke="var(--text-secondary)" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="11" y1="2" x2="11" y2="4.2" stroke="var(--text-secondary)" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export default function DailyCaptureModal({ vm }: { vm: NotesAppVM }) {
  const {
    state, setState, closeDailyCapture, saveDailyCapture, appendDaily, dailyCaptureInputRef,
  } = vm;
  const [pickedMood, setPickedMood] = useState<string | null>(null);

  if (!state.dailyCaptureOpen) return null;

  // Mood is a one-tap capture independent of the textarea/Add button — it appends
  // immediately via the same appendDaily pipeline, routed to a Mood section.
  const pickMood = (value: string) => {
    appendDaily('mood:: ' + value, state.dailyCaptureDate);
    setPickedMood(value);
    setTimeout(() => setPickedMood(null), 1200);
  };

  // Enter saves; Shift+Enter inserts a newline (so multi-line captures are possible);
  // Escape closes without writing (the global Escape handler also covers this).
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveDailyCapture(); }
    else if (e.key === 'Escape') { e.preventDefault(); closeDailyCapture(); }
  };

  return (
    <div onClick={closeDailyCapture} style={{ position: 'fixed', inset: 0, background: 'rgba(30,28,24,.28)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '16vh', zIndex: 51, animation: 'fade .12s ease' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 480, maxWidth: '92vw', background: 'var(--bg-surface)', borderRadius: 14, boxShadow: 'var(--shadow-modal)', border: '1px solid rgba(0,0,0,.08)', overflow: 'hidden', animation: 'pop .14s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <CalendarIcon />
          <span style={{ font: '600 13.5px -apple-system,system-ui', color: 'var(--text-primary)' }}>Add to Daily Note</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 7 }}>
            <input
              type="date"
              value={state.dailyCaptureDate || todayISO()}
              onChange={(e) => setState({ dailyCaptureDate: e.target.value })}
              title="Which day's note to add to"
              style={{ font: '12px ui-monospace,Menlo,monospace', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 6px', background: 'var(--bg-surface)' }}
            />
            {(state.dailyCaptureDate && state.dailyCaptureDate !== todayISO()) && (
              <span
                onClick={() => setState({ dailyCaptureDate: todayISO() })}
                style={{ font: '11px -apple-system,system-ui', color: 'oklch(0.5 0.12 var(--accent-hue))', cursor: 'pointer' }}
              >
                Today
              </span>
            )}
          </div>
        </div>

        <div style={{ padding: '16px 18px' }}>
          <textarea
            aria-label="Daily capture entry"
            value={state.dailyCaptureText}
            onChange={(e) => setState({ dailyCaptureText: e.target.value })}
            onKeyDown={onKeyDown}
            ref={dailyCaptureInputRef}
            placeholder="Log an entry…  ·  prefix with “todo” for a task, “?” for a question"
            rows={4}
            style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, outline: 'none', padding: '9px 11px', font: '14px -apple-system,system-ui', color: 'var(--text-primary)', background: 'var(--bg-surface)', resize: 'vertical', minHeight: 80 }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <span style={{ font: '12px -apple-system,system-ui', color: 'var(--text-faint)' }}>Mood</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {MOODS.map((m) => (
                <span
                  key={m.value}
                  onClick={() => pickMood(m.value)}
                  title={'Log mood ' + m.value + '/5'}
                  style={{
                    width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, cursor: 'pointer', fontSize: 15,
                    background: pickedMood === m.value ? 'var(--accent-soft)' : 'transparent',
                  }}
                >
                  {m.emoji}
                </span>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-soft)' }}>
            {ROUTING_CHEATSHEET.map((r) => (
              <span
                key={r.prefix}
                title={'Routes to ' + r.dest}
                style={{ display: 'flex', alignItems: 'center', gap: 5, font: '11px -apple-system,system-ui', color: 'var(--text-faint)', background: 'var(--bg-subtle)', padding: '3px 8px', borderRadius: 11 }}
              >
                <span style={{ font: '600 11px ui-monospace,Menlo,monospace', color: 'var(--text-secondary)' }}>{r.prefix}</span>
                <span>→ {r.dest}</span>
              </span>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 9, padding: '11px 16px', borderTop: '1px solid var(--border)' }}>
          <span onClick={closeDailyCapture} style={{ font: '500 12.5px -apple-system,system-ui', color: 'var(--text-muted)', padding: '7px 13px', borderRadius: 8, cursor: 'pointer' }}>Cancel</span>
          <span onClick={saveDailyCapture} style={{ font: '500 12.5px -apple-system,system-ui', color: '#fff', background: 'oklch(0.5 0.12 var(--accent-hue))', padding: '7px 15px', borderRadius: 8, cursor: 'pointer' }}>Add ↵</span>
        </div>
      </div>
    </div>
  );
}
