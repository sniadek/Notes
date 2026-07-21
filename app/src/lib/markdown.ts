// OKF (Open Knowledge Format) recommends these keys; `type` here is the
// concept's knowledge type (e.g. "BigQuery Table") — unrelated to
// NoteFile.type, which is the file's storage format (md/html/eml/pdf).
// Don't conflate the two at call sites.
export interface FrontMatter {
  body: string;
  offset: number;
  type?: string;
  title?: string;
  description?: string;
  resource?: string;
  timestamp?: string;
  tags: string[];
  extra: Record<string, string>;
}

export function slug(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Quotes must be escaped too: rendered text gets interpolated into attribute values
// (data-wiki, data-tex, data-mmd-src below), so an unescaped `"` in note content would
// break out of the attribute and inject live markup into the preview.
export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function unquote(v: string): string {
  const t = v.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith('\'') && t.endsWith('\''))) return t.slice(1, -1);
  return t;
}

const KNOWN_FRONT_KEYS = new Set(['type', 'title', 'description', 'resource', 'timestamp', 'tags']);

export function parseFront(md: string): FrontMatter {
  const empty: FrontMatter = { body: md, tags: [], extra: {}, offset: 0 };
  if (md.slice(0, 4) !== '---\n') return empty;
  const end = md.indexOf('\n---', 4);
  if (end === -1) return empty;
  const block = md.slice(4, end);
  const after = md.slice(end + 4).replace(/^\n/, '');
  const offset = md.slice(0, md.length - after.length).split('\n').length - 1;
  let tags: string[] = [];
  const extra: Record<string, string> = {};
  const fields: Partial<Pick<FrontMatter, 'type' | 'title' | 'description' | 'resource' | 'timestamp'>> = {};
  // Only flat `key: value` pairs and an inline `tags: [a, b]` list are
  // supported — OKF's documented shape doesn't require block-style YAML
  // lists/maps, so lines that don't match are left out rather than mis-parsed.
  block.split('\n').forEach((l) => {
    const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(l.trim());
    if (!m) return;
    const [, key, rawValue] = m;
    if (key === 'tags') {
      tags = rawValue.replace(/[[\]]/g, '').split(',').map((s) => unquote(s)).filter(Boolean);
    } else if (KNOWN_FRONT_KEYS.has(key)) {
      (fields as Record<string, string>)[key] = unquote(rawValue);
    } else if (rawValue) {
      extra[key] = unquote(rawValue);
    }
  });
  return { body: after, offset, tags, extra, ...fields };
}

// Per-note memo over parseFront: frontmatter is re-consulted vault-wide (tags, smart
// filters, concept types) on every source change, but only the edited note's text actually
// differs — cache by note id and re-parse only when that note's source changed. Bounded by
// the number of notes.
const frontCache = new Map<string, { src: string; fm: FrontMatter }>();

export function parseFrontCached(id: string, md: string): FrontMatter {
  const hit = frontCache.get(id);
  if (hit && hit.src === md) return hit.fm;
  const fm = parseFront(md);
  frontCache.set(id, { src: md, fm });
  return fm;
}

const CODE_STYLE = 'font:13px ui-monospace,Menlo,monospace;background:var(--bg-subtle);padding:1px 6px;border-radius:4px;color:var(--text-secondary)';

