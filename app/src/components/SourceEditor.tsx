import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, highlightSpecialChars, drawSelection, rectangularSelection, crosshairCursor } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, indentOnInput, indentUnit, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { linter, type Diagnostic } from '@codemirror/lint';
import { editorHighlight, editorTheme } from '../lib/editor/theme';
import { lintSource } from '../lib/editor/lint';
import { fenceLangSource, slashSource, wikiSource, type CompletionCtx } from '../lib/editor/complete';

// The slice of HTMLTextAreaElement that useNotesApp actually used (find-next,
// select-in-source). Implementing it here keeps those call sites unchanged now that the
// underlying element is a CodeMirror view rather than a textarea.
export interface SourceEditorHandle {
  readonly value: string;
  readonly selectionStart: number;
  readonly selectionEnd: number;
  focus(): void;
  setSelectionRange(from: number, to: number): void;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  noteTitles: string[];
  fontScale: number;
  ariaLabel: string;
  editorRef?: Ref<SourceEditorHandle>;
}

export default function SourceEditor({ value, onChange, noteTitles, fontScale, ariaLabel, editorRef }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  // Props the extensions read at completion/lint time. Held in a ref (rather than baked
  // into the extension array) so a changing vault never forces the editor to remount and
  // drop the cursor mid-edit.
  const liveRef = useRef({ onChange, noteTitles });
  liveRef.current = { onChange, noteTitles };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const completionCtx = (): CompletionCtx => ({ titles: liveRef.current.noteTitles });

    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        // Seeded from the current prop; subsequent prop changes are reconciled by the
        // sync effect below rather than by recreating the state.
        doc: value,
        extensions: [
          history(),
          drawSelection(),
          highlightSpecialChars(),
          rectangularSelection(),
          crosshairCursor(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          indentUnit.of('  '),
          EditorView.lineWrapping,
          keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...completionKeymap, indentWithTab]),
          // codeLanguages is what makes a ```ts / ```json block highlight as that language:
          // lang-markdown lazily imports the grammar for whatever follows the fence.
          markdown({ base: markdownLanguage, codeLanguages: languages }),
          // Registered on the markdown language's data facet, not autocompletion's
          // `override` — inside a fenced block the nested language's own completions win.
          markdownLanguage.data.of({ autocomplete: wikiSource(completionCtx) }),
          markdownLanguage.data.of({ autocomplete: slashSource }),
          markdownLanguage.data.of({ autocomplete: fenceLangSource }),
          autocompletion({ icons: false, activateOnTyping: true }),
          linter((v): Diagnostic[] => lintSource(v.state.doc.toString(), new Set(liveRef.current.noteTitles)).map((p) => ({
            from: p.from, to: Math.max(p.to, p.from + 1), severity: p.severity, message: p.message,
          })), { delay: 400 }),
          // defaultHighlightStyle is the fallback for tags editorHighlight doesn't name;
          // ours is listed second so it takes precedence where they overlap.
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          editorHighlight,
          editorTheme,
          EditorView.contentAttributes.of({ 'aria-label': ariaLabel, spellcheck: 'false' }),
          EditorView.updateListener.of((u) => {
            if (!u.docChanged) return;
            liveRef.current.onChange(u.state.doc.toString());
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => { view.destroy(); viewRef.current = null; };
    // Mount once per pane: everything variable is reached through liveRef or the effects
    // below. ariaLabel is fixed per pane.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Controlled-value sync. Only dispatch when the prop genuinely diverges from the doc —
  // every keystroke round-trips through React state, and replacing an identical doc would
  // reset the cursor to the start on every character typed.
  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === value) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
  }, [value]);

  useImperativeHandle(editorRef, (): SourceEditorHandle => ({
    get value() { return viewRef.current?.state.doc.toString() ?? ''; },
    get selectionStart() { return viewRef.current?.state.selection.main.from ?? 0; },
    get selectionEnd() { return viewRef.current?.state.selection.main.to ?? 0; },
    focus() { viewRef.current?.focus(); },
    setSelectionRange(from: number, to: number) {
      const view = viewRef.current;
      if (!view) return;
      const max = view.state.doc.length;
      const anchor = Math.min(from, max);
      const head = Math.min(to, max);
      view.focus();
      // scrollIntoView replaces the textarea era's hand-rolled `scrollTop = line * 25`.
      view.dispatch({ selection: { anchor, head }, scrollIntoView: true });
    },
  }), []);

  // No `sc` class here: the scrolling element is CodeMirror's own .cm-scroller, which
  // index.css styles directly.
  return <div ref={hostRef} style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden', zoom: fontScale }} />;
}
