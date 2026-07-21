import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { languages } from '@codemirror/language-data';
import { slashDefs } from '../../seedData';

// Completion sources for the note editor. These replace the old mouse-only SuggestPopup:
// registered on markdownLanguage's `autocomplete` data facet (not autocompletion's
// `override`), so inside a fenced code block the nested language's own completions take
// over instead of these firing over source code.

// What the editor needs to know about the vault to complete a [[wikilink]]. Read through a
// getter because the note list changes under the editor without remounting it.
export interface CompletionCtx {
  titles: string[];
}

// A multi-line slash insert reads better with the caret parked on its empty middle line
// (the ``` code block) rather than after the closing fence.
function caretOffset(ins: string): number {
  const blank = ins.indexOf('\n\n');
  return blank === -1 ? ins.length : blank + 1;
}

export function slashSource(ctx: CompletionContext): CompletionResult | null {
  // Slash blocks only make sense at the start of a line — mid-sentence "and/or" must not
  // pop the menu. Matches the `(?:^|\n)\/(\w*)$` rule the old SuggestPopup used.
  const m = ctx.matchBefore(/^\/\w*/);
  if (!m || (m.from === m.to && !ctx.explicit)) return null;
  return {
    from: m.from,
    options: slashDefs.map((d): Completion => ({
      label: '/' + d.label,
      detail: d.hint,
      type: 'keyword',
      apply: (view, _c, from, to) => {
        view.dispatch({
          changes: { from, to, insert: d.ins },
          selection: { anchor: from + caretOffset(d.ins) },
        });
      },
    })),
  };
}

export function wikiSource(get: () => CompletionCtx) {
  return (ctx: CompletionContext): CompletionResult | null => {
    const m = ctx.matchBefore(/\[\[[^\]\n]*/);
    if (!m) return null;
    const query = ctx.state.sliceDoc(m.from + 2, m.to);
    const { titles } = get();
    const q = query.toLowerCase();
    const hits = titles.filter((t) => t.toLowerCase().includes(q)).slice(0, 8);

    // closeBrackets may already have inserted the matching `]]` ahead of the caret; the
    // completion writes its own, so swallow the existing pair instead of doubling it.
    const after = ctx.state.sliceDoc(m.to, Math.min(m.to + 2, ctx.state.doc.length));
    const to = after === ']]' ? m.to + 2 : m.to;
    const insert = (title: string): Completion['apply'] => (view, _c, from) => {
      view.dispatch({ changes: { from, to, insert: '[[' + title + ']]' }, selection: { anchor: from + title.length + 4 } });
    };

    const options: Completion[] = hits.map((t) => ({ label: t, detail: 'note', type: 'variable', apply: insert(t) }));
    if (query.trim() && !titles.some((t) => t.toLowerCase() === q)) {
      // Inserts the link only — the note itself is created when the link is followed,
      // which is how the popup this replaced behaved.
      options.push({ label: 'Create "' + query + '"', detail: 'new', type: 'text', apply: insert(query.trim()) });
    }
    if (!options.length) return null;
    return { from: m.from, to, options, filter: false };
  };
}

// Language names for the info string after an opening fence, straight from the same
// registry that supplies the grammars — so anything completable here actually highlights.
// The label is the lowercased *name*, which lang-markdown always resolves; aliases go in
// the detail line, since alias[0] isn't reliably a synonym (JSON's is "json5"). CodeMirror
// matches subsequences, so typing "js" still surfaces "javascript".
const FENCE_LANGS: Completion[] = languages
  .map((l): Completion => ({ label: l.name.toLowerCase(), detail: l.alias.join(' '), type: 'type' }))
  .sort((a, b) => a.label.localeCompare(b.label));

export function fenceLangSource(ctx: CompletionContext): CompletionResult | null {
  const m = ctx.matchBefore(/^```\w*/);
  if (!m) return null;
  return { from: m.from + 3, options: FENCE_LANGS };
}
