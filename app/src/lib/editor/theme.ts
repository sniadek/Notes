import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';

// Every colour resolves a CSS variable from index.css rather than a literal, so the one
// theme follows the app's design switch (default / cowork / midnight) with no per-design
// variant. Metrics match the textarea this replaced: 13.5px/1.85 mono, 24px 28px padding.
const MONO = 'ui-monospace,Menlo,monospace';

export const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    color: 'var(--text-secondary)',
    backgroundColor: 'transparent',
    font: '13.5px/1.85 ' + MONO,
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { font: 'inherit', lineHeight: '1.85', overflow: 'auto' },
  '.cm-content': { padding: '24px 28px', caretColor: 'var(--accent)' },
  '.cm-line': { padding: '0' },
  '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--accent)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--accent-soft)',
  },
  '.cm-activeLine': { backgroundColor: 'transparent' },
  '.cm-gutters': { display: 'none' },

  // Completion popup — mirrors SuggestPopup's surface/blur styling so the editor's one
  // remaining popup looks like the rest of the app's floating panels.
  '.cm-tooltip': {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '11px',
    boxShadow: '0 16px 44px -12px rgba(0,0,0,.3)',
    overflow: 'hidden',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul': {
    font: '13px -apple-system,system-ui',
    maxHeight: '16em',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li': {
    padding: '7px 12px',
    color: 'var(--text-primary)',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    background: 'var(--accent-soft)',
    color: 'var(--text-primary)',
  },
  '.cm-completionDetail': {
    marginLeft: 'auto',
    paddingLeft: '10px',
    fontStyle: 'normal',
    font: '10.5px ' + MONO,
    color: 'var(--text-faintest)',
  },
  '.cm-completionIcon': { display: 'none' },

  // Diagnostics: a squiggle under the offending range plus a themed hover panel.
  '.cm-diagnostic': { font: '12px ' + MONO, padding: '5px 9px', borderLeftWidth: '4px' },
  '.cm-diagnostic-error': { borderLeftColor: 'var(--status-danger)' },
  '.cm-diagnostic-warning': { borderLeftColor: 'var(--badge-html-fg)' },
  '.cm-lintRange-error': { backgroundImage: 'none', textDecoration: 'underline wavy var(--status-danger)' },
  '.cm-lintRange-warning': { backgroundImage: 'none', textDecoration: 'underline wavy var(--badge-html-fg)' },
});

export const editorHighlight = syntaxHighlighting(HighlightStyle.define([
  // --- markdown structure ---
  { tag: t.heading1, color: 'var(--text-primary)', fontWeight: '700' },
  { tag: [t.heading2, t.heading3], color: 'var(--text-primary)', fontWeight: '700' },
  { tag: [t.heading4, t.heading5, t.heading6], color: 'var(--text-primary)', fontWeight: '600' },
  { tag: t.strong, color: 'var(--text-primary)', fontWeight: '700' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, color: 'var(--text-tertiary)', textDecoration: 'line-through' },
  { tag: t.link, color: 'var(--accent)' },
  { tag: t.url, color: 'var(--accent)' },
  { tag: t.quote, color: 'var(--text-tertiary)', fontStyle: 'italic' },
  { tag: t.list, color: 'var(--accent)' },
  // Fence markers, ** and # runs: dimmed so the marked-up text still reads as prose.
  { tag: t.processingInstruction, color: 'var(--text-faint)' },
  { tag: t.monospace, color: 'var(--text-primary)' },

  // --- code inside fenced blocks (any language, via @codemirror/language-data) ---
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--text-tertiary)', fontStyle: 'italic' },
  { tag: [t.string, t.special(t.string)], color: 'var(--status-success)' },
  { tag: [t.number, t.bool, t.null], color: 'var(--badge-html-fg)' },
  { tag: [t.keyword, t.modifier, t.operatorKeyword, t.controlKeyword], color: 'var(--syntax-keyword)', fontWeight: '600' },
  { tag: [t.definitionKeyword, t.moduleKeyword], color: 'var(--syntax-keyword)', fontWeight: '600' },
  { tag: [t.typeName, t.className, t.namespace], color: 'var(--badge-html-fg)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--accent)' },
  { tag: [t.propertyName, t.attributeName], color: 'var(--text-primary)' },
  { tag: [t.variableName, t.labelName], color: 'var(--text-secondary)' },
  { tag: [t.operator, t.punctuation, t.bracket], color: 'var(--text-tertiary)' },
  { tag: t.tagName, color: 'var(--syntax-keyword)' },
  { tag: t.invalid, color: 'var(--status-danger)' },
]));
