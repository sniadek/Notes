// Source validation for the markdown editor. Deliberately free of any CodeMirror import:
// the same function backs the editor's inline diagnostics (wrapped in linter()) and the
// StatusBar's problem count, which is computed in the hook where no EditorView exists.

export interface SourceProblem {
  from: number;
  to: number;
  severity: 'error' | 'warning';
  message: string;
}

// Languages whose fenced blocks get the brace/quote scan below. Anything else (prose,
// shell, unknown tags) is left alone — a false "unbalanced" on a language we can't parse
// is worse than no check at all.
const BRACKET_LANGS = new Set(['js', 'jsx', 'ts', 'tsx', 'javascript', 'typescript', 'json', 'css', 'rust', 'go', 'java', 'c', 'cpp']);
const JSON_LANGS = new Set(['json', 'jsonc']);

const PAIRS: Record<string, string> = { '(': ')', '[': ']', '{': '}' };

interface Fence { lang: string; body: string; bodyStart: number; openFrom: number; openTo: number; closed: boolean; }

// Walks the doc once and returns every ``` fence with absolute offsets, so callers can
// report positions inside a block without re-deriving where the block started.
function fences(doc: string): Fence[] {
  const out: Fence[] = [];
  const lines = doc.split('\n');
  let offset = 0;
  let open: { lang: string; bodyStart: number; openFrom: number; openTo: number; lines: string[] } | null = null;
  for (const line of lines) {
    const end = offset + line.length;
    if (line.trim().startsWith('```')) {
      if (open) {
        out.push({ lang: open.lang, body: open.lines.join('\n'), bodyStart: open.bodyStart, openFrom: open.openFrom, openTo: open.openTo, closed: true });
        open = null;
      } else {
        open = { lang: line.trim().slice(3).trim().toLowerCase(), bodyStart: end + 1, openFrom: offset, openTo: end, lines: [] };
      }
    } else if (open) {
      open.lines.push(line);
    }
    offset = end + 1;
  }
  if (open) out.push({ lang: open.lang, body: open.lines.join('\n'), bodyStart: open.bodyStart, openFrom: open.openFrom, openTo: open.openTo, closed: false });
  return out;
}

// V8 reports JSON errors as "at position N" (and, since newer V8, "line L column C").
// Position is the only form we can map back reliably, so fall back to the block start.
function jsonErrorOffset(message: string, bodyStart: number, bodyLength: number): number {
  const m = /at position (\d+)/.exec(message);
  if (!m) return bodyStart;
  return bodyStart + Math.min(+m[1], Math.max(0, bodyLength - 1));
}

function checkBrackets(f: Fence, out: SourceProblem[]): void {
  const stack: { ch: string; at: number }[] = [];
  const src = f.body;
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') { i += 2; continue; }
    // Skip over string and comment spans wholesale — braces inside them are literal text.
    if (ch === '"' || ch === '\'' || ch === '`') {
      const quote = ch;
      let j = i + 1;
      while (j < src.length && src[j] !== quote) { if (src[j] === '\\') j++; j++; }
      if (j >= src.length && quote !== '`') {
        out.push({ from: f.bodyStart + i, to: f.bodyStart + Math.min(i + 1, src.length), severity: 'warning', message: 'Unterminated string literal' });
        return;
      }
      i = j + 1;
      continue;
    }
    if (ch === '/' && src[i + 1] === '/') { const nl = src.indexOf('\n', i); i = nl === -1 ? src.length : nl; continue; }
    if (ch === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i); i = e === -1 ? src.length : e + 2; continue; }
    if (PAIRS[ch]) stack.push({ ch, at: i });
    else if (ch === ')' || ch === ']' || ch === '}') {
      const top = stack.pop();
      if (!top || PAIRS[top.ch] !== ch) {
        out.push({ from: f.bodyStart + i, to: f.bodyStart + i + 1, severity: 'warning', message: 'Unmatched closing "' + ch + '"' });
        return;
      }
    }
    i++;
  }
  const left = stack[0];
  if (left) out.push({ from: f.bodyStart + left.at, to: f.bodyStart + left.at + 1, severity: 'warning', message: 'Unclosed "' + left.ch + '"' });
}