// Only these schemes become live hrefs. `javascript:`/`data:` links would execute in the
// preview (which renders this HTML directly), so anything else is left as literal text.
const SAFE_URL = /^(?:https?:\/\/|mailto:|tel:|#|\/|\.{1,2}\/)/i;

function safeUrl(u: string): string {
  // esc() has already run, so the raw text is attribute-safe; only the scheme needs vetting.
  const t = u.trim();
  return SAFE_URL.test(t) ? t : '';
}

export function inline(s: string, wiki: boolean): string {
  s = esc(s);
  // Code spans are pulled out first and restored last (fenced by a private-use sentinel that
  // can't occur in note text): their contents are literal, so bold,
  // emphasis, link and math rules must never see inside them.
  const codes: string[] = [];
  s = s.replace(/`([^`]+)`/g, (_m, c) => '\uE000' + (codes.push(c) - 1) + '\uE000');
  s = s.replace(/\$([^$\n]+)\$/g, (_m, tex) => '<span data-tex="' + tex + '">' + tex + '</span>');
  if (wiki) s = s.replace(/\[\[([^\]]+)\]\]/g, '<span data-wiki="$1" style="color:var(--accent);border-bottom:1.5px solid var(--accent-soft);font-weight:500;cursor:pointer">$1</span>');
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+[^)]*)?\)/g, (m, alt, url) => {
    const href = safeUrl(url);
    return href ? '<img src="' + href + '" alt="' + alt + '" style="max-width:100%;border-radius:6px">' : m;
  });
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+[^)]*)?\)/g, (m, text, url) => {
    const href = safeUrl(url);
    return href ? '<a href="' + href + '" style="color:var(--accent);text-decoration:none;border-bottom:1px solid var(--accent-soft)">' + text + '</a>' : m;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong style="font-weight:700;color:var(--text-primary)">$1</strong>');
  s = s.replace(/~~([^~\n]+)~~/g, '<del style="color:var(--text-tertiary)">$1</del>');
  // Emphasis runs after bold so `**x**` is already consumed. The leading capture group stands
  // in for a lookbehind (WKWebView support) and keeps `snake_case` / `2 * 3 * 4` intact.
  s = s.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^_\w])_([^_\n]+)_(?![\w_])/g, '$1<em>$2</em>');
  return s.replace(/\uE000(\d+)\uE000/g, (_m, n) => '<code style="' + CODE_STYLE + '">' + codes[+n] + '</code>');
}

export function highlight(code: string): string {
  const re = /(\/\/[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b(const|let|var|function|return|if|else|for|while|import|from|export|class|new|await|async|GET|POST|PUT|DELETE|PATCH|true|false|null)\b|\b(\d+(?:\.\d+)?)\b/g;
  // Content-only escape (quotes stay literal): the output lands inside <pre>, never in an
  // attribute, and the string-literal token regex above needs real quotes to match.
  const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped.replace(re, (m, com, str, kw, num) =>
    com ? '<span style="color:var(--text-tertiary)">' + com + '</span>'
      : str ? '<span style="color:var(--status-success)">' + str + '</span>'
      : kw ? '<span style="color:var(--syntax-keyword);font-weight:600">' + kw + '</span>'
      : num ? '<span style="color:var(--badge-html-fg)">' + num + '</span>'
      : m
  );
}

const HR_RE = /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/;
const TASK_RE = /^-\s\[( |x)\]\s/i;
const LIST_RE = /^(\s*)(?:([-*+])|(\d+)[.)])\s+(.*)$/;
const HEAD_RE = /^(#{1,6})\s+(.*)$/;
const QUOTE_RE = /^>\s?/;
const HEAD_STYLE: Record<number, string> = {
  1: 'font:700 30px/1.25 -apple-system,system-ui;color:var(--text-primary);margin:0 0 14px;letter-spacing:-.012em',
  2: 'font:600 21px/1.3 -apple-system,system-ui;color:var(--text-primary);margin:30px 0 10px;letter-spacing:-.008em',
  3: 'font:600 17px/1.35 -apple-system,system-ui;color:var(--text-primary);margin:22px 0 7px',
  4: 'font:600 15.5px/1.4 -apple-system,system-ui;color:var(--text-primary);margin:18px 0 6px',
  5: 'font:600 14px/1.4 -apple-system,system-ui;color:var(--text-secondary);margin:16px 0 5px',
  6: 'font:600 13px/1.4 -apple-system,system-ui;color:var(--text-tertiary);margin:16px 0 5px;text-transform:uppercase;letter-spacing:.04em',
};
const BODY_FONT = 'font:400 15.5px/1.72 -apple-system,system-ui;color:var(--text-secondary)';

function isTableAt(lines: string[], i: number): boolean {
  return /^\|.*\|\s*$/.test(lines[i].trim()) &&
    i + 1 < lines.length &&
    /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(lines[i + 1].trim());
}

// A soft-wrapped source line continues the current paragraph/quote unless it opens a block of
// its own — this is what keeps one authored paragraph from rendering as N spaced-out <p>s.
function startsBlock(lines: string[], i: number): boolean {
  const l = lines[i];
  return l.trim() === '' || l.trim().startsWith('```') || HR_RE.test(l) || HEAD_RE.test(l) ||
    QUOTE_RE.test(l) || TASK_RE.test(l) || LIST_RE.test(l) || isTableAt(lines, i);
}

