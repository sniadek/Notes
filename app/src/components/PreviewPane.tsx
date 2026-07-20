import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import type { NotesAppVM } from '../hooks/useNotesApp';
import type { HtmlWidth } from '../types';
import { FONT_SCALES } from '../lib/utils';
import { esc } from '../lib/markdown';
import { assetUrl } from '../lib/tauriFs';

export const WIDTHS: Record<HtmlWidth, string> = { desktop: '100%', tablet: '768px', mobile: '390px' };

export default function PreviewPane({ vm, pane = 'primary' }: { vm: NotesAppVM; pane?: 'primary' | 'secondary' }) {
  const { state, setState } = vm;
  const secondary = pane === 'secondary';
  const doc = secondary
    ? vm.secondary
    : {
        id: vm.active?.id ?? null, file: vm.active, isMd: vm.isMd, isHtml: vm.isHtml, isEml: vm.isEml, isPdf: vm.isPdf, isImage: vm.isImage,
        sourceValue: vm.sourceValue, mdHtml: vm.mdHtml, emlData: vm.emlData, frontMatter: vm.frontMatter,
        previewElRef: vm.previewElRef, onPreviewClick: vm.onPreviewClick,
      };
  const { isMd, isHtml, isEml, isPdf, isImage, sourceValue, mdHtml, emlData, file } = doc;
  const htmlFrameRef = useRef<HTMLIFrameElement | null>(null);
  const [pdfSrc, setPdfSrc] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  // Whether the contentEditable markdown preview actually received an edit — blur alone
  // must not trigger the HTML→md write-back (it's lossy for anything the renderer doesn't
  // round-trip, and it fires on a mere click into the preview and away).
  const previewEditedRef = useRef(false);
  // Render-updated snapshot of everything a commit needs, so the debounced write-through
  // below reads fire-time values instead of closure-captured stale ones (after the first
  // debounced commit re-renders this component, sourceValue/frontMatter have moved on).
  const docSnapshotRef = useRef({ fileId: file?.id ?? null, sourceValue, frontMatterBody: doc.frontMatter.body });
  docSnapshotRef.current = { fileId: file?.id ?? null, sourceValue, frontMatterBody: doc.frontMatter.body };
  const commitTimerRef = useRef<number | undefined>(undefined);
  // The core discriminator that finally kills the data-loss bug (confirmed by live repro):
  // real user typing fires an `input` event; a spontaneous DOM reset (React re-rendering the
  // dangerouslySetInnerHTML out from under an active edit — the "mystery revert") does NOT.
  // So we only trust a commit when something was actually typed since the last one. dirty
  // flips true on every onInput and false after every successful commit; lastInputTextLength
  // records the DOM's text length at the moment of that last real keystroke, so a commit can
  // also detect the DOM having shrunk *between* the keystroke and the commit firing (a revert
  // landing inside the 400ms debounce window). Without these, onBlur would re-convert a
  // reverted DOM and overwrite the good content the write-through already saved.
  const dirtySinceCommitRef = useRef(false);
  const lastInputTextLengthRef = useRef(0);

  // Converts the preview DOM back to markdown and commits it to app state. Called on blur
  // (as always) AND on a 400ms typing-pause debounce from onInput — the write-through that
  // makes the contentEditable DOM never the sole owner of typed text. Six attempts at
  // guarding specific triggers for the "text typed in preview disappears after ~10s" bug
  // failed to fully kill it; committing continuously makes the worst case a ≤400ms visual
  // revert instead of data loss, regardless of what resets the DOM.
  const commitPreview = (el: HTMLElement) => {
    const snap = docSnapshotRef.current;
    if (!snap.fileId) return;
    // Nothing was typed since the last successful commit — so whatever the DOM shows now got
    // there via a spontaneous reset, not the user. Committing it would overwrite the good
    // content the previous commit already saved. This is the exact blur-after-revert step
    // that destroyed data in the live repro (source went 19 words → 14 on the click-away).
    if (!dirtySinceCommitRef.current) return;
    // A revert can also land *inside* the 400ms debounce window, after the last keystroke but
    // before this commit fires. If the DOM's visible text has shrunk well below what it was at
    // that last keystroke, it was reset externally — don't commit the reverted content.
    const domTextLength = (el.textContent || '').trim().length;
    if (lastInputTextLengthRef.current > 20 && domTextLength < lastInputTextLengthRef.current * 0.6) return;
    // The preview renders only the frontmatter body, so the write-back has to re-attach
    // the original frontmatter block or a commit would delete tags/metadata.
    const prefix = snap.sourceValue.slice(0, snap.sourceValue.length - snap.frontMatterBody.length);
    const converted = vm.htmlToMd(el.innerHTML);
    // Guard against a lossy HTML→md round-trip: browser-generated contentEditable markup
    // (e.g. nested <div>/<p> structures from repeated Enter presses) isn't always something
    // htmlToMd's shallow traversal fully understands. Comparing against the DOM's own raw
    // visible text catches a conversion that came back drastically emptier than what's on
    // screen — that's a broken conversion, not a real deletion, so skip the write.
    const convertedLength = converted.trim().length;
    if (domTextLength > 20 && convertedLength < domTextLength * 0.3) return;
    dirtySinceCommitRef.current = false;
    vm.setSource(snap.fileId, prefix + converted);
  };
  // Latest commit fn for the note-switch cleanup below, which runs with an older closure.
  const commitPreviewRef = useRef(commitPreview);
  commitPreviewRef.current = commitPreview;

  useEffect(() => {
    previewEditedRef.current = false;
    dirtySinceCommitRef.current = false;
    lastInputTextLengthRef.current = 0;
    return () => {
      if (commitTimerRef.current) window.clearTimeout(commitTimerRef.current);
      previewEditedRef.current = false;
      dirtySinceCommitRef.current = false;
    };
  }, [file?.id]);
  // Renders the markdown into the contentEditable imperatively rather than via React's
  // dangerouslySetInnerHTML. This is the fix that finally kills the data-loss bug (confirmed
  // by live repro): with dangerouslySetInnerHTML, React would reset the DOM to a (sometimes
  // stale) HTML string on ANY unrelated re-render while the user was mid-edit — the "mystery
  // revert" that then got re-committed over the good content on blur. Managing innerHTML by
  // hand means React never touches the edited DOM; we only re-sync when the note actually
  // changes or its source changes *externally*, and we NEVER sync while the div is focused
  // (the DOM is the source of truth during an active edit). Crucially, when we do sync we use
  // the current mdHtml — which already reflects any edit the write-through committed — so a
  // resync can never drop typed text. useLayoutEffect (not useEffect) avoids a blank flash.
  useLayoutEffect(() => {
    const el = doc.previewElRef.current;
    if (!el) return;
    if (el === document.activeElement) return; // don't clobber an in-progress edit
    if (el.innerHTML !== mdHtml) el.innerHTML = mdHtml;
  }, [mdHtml, file?.id, doc.previewElRef]);

  // Same write-through/freeze pattern as the markdown preview above, adapted for the HTML
  // iframe: `srcDoc` is inherently a "reload on change" prop — setting it while the iframe is
  // focused would nuke designMode state and any not-yet-committed edit, the iframe equivalent
  // of the dangerouslySetInnerHTML reset that caused the markdown data-loss bug. Freezing it
  // while focused (only re-syncing to the live sourceValue once focus leaves the iframe) means
  // our own debounced commits below — which update sourceValue — can never trigger a
  // disruptive reload mid-edit, while external changes (e.g. editing the same file in the
  // raw pane) still flow in as soon as the iframe isn't the thing being edited.
  const frozenSrcDocRef = useRef(sourceValue);
  const iframeHasFocus = !!htmlFrameRef.current && document.activeElement === htmlFrameRef.current;
  if (!iframeHasFocus) frozenSrcDocRef.current = sourceValue;
  // Poll interval id for the HTML iframe's write-through (see onLoad below) — cleared on
  // note switch/unmount so a stale poll never fires against a torn-down iframe.
  const htmlPollRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    return () => { if (htmlPollRef.current) window.clearInterval(htmlPollRef.current); };
  }, [file?.id]);

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
      <div className="sc" tabIndex={0} style={paneStyle}>
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
          onInput={(e) => {
            // Bumping editedAt on the first keystroke (before the first debounced commit
            // lands) keeps the background vault-sync's "is this note currently being edited"
            // guards aware of the edit during the initial 0–400ms window. First keystroke
            // only: touch() is a real app state update, and contentEditable's caret lives
            // entirely in the DOM — per-keystroke re-renders fight native caret handling
            // (this exact regression made preview typing unusable once already).
            if (!previewEditedRef.current && file) vm.touch(file.id);
            previewEditedRef.current = true;
            // This is a real keystroke (input events don't fire from a React innerHTML reset),
            // so mark dirty and record the DOM's text length now — commitPreview uses both to
            // tell genuine edits apart from spontaneous reverts.
            const el = e.currentTarget;
            dirtySinceCommitRef.current = true;
            lastInputTextLengthRef.current = (el.textContent || '').trim().length;
            // Write-through: commit after a 400ms typing pause instead of waiting for blur,
            // so the DOM is never the sole owner of more than ~400ms of typed text. The
            // imperative-innerHTML sync above never touches the DOM while focused, so the
            // commit's re-render leaves the caret untouched.
            if (commitTimerRef.current) window.clearTimeout(commitTimerRef.current);
            commitTimerRef.current = window.setTimeout(() => {
              commitTimerRef.current = undefined; // no longer pending — the commit is running now
              if (el.isConnected) commitPreviewRef.current(el);
            }, 400);
          }}
          onBlur={(e) => {
            // Only commit on blur when a debounced write-through was still PENDING — i.e. the
            // user typed changes the 400ms timer hadn't flushed yet. If nothing is pending, the
            // write-through already saved the good content, so don't re-convert the DOM here.
            const hadPending = commitTimerRef.current !== undefined;
            if (commitTimerRef.current) { window.clearTimeout(commitTimerRef.current); commitTimerRef.current = undefined; }
            const wasEdited = previewEditedRef.current;
            previewEditedRef.current = false;
            if (file && wasEdited && hadPending) commitPreview(e.currentTarget);
          }}
          onMouseUp={() => vm.selectPreviewTextInSource(window.getSelection()?.toString() || '', pane)}
          onKeyUp={() => vm.selectPreviewTextInSource(window.getSelection()?.toString() || '', pane)}
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
      <div className="sc" tabIndex={0} style={paneStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Primary pane's Desktop/Tablet/Mobile + Open in browser controls live in the
             right rail (ContextRail) instead — the secondary (split) pane has no rail
             equivalent, so it keeps its own copy here. */}
          {secondary && (
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
          )}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', overflow: 'auto', padding: 16, background: 'var(--bg-canvas)', minHeight: 0 }}>
            <iframe
              key={file?.id}
              ref={htmlFrameRef}
              srcDoc={frozenSrcDocRef.current}
              title="preview"
              /* No allow-scripts: an HTML note's own JS must never run — combined with
                 allow-same-origin it would have full access to window.parent and the Tauri
                 IPC bridge. allow-same-origin alone is safe here (scripts can't execute) and
                 is required for the designMode editing + selection bridging in onLoad below.
                 "Open in browser" is the escape hatch for previewing interactive HTML. */
              sandbox="allow-same-origin"
              onLoad={() => {
                const iframeDoc = htmlFrameRef.current?.contentDocument;
                const id = file?.id;
                if (!iframeDoc || !id) return;
                iframeDoc.designMode = 'on';
                // Polling instead of an 'input'/'focusout' listener: a sandboxed iframe
                // without allow-scripts has "scripting disabled" for its browsing context, and
                // WebKit (unlike Chromium) doesn't reliably dispatch input/focusout into a
                // scripting-disabled designMode document — confirmed live, edits sat in the
                // iframe and never fired a single commit in the real Tauri app. Reading
                // outerHTML on an interval only touches the DOM (unaffected by the scripting
                // sandbox) so it works the same regardless of engine.
                if (htmlPollRef.current) window.clearInterval(htmlPollRef.current);
                let lastHtml = iframeDoc.documentElement.outerHTML;
                const commitIfChanged = () => {
                  const html = iframeDoc.documentElement.outerHTML;
                  if (html === lastHtml) return;
                  lastHtml = html;
                  vm.setSource(id, '<!doctype html>\n' + html);
                };
                htmlPollRef.current = window.setInterval(commitIfChanged, 400);
                iframeDoc.addEventListener('focusout', commitIfChanged);
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
    // The body is untrusted HTML straight out of an .eml file — sanitize it so a crafted
    // email can't run script in app context (which would reach the Tauri FS commands).
    const safeBody = DOMPurify.sanitize(emlData.body);
    const card = '<div style="max-width:660px;margin:0 auto;background:#fff;border:1px solid rgba(0,0,0,.09);border-radius:13px;overflow:hidden;box-shadow:0 6px 24px -10px rgba(0,0,0,.18)"><div style="padding:18px 24px;background:#faf9f6;border-bottom:1px solid var(--border)"><div style="font:600 17px -apple-system,system-ui;color:var(--text-primary);margin-bottom:10px">'
      + esc(emlData.subject) + '</div><div style="display:flex;gap:8px;font:12px ui-monospace,Menlo,monospace;color:var(--text-muted);margin-bottom:3px"><span style="color:var(--text-faintest);width:42px">From</span>'
      + esc(emlData.from) + '</div><div style="display:flex;gap:8px;font:12px ui-monospace,Menlo,monospace;color:var(--text-muted)"><span style="color:var(--text-faintest);width:42px">To</span>'
      + esc(emlData.to) + '</div></div><div style="padding:26px 28px">' + safeBody + '</div></div>';
    return (
      <div className="sc" tabIndex={0} style={paneStyle}>
        <div ref={doc.previewElRef} dangerouslySetInnerHTML={{ __html: card }} />
      </div>
    );
  }

  if (isPdf) {
    return (
      <div className="sc" tabIndex={0} style={paneStyle}>
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
      <div className="sc" tabIndex={0} style={paneStyle}>
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