function checkFences(doc: string, out: SourceProblem[]): void {
  fences(doc).forEach((f) => {
    if (!f.closed) {
      out.push({ from: f.openFrom, to: f.openTo, severity: 'error', message: 'Unclosed code fence — no matching ```' });
      return;
    }
    if (!f.body.trim()) return;
    if (JSON_LANGS.has(f.lang)) {
      try {
        JSON.parse(f.body);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Invalid JSON';
        const at = jsonErrorOffset(message, f.bodyStart, f.body.length);
        out.push({ from: at, to: Math.min(at + 1, f.bodyStart + f.body.length), severity: 'error', message });
      }
      return;
    }
    if (BRACKET_LANGS.has(f.lang)) checkBrackets(f, out);
  });
}

// Offsets of every line that sits inside a fenced block, so the markdown checks below can
// ignore them — a `|` table row or `[[x]]` inside a code sample isn't markdown.
function fencedRanges(doc: string): { from: number; to: number }[] {
  return fences(doc).map((f) => ({ from: f.bodyStart, to: f.bodyStart + f.body.length }));
}

function checkWikiLinks(doc: string, titles: Set<string>, skip: { from: number; to: number }[], out: SourceProblem[]): void {
  const lower = new Set<string>();
  titles.forEach((t) => lower.add(t.toLowerCase()));
  const re = /\[\[([^\]\n]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(doc))) {
    if (skip.some((r) => m!.index >= r.from && m!.index < r.to)) continue;
    // Wikilinks may carry a `|alias` or `#heading`; only the target part is resolvable.
    const target = m[1].split(/[|#]/)[0].trim();
    if (!target || lower.has(target.toLowerCase())) continue;
    out.push({ from: m.index, to: m.index + m[0].length, severity: 'warning', message: 'No note titled "' + target + '"' });
  }
}

const TABLE_ROW = /^\|.*\|\s*$/;
const TABLE_SEP = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/;

function cellCount(line: string): number {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').length;
}

// Mirrors isTableAt() in lib/markdown.ts: a table is a pipe row followed by a separator row.
// Rows whose cell count differs from the header render with missing/dropped columns.
function checkTables(doc: string, skip: { from: number; to: number }[], out: SourceProblem[]): void {
  const lines = doc.split('\n');
  const starts: number[] = [];
  let off = 0;
  lines.forEach((l) => { starts.push(off); off += l.length + 1; });
  for (let i = 0; i < lines.length; i++) {
    if (skip.some((r) => starts[i] >= r.from && starts[i] < r.to)) continue;
    if (!TABLE_ROW.test(lines[i].trim()) || i + 1 >= lines.length || !TABLE_SEP.test(lines[i + 1].trim())) continue;
    const want = cellCount(lines[i]);
    let j = i + 2;
    for (; j < lines.length && TABLE_ROW.test(lines[j].trim()); j++) {
      const got = cellCount(lines[j]);
      if (got !== want) {
        out.push({
          from: starts[j], to: starts[j] + lines[j].length, severity: 'warning',
          message: 'Table row has ' + got + ' cells, header has ' + want,
        });
      }
    }
    i = j - 1;
  }
}

// parseFront silently drops anything that isn't a flat `key: value` pair, so a typo'd
// frontmatter line vanishes with no feedback anywhere in the UI. Surface it here.
function checkFrontMatter(doc: string, out: SourceProblem[]): void {
  if (doc.slice(0, 4) !== '---\n') return;
  const end = doc.indexOf('\n---', 4);
  if (end === -1) {
    out.push({ from: 0, to: 3, severity: 'error', message: 'Unclosed frontmatter — no closing ---' });
    return;
  }
  let off = 4;
  doc.slice(4, end).split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !/^([A-Za-z0-9_-]+):\s*(.*)$/.test(trimmed) && !trimmed.startsWith('#')) {
      out.push({ from: off, to: off + line.length, severity: 'warning', message: 'Frontmatter line is not a "key: value" pair and will be ignored' });
    }
    off += line.length + 1;
  });
}

export function lintSource(doc: string, noteTitles: Set<string> = new Set()): SourceProblem[] {
  const out: SourceProblem[] = [];
  checkFrontMatter(doc, out);
  checkFences(doc, out);
  const skip = fencedRanges(doc);
  checkWikiLinks(doc, noteTitles, skip, out);
  checkTables(doc, skip, out);
  return out.sort((a, b) => a.from - b.from);
}