// Trailing double-space (or backslash) is markdown's hard break; everything else folds to a
// single space, matching how the source reads as prose.
function joinSoft(raw: string[], wiki: boolean): string {
  return raw.map((l, idx) => {
    const br = idx < raw.length - 1 && /(?: {2,}|\\)$/.test(l);
    return inline(l.trim(), wiki) + (br ? '<br>' : idx < raw.length - 1 ? ' ' : '');
  }).join('');
}

interface ListItem { ordered: boolean; text: string; children: ListItem[]; }

// Consumes one contiguous list block (blank lines between items included) and nests items by
// their source indentation. Returns the index of the last line it took.
function collectList(lines: string[], start: number): { items: ListItem[]; end: number } {
  const flat: { indent: number; ordered: boolean; text: string }[] = [];
  let i = start;
  let end = start;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') {
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === '') j++;
      if (j < lines.length && LIST_RE.test(lines[j]) && !TASK_RE.test(lines[j])) { i = j - 1; continue; }
      break;
    }
    if (TASK_RE.test(line)) break;
    const m = LIST_RE.exec(line);
    if (m) {
      flat.push({ indent: m[1].replace(/\t/g, '  ').length, ordered: !m[2], text: m[4] });
      end = i;
      continue;
    }
    // Lazy continuation: an indented line with no marker belongs to the item above it.
    if (flat.length && /^\s{2,}\S/.test(line)) { flat[flat.length - 1].text += ' ' + line.trim(); end = i; continue; }
    break;
  }
  const roots: ListItem[] = [];
  const stack: { indent: number; items: ListItem[] }[] = [{ indent: -1, items: roots }];
  flat.forEach((f) => {
    while (stack.length > 1 && f.indent <= stack[stack.length - 1].indent) stack.pop();
    const node: ListItem = { ordered: f.ordered, text: f.text, children: [] };
    stack[stack.length - 1].items.push(node);
    stack.push({ indent: f.indent, items: node.children });
  });
  return { items: roots, end };
}

function renderList(items: ListItem[], wiki: boolean, depth: number): string {
  let out = '';
  let i = 0;
  while (i < items.length) {
    // Sibling runs of different marker types become separate lists rather than one mixed one.
    const ordered = items[i].ordered;
    const run: ListItem[] = [];
    while (i < items.length && items[i].ordered === ordered) run.push(items[i++]);
    const tag = ordered ? 'ol' : 'ul';
    const style = BODY_FONT + ';margin:' + (depth ? '5px 0 0' : '0 0 16px') +
      ';padding-left:' + (ordered ? 26 : 23) + 'px;list-style:' + (ordered ? 'decimal' : 'disc');
    out += '<' + tag + ' style="' + style + '">' + run.map((it) =>
      '<li style="margin-bottom:5px">' + inline(it.text, wiki) +
      (it.children.length ? renderList(it.children, wiki, depth + 1) : '') + '</li>'
    ).join('') + '</' + tag + '>';
  }
  return out;
}

export interface MdRenderResult {
  html: string;
  codeBlocks: Record<string, string>;
  mermaidBlocks: Record<string, string>;
}

