import type { NotesAppVM } from '../hooks/useNotesApp';

const labelStyle = { font: '600 10.5px ui-monospace,Menlo,monospace', color: '#b5b0a6', letterSpacing: '.04em' } as const;
const inputStyle = { border: '1px solid rgba(0,0,0,.12)', borderRadius: 8, padding: '9px 11px', font: '14px -apple-system,system-ui', color: '#26241f', background: '#fffefb', outline: 'none' } as const;
const monoInputStyle = { ...inputStyle, font: '13px ui-monospace,Menlo,monospace', color: '#403d37' };

export default function EditorPane({ vm }: { vm: NotesAppVM }) {
  const { setState, showPreview, isEml, isMd, isHtml, sourceValue, emlData, active } = vm;

  const paneStyle = {
    flex: 1, minWidth: 0, overflow: 'auto', background: '#fffefb',
    ...(showPreview ? { borderRight: '1px solid rgba(0,0,0,.07)' } : {}),
  } as const;

  if (isEml) {
    return (
      <div className="sc" style={paneStyle}>
        <div style={{ padding: '22px 24px', maxWidth: 680 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ font: '600 13px -apple-system,system-ui', color: '#26241f' }}>Email Template</div>
            <div
              onClick={vm.aiGenerate}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'oklch(0.95 0.03 264)', color: 'oklch(0.45 0.12 264)', font: '500 12px -apple-system,system-ui', cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'oklch(0.92 0.045 264)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'oklch(0.95 0.03 264)'; }}
            >
              ✨ Draft with AI
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={labelStyle}>SUBJECT</span>
              <input value={emlData.subject} onChange={(e) => active && vm.setEml(active.id, 'subject', e.target.value)} style={inputStyle} />
            </label>
            <div style={{ display: 'flex', gap: 12 }}>
              <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={labelStyle}>FROM</span>
                <input value={emlData.from} onChange={(e) => active && vm.setEml(active.id, 'from', e.target.value)} style={monoInputStyle} />
              </label>
              <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={labelStyle}>TO</span>
                <input value={emlData.to} onChange={(e) => active && vm.setEml(active.id, 'to', e.target.value)} style={monoInputStyle} />
              </label>
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={labelStyle}>BODY · HTML</span>
              <textarea
                value={emlData.body}
                onChange={(e) => active && vm.setEml(active.id, 'body', e.target.value)}
                style={{ border: '1px solid rgba(0,0,0,.12)', borderRadius: 8, padding: '12px 13px', font: '12.5px/1.7 ui-monospace,Menlo,monospace', color: '#403d37', background: '#fffefb', outline: 'none', resize: 'none', minHeight: 280 }}
              />
            </label>
          </div>
        </div>
      </div>
    );
  }

  if (isMd || isHtml) {
    return (
      <div className="sc" style={paneStyle}>
        <textarea
          value={sourceValue}
          onChange={vm.onSourceInput}
          onKeyDown={(e) => { if (e.key === 'Escape') setState({ suggest: null }); }}
          ref={vm.sourceElRef}
          spellCheck={false}
          style={{ width: '100%', height: '100%', border: 'none', outline: 'none', resize: 'none', padding: '24px 28px', font: '13.5px/1.85 ui-monospace,Menlo,monospace', color: '#403d37', background: 'transparent' }}
        />
      </div>
    );
  }

  return null;
}
