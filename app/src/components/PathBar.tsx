import type { NotesAppVM } from '../hooks/useNotesApp';

export default function PathBar({ vm, pane = 'primary' }: { vm: NotesAppVM; pane?: 'primary' | 'secondary' }) {
  const { state, setState } = vm;
  const secondary = pane === 'secondary';

  const file = secondary ? vm.secondary.file : vm.active;
  const segments = secondary ? vm.secondaryPathSegments : vm.pathSegments;
  const tags = secondary ? vm.secondaryActiveTags : vm.activeTags;
  const canHistory = secondary ? vm.secondaryCanHistory : vm.canHistory;
  const isHtml = file?.type === 'html';
  const isEml = file?.type === 'eml';
  const targetId = file?.id ?? null;
  const exportOpen = secondary ? state.exportOpenSecondary : state.exportOpen;
  const setExportOpen = (open: boolean) => setState(secondary ? { exportOpenSecondary: open } : { exportOpen: open });

  const canExport = !!file && file.type !== 'pdf' && file.type !== 'image';
  const exportItems = canExport ? [
    { icon: '⎙', label: 'Print / Save as PDF', onClick: () => { setExportOpen(false); vm.exportPrint(targetId); } },
    { icon: '↓', label: 'Download ' + (isHtml ? '.html' : isEml ? '.eml' : '.md'), onClick: () => { setExportOpen(false); vm.exportDownload(targetId); } },
    { icon: 'W', label: 'Download Word .doc', onClick: () => { setExportOpen(false); vm.exportDoc(targetId); } },
    { icon: '⧉', label: 'Copy as HTML', onClick: () => { setExportOpen(false); vm.exportCopyHtml(targetId); } },
  ] : [];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 32, flex: 'none', padding: '0 18px', borderBottom: '1px solid var(--border-soft)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 'none' }}>
        {segments.map((seg, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {i > 0 && <span style={{ font: '500 11px ui-monospace,Menlo,monospace', color: 'var(--text-faint)', flex: 'none' }}>/</span>}
            <span
              onClick={() => { if (seg.path) vm.openFolder(seg.path); else if (seg.id) vm.open(seg.id); }}
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
        {tags.map((tg) => (
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
            onClick={() => setState({ historyOpen: true, historyPick: 0, historyTargetId: secondary ? targetId : null })}
            title="Version history"
            style={{ display: 'flex', alignItems: 'center', gap: 5, font: '500 11px -apple-system,system-ui', color: 'var(--text-muted)', padding: '3px 9px', borderRadius: 7, cursor: 'pointer' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-subtle)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            ⟲ History
          </span>
        )}
        {canExport && (
          <div style={{ position: 'relative' }}>
            <span
              onClick={() => setExportOpen(!exportOpen)}
              title="Export"
              style={{ display: 'flex', alignItems: 'center', gap: 5, font: '500 11px -apple-system,system-ui', color: 'var(--text-muted)', padding: '3px 9px', borderRadius: 7, cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-subtle)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              ⤓ Export
            </span>
            {exportOpen && (
              <div style={{ position: 'absolute', top: 28, right: 0, zIndex: 30, width: 210, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 16px 44px -12px rgba(0,0,0,.3)', overflow: 'hidden', animation: 'pop .1s ease', padding: 5 }}>
                {exportItems.map((x) => (
                  <div
                    key={x.label}
                    onClick={x.onClick}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 11px', borderRadius: 7, cursor: 'pointer', font: '13px -apple-system,system-ui', color: 'var(--text-primary)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ width: 16, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>{x.icon}</span>{x.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