export function mdToHtml(md: string, wiki: boolean, idPrefix = '', taskOffset = 0): MdRenderResult {
  const lines = md.split('\n');
  let html = '';
  let inCode = false;
  let code: string[] = [];
  let lang = '';
  let cbN = 0;
  let mmdN = 0;
  const codeBlocks: Record<string, string> = {};
  const mermaidBlocks: Record<string, string> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('```')) {
      if (inCode) {
        if (lang === 'mermaid') {
          const mid = idPrefix + 'mmd' + (mmdN++);
          mermaidBlocks[mid] = code.join('\n');
          // data-mmd-src carries the diagram source through the DOM: the rendered SVG replaces
          // the div's content, so htmlToMd can only recover the fence from this attribute.
          html += '<div class="mmd" tabindex="0" data-mmd="' + mid + '" data-mmd-src="' + esc(code.join('\n')) + '" style="border:1px solid var(--border);border-radius:9px;padding:18px;margin:0 0 18px;background:var(--bg-subtle);overflow:auto;text-align:center;color:var(--text-tertiary);font:12px ui-monospace,Menlo,monospace">◇ rendering diagram…</div>';
        } else {
          const id = idPrefix + 'cb' + (cbN++);
          codeBlocks[id] = code.join('\n');
          html += '<div data-lang="' + esc(lang) + '" style="border:1px solid var(--border);border-radius:9px;overflow:hidden;margin:0 0 18px;background:var(--bg-subtle)"><div style="display:flex;align-items:center;justify-content:space-between;padding:6px 12px;border-bottom:1px solid var(--border);font:11px ui-monospace,Menlo,monospace;color:var(--text-tertiary)"><span>' + esc(lang || 'text') + '</span><span data-copy="' + id + '" style="cursor:pointer;color:var(--accent)">Copy</span></div><pre tabindex="0" style="margin:0;padding:13px 16px;font:13.5px/1.7 ui-monospace,Menlo,monospace;color:var(--text-primary);overflow:auto">' + highlight(code.join('\n')) + '</pre></div>';
        }
        code = []; inCode = false; lang = '';
      } else { inCode = true; lang = line.trim().slice(3); }
      continue;
    }
    if (inCode) { code.push(line); continue; }
    if (TASK_RE.test(line)) {
      const done = /\[x\]/i.test(line);
      const text = line.replace(/^-\s\[( |x)\]\s/i, '');
      html += '<div data-task="' + (i + taskOffset) + '" style="display:flex;align-items:flex-start;gap:9px;font:400 15.5px/1.6 -apple-system,system-ui;margin:0 0 5px;cursor:pointer"><span style="width:17px;height:17px;margin-top:3px;border-radius:5px;border:1.5px solid ' + (done ? 'var(--accent)' : 'var(--border)') + ';background:' + (done ? 'var(--accent)' : 'transparent') + ';display:flex;align-items:center;justify-content:center;color:var(--on-accent);font-size:11px;flex:none">' + (done ? '✓' : '') + '</span><span style="' + (done ? 'color:var(--text-tertiary);text-decoration:line-through' : 'color:var(--text-secondary)') + '">' + inline(text, wiki) + '</span></div>';
    } else if (HR_RE.test(line)) {
      html += '<hr style="border:none;border-top:1px solid var(--border);margin:26px 0">';
    } else if (HEAD_RE.test(line)) {
      const [, hashes, t] = HEAD_RE.exec(line)!;
      const lvl = hashes.length;
      html += '<h' + lvl + ' id="' + slug(t) + '" style="' + HEAD_STYLE[lvl] + '">' + inline(t, wiki) + '</h' + lvl + '>';
    } else if (QUOTE_RE.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && QUOTE_RE.test(lines[i])) buf.push(lines[i++].replace(QUOTE_RE, ''));
      i--;
      html += '<blockquote style="border-left:3px solid var(--accent-soft);padding:2px 0 2px 14px;margin:0 0 16px;' + BODY_FONT + '">' + joinSoft(buf, wiki) + '</blockquote>';
    } else if (LIST_RE.test(line)) {
      const { items, end } = collectList(lines, i);
      html += renderList(items, wiki, 0);
      i = end;
    } else if (isTableAt(lines, i)) {
      const parseRow = (l: string) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
      const headerCells = parseRow(line);
      const aligns = parseRow(lines[i + 1]).map((a) => {
        const left = a.startsWith(':');
        const right = a.endsWith(':');
        if (left && right) return 'center';
        if (right) return 'right';
        return 'left';
      });
      i += 2;
      const bodyRows: string[][] = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i].trim())) {
        bodyRows.push(parseRow(lines[i]));
        i++;
      }
      i--;
      const cellStyle = (align: string, head: boolean) =>
        'text-align:' + align + ';padding:8px 12px;border:1px solid var(--border);' +
        (head ? 'background:var(--bg-subtle);font-weight:600;color:var(--text-primary)' : 'color:var(--text-secondary)');
      html += '<table style="border-collapse:collapse;width:100%;margin:0 0 18px;font:400 14.5px/1.6 -apple-system,system-ui">' +
        '<thead><tr>' + headerCells.map((c, ci) => '<th style="' + cellStyle(aligns[ci] || 'left', true) + '">' + inline(c, wiki) + '</th>').join('') + '</tr></thead>' +
        '<tbody>' + bodyRows.map((row) => '<tr>' + row.map((c, ci) => '<td style="' + cellStyle(aligns[ci] || 'left', false) + '">' + inline(c, wiki) + '</td>').join('') + '</tr>').join('') + '</tbody>' +
        '</table>';
    } else if (line.trim() !== '') {
      const buf = [line];
      while (i + 1 < lines.length && !startsBlock(lines, i + 1)) buf.push(lines[++i]);
      html += '<p style="' + BODY_FONT + ';margin:0 0 16px">' + joinSoft(buf, wiki) + '</p>';
    }
  }
  return { html, codeBlocks, mermaidBlocks };
}

