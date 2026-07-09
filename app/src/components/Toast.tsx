import type { NotesAppVM } from '../hooks/useNotesApp';

// Transient confirmation shown after a daily-note capture, with an Undo affordance.
// Auto-dismisses after a few seconds (timer lives in useNotesApp).
export default function Toast({ vm }: { vm: NotesAppVM }) {
  const { state, undoLastCapture, dismissToast } = vm;
  if (!state.toast) return null;

  return (
    <div style={{ position: 'fixed', bottom: 26, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 60, pointerEvents: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--text-primary)', color: 'var(--bg-surface)', padding: '9px 10px 9px 15px', borderRadius: 10, boxShadow: '0 10px 30px -8px rgba(0,0,0,.4)', font: '13px -apple-system,system-ui', pointerEvents: 'auto', animation: 'pop .14s ease' }}>
        <span>{state.toast.message}</span>
        <span
          onClick={undoLastCapture}
          style={{ font: '600 13px -apple-system,system-ui', color: 'oklch(0.8 0.11 var(--accent-hue))', cursor: 'pointer', padding: '3px 8px', borderRadius: 6 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,.12)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          Undo
        </span>
        <span
          onClick={dismissToast}
          title="Dismiss"
          style={{ color: 'var(--bg-surface)', opacity: 0.55, cursor: 'pointer', fontSize: 15, padding: '0 4px' }}
        >
          ×
        </span>
      </div>
    </div>
  );
}
