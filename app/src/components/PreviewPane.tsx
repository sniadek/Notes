import type { NotesAppVM } from '../hooks/useNotesApp';
import type { HtmlWidth } from '../types';

const WIDTHS: Record<HtmlWidth, string> = { desktop: '100%', tablet: '768px', mobile: '390px' };

export default function PreviewPane({ vm }: { vm: NotesAppVM }) {
  const { state, setState, isMd, isHtml, isEml, sourceValue, mdHtml, emlData } = vm;

  const paneStyle = {
    flex: 1, minWidth: 0, overflow: 'auto',
    padding: isHtml ? '0' : '40px 44px',
    background: isEml ? '#f3f1ec' : '#fffefb',
  } as const;

  if (isMd) {
    return (
      <div className="sc" style={paneStyle}>
        <div
          key={vm.active?.id}
          ref={vm.previewElRef}
          contentEditable
          suppressContentEditableWarning
          style={{ maxWidth: 640, margin: '0 auto', outline: 'none' }}
          onClick={vm.onPreviewClick}
          onBlur={(e) => {
            if (!vm.active) return;
            vm.setSource(vm.active.id, vm.htmlToMd(e.currentTarget.innerHTML));
          }}
          dangerouslySetInnerHTML={{ __html: mdHtml }}
        />
      </div>
    );
  }

  if (isHtml) {
    const devBtn = (key: HtmlWidth, label: string) => (
      <span
        key={key}
        onClick={() => setState({ htmlWidth: key })}
        style={{
          padding: '4px 11px', borderRadius: 6, cursor: 'pointer', font: '500 11.5px -apple-system,system-ui',
          color: state.htmlWidth === key ? '#26241f' : '#8a8a8f',
          background: state.htmlWidth === key ? '#fffefb' : 'transparent',
          boxShadow: state.htmlWidth === key ? '0 1px 2px rgba(0,0,0,.1)' : 'none',
        }}
      >
        {label}
      </span>
    );
    return (
      <div className="sc" style={paneStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderBottom: '1px solid rgba(0,0,0,.07)', background: '#faf9f7', flex: 'none' }}>
            <div style={{ display: 'flex', gap: 2, background: '#f0eee9', borderRadius: 8, padding: 2 }}>
              {devBtn('desktop', 'Desktop')}
              {devBtn('tablet', 'Tablet')}
              {devBtn('mobile', 'Mobile')}
            </div>
            <span style={{ marginLeft: 'auto', font: '11px ui-monospace,Menlo,monospace', color: '#bdb8af' }}>{WIDTHS[state.htmlWidth]}</span>
            <span
              onClick={() => vm.openInBrowser(sourceValue)}
              style={{ font: '500 11.5px -apple-system,system-ui', color: 'oklch(0.5 0.12 264)', cursor: 'pointer' }}
            >
              ↗ Open in browser
            </span>
          </div>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', overflow: 'auto', padding: 16, background: '#ece9e2', minHeight: 0 }}>
            <iframe
              srcDoc={sourceValue}
              title="preview"
              sandbox="allow-scripts"
              style={{ width: WIDTHS[state.htmlWidth], maxWidth: '100%', height: '100%', minHeight: 520, border: '1px solid rgba(0,0,0,.12)', borderRadius: 10, background: '#fff', boxShadow: '0 6px 24px -10px rgba(0,0,0,.2)' }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (isEml) {
    const card = '<div style="max-width:660px;margin:0 auto;background:#fff;border:1px solid rgba(0,0,0,.09);border-radius:13px;overflow:hidden;box-shadow:0 6px 24px -10px rgba(0,0,0,.18)"><div style="padding:18px 24px;background:#faf9f6;border-bottom:1px solid rgba(0,0,0,.07)"><div style="font:600 17px -apple-system,system-ui;color:#26241f;margin-bottom:10px">'
      + esc(emlData.subject) + '</div><div style="display:flex;gap:8px;font:12px ui-monospace,Menlo,monospace;color:#8a8a8f;margin-bottom:3px"><span style="color:#bdb8af;width:42px">From</span>'
      + esc(emlData.from) + '</div><div style="display:flex;gap:8px;font:12px ui-monospace,Menlo,monospace;color:#8a8a8f"><span style="color:#bdb8af;width:42px">To</span>'
      + esc(emlData.to) + '</div></div><div style="padding:26px 28px">' + emlData.body + '</div></div>';
    return (
      <div className="sc" style={paneStyle}>
        <div ref={vm.previewElRef} dangerouslySetInnerHTML={{ __html: card }} />
      </div>
    );
  }

  return null;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