export function parseEml(raw: string): { from: string; to: string; subject: string; body: string } {
  const blankAt = raw.indexOf('\n\n');
  const header = blankAt === -1 ? '' : raw.slice(0, blankAt);
  const body = blankAt === -1 ? raw : raw.slice(blankAt + 2);
  let from = '';
  let to = '';
  let subject = '';
  header.split('\n').forEach((l) => {
    const m = /^(From|To|Subject):\s*(.*)$/i.exec(l);
    if (!m) return;
    const key = m[1].toLowerCase();
    if (key === 'from') from = m[2].trim();
    else if (key === 'to') to = m[2].trim();
    else if (key === 'subject') subject = m[2].trim();
  });
  return { from, to, subject, body };
}

export interface Outline { level: number; text: string; id: string; }

export function outlineMd(md: string): Outline[] {
  const out: Outline[] = [];
  md.split('\n').forEach((l) => {
    const m = /^(#{1,3})\s+(.+)/.exec(l);
    if (m) out.push({ level: m[1].length, text: m[2].replace(/\*\*/g, ''), id: slug(m[2]) });
  });
  return out;
}

export function outlineHtml(h: string): Outline[] {
  const out: Outline[] = [];
  const re = /<h([1-3])[^>]*>(.*?)<\/h\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(h))) out.push({ level: +m[1], text: m[2].replace(/<[^>]+>/g, ''), id: '' });
  return out;
}

export function wordCount(s: string): number {
  return s.replace(/<[^>]+>/g, ' ').replace(/[#>*`-]/g, ' ').trim().split(/\s+/).filter(Boolean).length;
}

function inlineToMd(el: Node): string {
  let out = '';
  el.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) { out += n.textContent || ''; return; }
    const e = n as HTMLElement;
    const tag = e.tagName?.toLowerCase();
    if (tag === 'strong' || tag === 'b') out += '**' + inlineToMd(e) + '**';
    else if (tag === 'em' || tag === 'i') out += '*' + inlineToMd(e) + '*';
    else if (tag === 'del' || tag === 's') out += '~~' + inlineToMd(e) + '~~';
    else if (tag === 'img') out += '![' + (e.getAttribute('alt') || '') + '](' + (e.getAttribute('src') || '') + ')';
    else if (tag === 'code') out += '`' + (e.textContent || '') + '`';
    else if (tag === 'a') out += '[' + inlineToMd(e) + '](' + (e.getAttribute('href') || '') + ')';
    else if (tag === 'br') out += '\n';
    else if (e.hasAttribute && e.hasAttribute('data-wiki')) out += '[[' + e.getAttribute('data-wiki') + ']]';
    // KaTeX replaces the span's content with rendered markup; the original TeX only
    // survives in the attribute, so recursing into the children would emit garbage.
    else if (e.hasAttribute && e.hasAttribute('data-tex')) out += '$' + e.getAttribute('data-tex') + '$';
    else out += inlineToMd(e);
  });
  return out;
}

