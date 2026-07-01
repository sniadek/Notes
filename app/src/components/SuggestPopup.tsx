import { useState } from 'react';
import type { NotesAppVM } from '../hooks/useNotesApp';

export default function SuggestPopup({ vm }: { vm: NotesAppVM }) {
  const { state, suggestItems, suggestTitle, pickSuggest } = vm;
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (!state.suggest) return null;

  return (
    <div style={{ position: 'absolute', left: 20, bottom: 40, zIndex: 24, width: 280, background: 'var(--bg-surface)', border: '1px solid rgba(0,0,0,.12)', borderRadius: 11, boxShadow: '0 16px 44px -12px rgba(0,0,0,.3)', overflow: 'hidden', animation: 'rise .1s ease' }}>
      <div style={{ padding: '7px 12px', font: '600 10px ui-monospace,Menlo,monospace', color: 'var(--text-faint)', letterSpacing: '.05em', borderBottom: '1px solid rgba(0,0,0,.06)' }}>{suggestTitle}</div>
      {suggestItems.map((s, i) => (
        <div
          key={i}
          onClick={() => pickSuggest(s.isCreate ? state.suggest!.q : s.label)}
          onMouseEnter={() => setHoverIdx(i)}
          onMouseLeave={() => setHoverIdx(null)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', font: '13px -apple-system,system-ui', color: 'var(--text-primary)', background: hoverIdx === i ? 'oklch(0.96 0.02 var(--accent-hue))' : 'transparent' }}
        >
          <span>{s.icon}</span>
          <span style={{ flex: 1 }}>{s.label}</span>
          <span style={{ font: '10.5px ui-monospace,Menlo,monospace', color: 'var(--text-faintest)' }}>{s.hint}</span>
        </div>
      ))}
    </div>
  );
}
