import type { NotesAppVM } from '../hooks/useNotesApp';
import { FONT_SCALES } from '../lib/utils';

const labelStyle = { font: '600 10.5px ui-monospace,Menlo,monospace', color: 'var(--text-faint)', letterSpacing: '.04em' } as const;
const inputStyle = { border: '1px solid var(--border)', borderRadius: 8, padding: '9px 11px', font: '14px -apple-system,system-ui', color: 'var(--text-primary)', background: 'var(--bg-surface)', outline: 'none' } as const;
const monoInputStyle = { ...inputStyle, font: '13px ui-monospace,Menlo,monospace', color: 'var(--text-secondary)' };

export default function EditorPane({ vm, pane = 'primary' }: { vm: NotesAppVM; pane?: 'primary' | 'secondary' }) {
  const { setState } = vm;
  const secondary = pane === 'secondary';
  // Both panes can be independently editable at once, so each gets its own source ref/handler
  // (vm.secondary.sourceElRef/onSourceInput for the right column) instead of a shared pair.
  const doc = secondary
    ? {
        file: vm.secondary.file, isMd: vm.secondary.isMd, isHtml: vm.secondary.isHtml, isEml: vm.secondary.isEml,
        sourceValue: vm.secondary.sourceValue, emlData: vm.secondary.emlData, showPreview: vm.secondary.showPreview,
        sourceElRef: vm.secondary.sourceElRef, onSourceInput: vm.secondary.onSourceInput,
      }
    : {
        file: vm.active, isMd: vm.isMd, isHtml: vm.isHtml, isEml: vm.isEml,
        sourceValue: vm.sourceValue, emlData: vm.emlData, showPreview: vm.showPreview,
        sourceElRef: vm.sourceElRef, onSourceInput: vm.onSourceInput,
      };
  const { isEml, isMd, isHtml, sourceValue, emlData, file } = doc;
  const docShowPreview = !!file && doc.showPreview;

  const paneStyle = {
    flex: 1, minWidth: 0, overflow: 'auto', background: 'var(--bg-surface)',
    ...(docShowPreview ? { borderRight: '1px solid var(--border)' } : {}),
  } as const;

  if (isEml) {
    return (
      <div className="sc" tabIndex={0} style={paneStyle}>
        <div style={{ padding: '22px 24px', maxWidth: 680 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ font: '600 13px -apple-system,system-ui', color: 'var(--text-primary)' }}>Email Template</div>
            <div
              onClick={() => file && vm.aiGenerate(file.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'oklch(0.95 0.03 var(--accent-hue))', color: 'oklch(0.45 0.12 var(--accent-hue))', font: '500 12px -apple-system,system-ui', cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'oklch(0.92 0.045 var(--accent-hue))'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'oklch(0.95 0.03 var(--accent-hue))'; }}
            >
              ✨ Draft with AI
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={labelStyle}>SUBJECT</span>
              <input value={emlData.subject} onChange={(e) => file && vm.setEml(file.id, 'subject', e.target.value)} style={inputStyle} />
            </label>
            <div style={{ display: 'flex', gap: 12 }}>
              <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={labelStyle}>FROM</span>
                <input value={emlData.from} onChange={(e) => file && vm.setEml(file.id, 'from', e.target.value)} style={monoInputStyle} />
              </label>
              <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={labelStyle}>TO</span>
                <input value={emlData.to} onChange={(e) => file && vm.setEml(file.id, 'to', e.target.value)} style={monoInputStyle} />
              </label>
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={labelStyle}>BODY · HTML</span>
              <textarea
                aria-label="Email body"
                value={emlData.body}
                onChange={(e) => file && vm.setEml(file.id, 'body', e.target.value)}
                style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '12px 13px', font: '12.5px/1.7 ui-monospace,Menlo,monospace', color: 'var(--text-secondary)', background: 'var(--bg-surface)', outline: 'none', resize: 'none', minHeight: 280 }}
              />
            </label>
          </div>
        </div>
      </div>
    );
  }

  if (isMd || isHtml) {
    return (
      <div className="sc" tabIndex={0} style={paneStyle}>
        <textarea
          aria-label="Note source editor"
          value={sourceValue}
          onChange={doc.onSourceInput}
          onKeyDown={(e) => { if (e.key === 'Escape') setState({ suggest: null }); }}
          ref={doc.sourceElRef}
          spellCheck={false}
          style={{
            width: '100%', height: '100%', border: 'none', outline: 'none', resize: 'none', padding: '24px 28px',
            font: '13.5px/1.85 ui-monospace,Menlo,monospace', color: 'var(--text-secondary)', background: 'transparent',
            zoom: FONT_SCALES[vm.state.docFontSize],
          }}
        />
      </div>
    );
  }

  return null;
}
