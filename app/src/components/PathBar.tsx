import type { NotesAppVM } from '../hooks/useNotesApp';

export default function PathBar({ vm }: { vm: NotesAppVM }) {
  const { state, setState, pathSegments, activeTags, canHistory, isHtml, isEml } = vm;

  const exportItems = vm.active ? [
    { icon: '⎙', label: 'Print / Save as PDF', onClick: () => { setState({ exportOpen: false }); vm.exportPrint(); } },
    { icon: '↓', label: 'Download ' + (isHtml ? '.html' : isEml ? '.eml' : '.md'), onClick: () => { setState({ exportOpen: false }); vm.exportDownload(); } },
    { icon: 'W', label: 'Download Word .doc', onClick: () => { setState({ exportOpen: false }); vm.exportDoc(); } },
    { icon: '⧉', label: 'Copy as HTML', onClick: () => { setState({ exportOpen: false }); vm.exportCopyHtml(); } },
  ] : [];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 32, flex: 'none', padding: '0 18px', borderBottom: '1px solid var(--border-soft)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 'none' }}>
        {pathSegments.map((seg, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {i > 0 && <span style={{ font: '500 11px ui-monospace,Menlo,monospace', color: '#d6d1c7', flex: 'none' }}>/</span>}
            <span
              onClick={() => { if (seg.id) vm.open(seg.id); }}
              title={seg.title}
              style={{
                font: '500 11px ui-monospace,Menlo,monospace', flex: 'none', whiteSpace: 'nowrap', borderRadius: 5, padding: '2px 5px',
                ...(seg.current ? { color: 'var(--text-muted)' } : { color: 'var(--text-faintest)', cursor: 'pointer' }),
              }}
              onMouseEnter={(e) => { if (!seg.current) { e.currentTarget.style.background = 'var(--bg-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
              onMouseLeave={(e) => { if (!seg.current) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-faintest)'; } }}
            >
              {seg.label}
            </span>
          </span>
        ))}
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
        {activeTags.map((tg) => (
          <span
            key={tg}
            onClick={() => setState({ filter: 'tag:' + tg })}
            style={{ font: '500 10.5px -apple-system,system-ui', color: 'oklch(0.5 0.1 var(--accent-hue))', background: 'oklch(0.95 0.03 var(--accent-hue))', padding: '2px 9px', borderRadius: 11, cursor: 'pointer' }}
          >
            #{tg}
          </span>
        ))}
        {canHistory && (
          <span
            onClick={() => setState({ historyOpen: true, historyPick: 0 })}
            title="Version history"
            style={{ display: 'flex', alignItems: 'center', gap: 5, font: '500 11px -apple-system,system-ui', color: 'var(--text-muted)', padding: '3px 9px', borderRadius: 7, cursor: 'pointer' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-subtle)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            ⟲ History
          </span>
        )}
        <div style={{ position: 'relative' }}>
          <span
            onClick={() => setState((s) => ({ exportOpen: !s.exportOpen }))}
            title="Export"
            style={{ display: 'flex', alignItems: 'center', gap: 5, font: '500 11px -apple-system,system-ui', color: 'var(--text-muted)', padding: '3px 9px', borderRadius: 7, cursor: 'pointer' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-subtle)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            ⤓ Export
          </span>
          {state.exportOpen && (
            <div style={{ position: 'absolute', top: 28, right: 0, zIndex: 30, width: 210, background: 'var(--bg-surface)', border: '1px solid rgba(0,0,0,.12)', borderRadius: 10, boxShadow: '0 16px 44px -12px rgba(0,0,0,.3)', overflow: 'hidden', animation: 'pop .1s ease', padding: 5 }}>
              {exportItems.map((x) => (
                <div
                  key={x.label}
                  onClick={x.onClick}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 11px', borderRadius: 7, cursor: 'pointer', font: '13px -apple-system,system-ui', color: 'var(--text-primary)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'oklch(0.96 0.02 var(--accent-hue))'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ width: 16, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>{x.icon}</span>{x.label}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
