import type { NotesAppVM } from '../hooks/useNotesApp';

const sectionLabel = { font: '600 10.5px ui-monospace,Menlo,monospace', color: 'var(--text-faint)', letterSpacing: '.05em', marginBottom: 12 } as const;

export default function ContextRail({ vm }: { vm: NotesAppVM }) {
  const { outline, backlinks, unlinked, active, childrenOf } = vm;
  const subPages = active ? childrenOf(active.id) : [];
  return (
    <div className="sc" style={{ width: 250, background: '#faf9f6', borderLeft: '1px solid rgba(0,0,0,.06)', overflow: 'auto', flex: 'none', padding: '22px 18px' }}>
      {subPages.length > 0 && (
        <>
          <div style={sectionLabel}>SUB-PAGES · {subPages.length}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 28 }}>
            {subPages.map((c) => (
              <div
                key={c.id}
                onClick={() => vm.open(c.id)}
                style={{ padding: '10px 12px', background: '#fff', border: '1px solid rgba(0,0,0,.06)', borderRadius: 9, cursor: 'pointer' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'oklch(0.8 0.08 var(--accent-hue))'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,0,.06)'; }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{c.title}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={sectionLabel}>OUTLINE</div>
      {outline.length > 0
        ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 28 }}>
            {outline.map((o, i) => (
              <span
                key={i}
                onClick={() => vm.scrollTo(o.id)}
                style={{
                  cursor: 'pointer', fontSize: 12.5, padding: `3px 0 3px ${(o.level - 1) * 12}px`,
                  color: o.level === 1 ? 'var(--text-secondary)' : 'var(--text-muted)',
                  fontWeight: o.level === 1 ? 500 : 400,
                }}
              >
                {o.text}
              </span>
            ))}
          </div>
        )
        : <div style={{ font: '400 12px -apple-system,system-ui', color: '#c4c0b6', marginBottom: 28 }}>No headings</div>}

      <div style={sectionLabel}>BACKLINKS · {backlinks.length}</div>
      {backlinks.length > 0
        ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {backlinks.map((b) => (
              <div
                key={b.id}
                onClick={() => vm.open(b.id)}
                style={{ padding: '10px 12px', background: '#fff', border: '1px solid rgba(0,0,0,.06)', borderRadius: 9, cursor: 'pointer' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'oklch(0.8 0.08 var(--accent-hue))'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,0,.06)'; }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{b.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3, lineHeight: 1.45 }}>{b.snippet}</div>
              </div>
            ))}
          </div>
        )
        : <div style={{ font: '400 12px -apple-system,system-ui', color: '#c4c0b6' }}>No backlinks yet</div>}

      {unlinked.length > 0 && (
        <>
          <div style={{ ...sectionLabel, margin: '26px 0 12px' }}>UNLINKED MENTIONS · {unlinked.length}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {unlinked.map((u) => (
              <div
                key={u.id}
                onClick={() => vm.open(u.id)}
                style={{ padding: '10px 12px', background: '#fff', border: '1px dashed rgba(0,0,0,.16)', borderRadius: 9, cursor: 'pointer' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'oklch(0.78 0.09 var(--accent-hue))'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,0,.16)'; }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{u.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3, lineHeight: 1.45 }}>{u.snippet}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
