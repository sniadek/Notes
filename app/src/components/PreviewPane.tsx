import { useEffect, useRef, useState } from 'react';
import type { NotesAppVM } from '../hooks/useNotesApp';
import type { HtmlWidth } from '../types';
import { FONT_SCALES } from '../lib/utils';
import { assetUrl } from '../lib/tauriFs';

const WIDTHS: Record<HtmlWidth, string> = { desktop: '100%', tablet: '768px', mobile: '390px' };

export default function PreviewPane({ vm, pane = 'primary' }: { vm: NotesAppVM; pane?: 'primary' | 'secondary' }) {
  const { state, setState } = vm;
  const secondary = pane === 'secondary';
  const doc = secondary
    ? vm.secondary
    : {
        id: vm.active?.id ?? null, file: vm.active, isMd: vm.isMd, isHtml: vm.isHtml, isEml: vm.isEml, isPdf: vm.isPdf, isImage: vm.isImage,
        sourceValue: vm.sourceValue, mdHtml: vm.mdHtml, emlData: vm.emlData,
        previewElRef: vm.previewElRef, onPreviewClick: vm.onPreviewClick,
      };
  const { isMd, isHtml, isEml, isPdf, isImage, sourceValue, mdHtml, emlData, file } = doc;
  const htmlFrameRef = useRef<HTMLIFrameElement | null>(null);
  const [pdfSrc, setPdfSrc] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!isPdf || !vm.isTauri || !file?.path) { setPdfSrc(null); return; }
    let cancelled = false;
    assetUrl(file.path).then((url) => { if (!cancelled) setPdfSrc(url); });
    return () => { cancelled = true; };
  }, [isPdf, vm.isTauri, file?.path]);

  useEffect(() => {
    if (!isImage || !vm.isTauri || !file?.path) { setImageSrc(null); return; }
    let cancelled = false;
    assetUrl(file.path).then((url) => { if (!cancelled) setImageSrc(url); });
    return () => { cancelled = true; };
  }, [isImage, vm.isTauri, file?.path]);

  const paneStyle = {
    flex: 1, minWidth: 0, overflow: 'auto',
    padding: isHtml || isPdf ? '0' : isImage ? '24px' : '40px 44px',
    background: isEml ? 'var(--bg-canvas)' : isImage ? 'var(--bg-canvas)' : 'var(--bg-surface)',
  } as const;

  if (isMd) {
    return (
      <div className="sc" style={paneStyle}>
        <div
          key={file?.id}
          ref={doc.previewElRef}
          contentEditable
          suppressContentEditableWarning
          style={{
            maxWidth: state.docWidth === 'full' ? 'none' : 640, margin: '0 auto', outline: 'none',
            zoom: FONT_SCALES[state.docFontSize],
          }}
          onClick={doc.onPreviewClick}
          onBlur={(e) => {
            if (!file) return;
            vm.setSource(file.id, vm.htmlToMd(e.currentTarget.innerHTML));
          }}
          onMouseUp={() => vm.selectPreviewTextInSource(window.getSelection()?.toString() || '', pane)}
          onKeyUp={() => vm.selectPreviewTextInSource(window.getSelection()?.toString() || '', pane)}
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
          color: state.htmlWidth === key ? 'var(--text-primary)' : 'var(--text-muted)',
          background: state.htmlWidth === key ? 'var(--bg-surface)' : 'transparent',
          boxShadow: state.htmlWidth === key ? '0 1px 2px rgba(0,0,0,.1)' : 'none',
        }}
      >
        {label}
      </span>
    );
    return (
      <div className="sc" style={paneStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-bar)', flex: 'none' }}>
            <div style={{ display: 'flex', gap: 2, background: 'var(--bg-subtle)', borderRadius: 8, padding: 2 }}>
              {devBtn('desktop', 'Desktop')}
              {devBtn('tablet', 'Tablet')}
              {devBtn('mobile', 'Mobile')}
            </div>
            <span style={{ marginLeft: 'auto', font: '11px ui-monospace,Menlo,monospace', color: 'var(--text-faintest)' }}>{WIDTHS[state.htmlWidth]}</span>
            <span
              onClick={() => vm.openInBrowser(sourceValue)}
              style={{ font: '500 11.5px -apple-system,system-ui', color: 'oklch(0.5 0.12 var(--accent-hue))', cursor: 'pointer' }}
            >
              ↗ Open in browser
            </span>
          </div>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', overflow: 'auto', padding: 16, background: 'var(--bg-canvas)', minHeight: 0 }}>
            <iframe
              key={file?.id}
              ref={htmlFrameRef}
              srcDoc={sourceValue}
              title="preview"
              sandbox="allow-scripts allow-same-origin"
              onLoad={() => {
                const iframeDoc = htmlFrameRef.current?.contentDocument;
                const id = file?.id;
                if (!iframeDoc || !id) return;
                iframeDoc.designMode = 'on';
                iframeDoc.addEventListener('focusout', () => {
                  vm.setSource(id, '<!doctype html>\n' + iframeDoc.documentElement.outerHTML);
                });
                const onSelect = () => vm.selectPreviewTextInSource(iframeDoc.getSelection()?.toString() || '', pane);
                iframeDoc.addEventListener('mouseup', onSelect);
                iframeDoc.addEventListener('keyup', onSelect);
                if (secondary) {
                  // Clicks inside this iframe never bubble to the parent document, so the
                  // column wrapper's onMouseDown can't catch focus/highlight changes — do it
                  // explicitly here, the same way clicking its tab would.
                  iframeDoc.addEventListener('mousedown', () => vm.open(id));
                }
              }}
              style={{ width: WIDTHS[state.htmlWidth], maxWidth: '100%', height: '100%', minHeight: 520, border: '1px solid rgba(0,0,0,.12)', borderRadius: 10, background: '#fff', boxShadow: '0 6px 24px -10px rgba(0,0,0,.2)' }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (isEml) {
    const card = '<div style="max-width:660px;margin:0 auto;background:#fff;border:1px solid rgba(0,0,0,.09);border-radius:13px;overflow:hidden;box-shadow:0 6px 24px -10px rgba(0,0,0,.18)"><div style="padding:18px 24px;background:#faf9f6;border-bottom:1px solid var(--border)"><div style="font:600 17px -apple-system,system-ui;color:var(--text-primary);margin-bottom:10px">'
      + esc(emlData.subject) + '</div><div style="display:flex;gap:8px;font:12px ui-monospace,Menlo,monospace;color:var(--text-muted);margin-bottom:3px"><span style="color:var(--text-faintest);width:42px">From</span>'
      + esc(emlData.from) + '</div><div style="display:flex;gap:8px;font:12px ui-monospace,Menlo,monospace;color:var(--text-muted)"><span style="color:var(--text-faintest);width:42px">To</span>'
      + esc(emlData.to) + '</div></div><div style="padding:26px 28px">' + emlData.body + '</div></div>';
    return (
      <div className="sc" style={paneStyle}>
        <div ref={doc.previewElRef} dangerouslySetInnerHTML={{ __html: card }} />
      </div>
    );
  }

  if (isPdf) {
    return (
      <div className="sc" style={paneStyle}>
        {pdfSrc ? (
          <iframe key={file?.id} src={pdfSrc} title="pdf preview" style={{ width: '100%', height: '100%', border: 'none' }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-faint)', font: '13px -apple-system,system-ui' }}>
            PDF preview requires a connected vault.
          </div>
        )}
      </div>
    );
  }

  if (isImage) {
    return (
      <div className="sc" style={paneStyle}>
        {imageSrc ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <img
              key={file?.id}
              src={imageSrc}
              alt={file?.title || ''}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8, boxShadow: '0 6px 24px -10px rgba(0,0,0,.25)' }}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-faint)', font: '13px -apple-system,system-ui' }}>
            Image preview requires a connected vault.
          </div>
        )}
      </div>
    );
  }

  return null;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