// Walks a <ul>/<ol> into markdown lines, recursing into nested lists inside each <li> and
// indenting them two spaces per level (the shape collectList reads back).
function listToMd(el: Element, depth: number): string[] {
  const ordered = el.tagName.toLowerCase() === 'ol';
  const out: string[] = [];
  let n = 1;
  el.querySelectorAll(':scope > li').forEach((li) => {
    const nested = Array.from(li.children).filter((c) => /^(ul|ol)$/i.test(c.tagName));
    const own = li.cloneNode(true) as HTMLElement;
    Array.from(own.children).forEach((c) => { if (/^(ul|ol)$/i.test(c.tagName)) c.remove(); });
    out.push('  '.repeat(depth) + (ordered ? n++ + '. ' : '- ') + inlineToMd(own).trim());
    nested.forEach((sub) => out.push(...listToMd(sub, depth + 1)));
  });
  return out;
}

export function htmlToMd(html: string): string {
  const root = document.createElement('div');
  root.innerHTML = html;
  const lines: string[] = [];
  root.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) {
      const t = (n.textContent || '').trim();
      if (t) lines.push(t);
      return;
    }
    const e = n as HTMLElement;
    const tag = e.tagName?.toLowerCase();
    if (/^h[1-6]$/.test(tag)) lines.push('#'.repeat(+tag[1]) + ' ' + inlineToMd(e).trim());
    else if (tag === 'hr') lines.push('---');
    else if (tag === 'blockquote') lines.push('> ' + inlineToMd(e).trim());
    else if (tag === 'ul' || tag === 'ol') {
      // One list = one block: emitting each item separately would let the '\n\n' join below
      // turn every list into a loose one, and nested items would be dropped entirely.
      lines.push(listToMd(e, 0).join('\n'));
    } else if (tag === 'pre') {
      const code = e.querySelector('code');
      lines.push('```\n' + (code ? code.textContent : e.textContent) + '\n```');
    } else if (tag === 'div' && e.classList.contains('mmd')) {
      // The rendered SVG carries no source text — recover the fence from data-mmd-src,
      // which mdToHtml stamps on the block for exactly this round-trip.
      const src = e.getAttribute('data-mmd-src');
      if (src) lines.push('```mermaid\n' + src + '\n```');
    } else if (tag === 'div' && e.hasAttribute('data-task')) {
      const done = e.querySelector('span')?.textContent?.trim() === '✓';
      const text = e.querySelectorAll('span')[1] ? inlineToMd(e.querySelectorAll('span')[1]).trim() : inlineToMd(e).trim();
      lines.push('- [' + (done ? 'x' : ' ') + '] ' + text);
    } else if (tag === 'div' && e.querySelector(':scope > pre')) {
      const pre = e.querySelector(':scope > pre') as HTMLElement;
      const code = pre.querySelector('code');
      const lang = e.getAttribute('data-lang') || '';
      lines.push('```' + lang + '\n' + (code ? code.textContent : pre.textContent) + '\n```');
    } else if (tag === 'table') {
      const headerCells = Array.from(e.querySelectorAll('thead th')).map((th) => inlineToMd(th).trim());
      const rows = Array.from(e.querySelectorAll('tbody tr')).map((tr) =>
        Array.from(tr.querySelectorAll('td')).map((td) => inlineToMd(td).trim())
      );
      const tableLines = [
        '| ' + headerCells.join(' | ') + ' |',
        '| ' + headerCells.map(() => '---').join(' | ') + ' |',
        ...rows.map((r) => '| ' + r.join(' | ') + ' |'),
      ];
      lines.push(tableLines.join('\n'));
    } else if (tag === 'p' || tag === 'div') {
      const t = inlineToMd(e).trim();
      if (t) lines.push(t);
    }
  });
  return lines.join('\n\n');
}

export interface DiffRow { t: 'same' | 'add' | 'del'; v: string; }

export function diffLines(a: string[], b: string[]): DiffRow[] {
  const n = a.length, m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffRow[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ t: 'same', v: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ t: 'del', v: a[i] }); i++; }
    else { out.push({ t: 'add', v: b[j] }); j++; }
  }
  while (i < n) out.push({ t: 'del', v: a[i++] });
  while (j < m) out.push({ t: 'add', v: b[j++] });
  return out;
}
