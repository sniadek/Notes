import type { NotesAppVM } from '../hooks/useNotesApp';
import { todayISO } from '../lib/tasks';

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// Intensity tier (0-2) for a day's note, from its raw source length — a coarse proxy for
// "how much did I write that day" without needing a real word-count pass over every day.
function tierFor(length: number): number {
  if (length <= 0) return 0;
  if (length < 400) return 1;
  return 2;
}

const TIER_COLORS = ['transparent', 'var(--accent-soft)', 'oklch(0.6 0.12 var(--accent-hue))'];

export default function DailyCalendar({ vm, onClose }: { vm: NotesAppVM; onClose: () => void }) {
  const { state, setState, all } = vm;
  const folder = state.dailyFolder || 'Daily';
  const [year, month] = state.calendarMonth.split('-').map(Number); // month is 1-12
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const leadingBlanks = first.getDay();
  const today = todayISO();

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setState({ calendarMonth: d.getFullYear() + '-' + pad2(d.getMonth() + 1) });
  };

  const cells: { iso: string | null; day: number | null }[] = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push({ iso: null, day: null });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ iso: year + '-' + pad2(month) + '-' + pad2(d), day: d });
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute', zIndex: 40, marginTop: 4, width: 240, background: 'var(--bg-surface)',
        border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 16px 44px -12px rgba(0,0,0,.3)', padding: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span onClick={() => shiftMonth(-1)} style={{ cursor: 'pointer', color: 'var(--text-faint)', width: 20, textAlign: 'center' }}>‹</span>
        <span style={{ font: '600 12.5px -apple-system,system-ui', color: 'var(--text-primary)' }}>
          {first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </span>
        <span onClick={() => shiftMonth(1)} style={{ cursor: 'pointer', color: 'var(--text-faint)', width: 20, textAlign: 'center' }}>›</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {WEEKDAY_LETTERS.map((w, i) => (
          <span key={i} style={{ font: '600 9.5px ui-monospace,Menlo,monospace', color: 'var(--text-faintest)', textAlign: 'center' }}>{w}</span>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((c, i) => {
          if (!c.iso) return <span key={i} />;
          const note = all.find((f) => f.folder === folder && f.file === c.iso + '.md');
          const tier = note ? tierFor((state.sources[note.id] || '').length) : 0;
          const isToday = c.iso === today;
          return (
            <span
              key={i}
              onClick={() => { vm.openDailyFor(c.iso!); onClose(); }}
              title={c.iso}
              style={{
                aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer',
                font: '11px -apple-system,system-ui', color: tier === 2 ? '#fff' : 'var(--text-secondary)',
                background: TIER_COLORS[tier],
                outline: isToday ? '1.5px solid var(--accent)' : 'none',
              }}
            >
              {c.day}
            </span>
          );
        })}
      </div>
    </div>
  );
}
