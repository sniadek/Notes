export interface FrontMatter {
  body: string;
  tags: string[];
  offset: number;
}

export function slug(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function parseFront(md: string): FrontMatter {
  if (md.slice(0, 4) !== '---\n') return { body: md, tags: [], offset: 0 };
  const end = md.indexOf('\n---', 4);
  if (end === -1) return { body: md, tags: [], offset: 0 };
  const block = md.slice(4, end);
  const after = md.slice(end + 4).replace(/^\n/, '');
  let tags: string[] = [];
  block.split('\n').forEach((l) => {
    const m = /^tags:\s*(.+)$/.exec(l.trim());
    if (m) tags = m[1].replace(/[[\]]/g, '').split(',').map((s) => s.trim()).filter(Boolean);
  });
  const offset = md.slice(0, md.length - after.length).split('\n').length - 1;
  return { body: after, tags, offset };
}

export function inline(s: string, wiki: boolean): string {
  s = esc(s);
  s = s.replace(/\$([^$\n]+)\$/g, (_m, tex) => '<span data-tex="' + tex.replace(/"/g, '&quot;') + '">' + tex + '</span>');
  s = s.replace(/`([^`]+)`/g, '<code style="font:13px ui-monospace,Menlo,monospace;background:#f0ede6;padding:1px 6px;border-radius:4px;color:#403d37">$1</code>');
  if (wiki) s = s.replace(/\[\[([^\]]+)\]\]/g, '<span data-wiki="$1" style="color:oklch(0.5 0.12 264);border-bottom:1.5px solid oklch(0.82 0.08 264);font-weight:500;cursor:pointer">$1</span>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong style="font-weight:700;color:#26241f">$1</strong>');
  return s;
}

export function highlight(code: string): string {
  const re = /(\/\/[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b(const|let|var|function|return|if|else|for|while|import|from|export|class|new|await|async|GET|POST|PUT|DELETE|PATCH|true|false|null)\b|\b(\d+(?:\.\d+)?)\b/g;
  return esc(code).replace(re, (m, com, str, kw, num) =>
    com ? '<span style="color:#a8a29a">' + com + '</span>'
      : str ? '<span style="color:#1a8a4f">' + str + '</span>'
      : kw ? '<span style="color:oklch(0.5 0.16 295);font-weight:600">' + kw + '</span>'
      : num ? '<span style="color:#b5651d">' + num + '</span>'
      : m
  );
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
  let inList = false;
  let cbN = 0;
  let mmdN = 0;
  const codeBlocks: Record<string, string> = {};
  const mermaidBlocks: Record<string, string> = {};
  const close = () => { if (inList) { html += '</ul>'; inList = false; } };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('```')) {
      if (inCode) {
        if (lang === 'mermaid') {
          const mid = idPrefix + 'mmd' + (mmdN++);
          mermaidBlocks[mid] = code.join('\n');
          html += '<div class="mmd" data-mmd="' + mid + '" style="border:1px solid rgba(0,0,0,.07);border-radius:9px;padding:18px;margin:0 0 18px;background:#faf8f3;overflow:auto;text-align:center;color:#a8a29a;font:12px ui-monospace,Menlo,monospace">◇ rendering diagram…</div>';
        } else {
          const id = idPrefix + 'cb' + (cbN++);
          codeBlocks[id] = code.join('\n');
          html += '<div style="border:1px solid rgba(0,0,0,.07);border-radius:9px;overflow:hidden;margin:0 0 18px;background:#faf8f3"><div style="display:flex;align-items:center;justify-content:space-between;padding:6px 12px;border-bottom:1px solid rgba(0,0,0,.06);font:11px ui-monospace,Menlo,monospace;color:#a8a29a"><span>' + (lang || 'text') + '</span><span data-copy="' + id + '" style="cursor:pointer;color:oklch(0.5 0.1 264)">Copy</span></div><pre style="margin:0;padding:13px 16px;font:13.5px/1.7 ui-monospace,Menlo,monospace;color:#26241f;overflow:auto">' + highlight(code.join('\n')) + '</pre></div>';
        }
        code = []; inCode = false; lang = '';
      } else { close(); inCode = true; lang = line.trim().slice(3); }
      continue;
    }
    if (inCode) { code.push(line); continue; }
    if (/^-\s\[( |x)\]\s/i.test(line)) {
      close();
      const done = /\[x\]/i.test(line);
      const text = line.replace(/^-\s\[( |x)\]\s/i, '');
      html += '<div data-task="' + (i + taskOffset) + '" style="display:flex;align-items:flex-start;gap:9px;font:400 15.5px/1.6 -apple-system,system-ui;margin:0 0 5px;cursor:pointer"><span style="width:17px;height:17px;margin-top:3px;border-radius:5px;border:1.5px solid ' + (done ? 'oklch(0.5 0.12 264)' : '#cfc9bd') + ';background:' + (done ? 'oklch(0.5 0.12 264)' : 'transparent') + ';display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;flex:none">' + (done ? '✓' : '') + '</span><span style="' + (done ? 'color:#a8a29a;text-decoration:line-through' : 'color:#403d37') + '">' + inline(text, wiki) + '</span></div>';
    } else if (line.startsWith('### ')) {
      close(); const t = line.slice(4);
      html += '<h3 id="' + slug(t) + '" style="font:600 16px -apple-system,system-ui;color:#26241f;margin:22px 0 8px">' + inline(t, wiki) + '</h3>';
    } else if (line.startsWith('## ')) {
      close(); const t = line.slice(3);
      html += '<h2 id="' + slug(t) + '" style="font:600 20px -apple-system,system-ui;color:#26241f;margin:28px 0 12px">' + inline(t, wiki) + '</h2>';
    } else if (line.startsWith('# ')) {
      close(); const t = line.slice(2);
      html += '<h1 id="' + slug(t) + '" style="font:700 30px/1.2 -apple-system,system-ui;color:#26241f;margin:0 0 14px;letter-spacing:-.012em">' + inline(t, wiki) + '</h1>';
    } else if (/^>\s/.test(line)) {
      close();
      html += '<blockquote style="border-left:3px solid oklch(0.8 0.07 264);padding:2px 0 2px 14px;margin:0 0 16px;color:#6a675f;font:400 15.5px/1.7 -apple-system,system-ui">' + inline(line.slice(2), wiki) + '</blockquote>';
    } else if (/^\d+\.\s/.test(line)) {
      close();
      html += '<div style="font:400 15.5px/1.75 -apple-system,system-ui;color:#403d37;margin:0 0 6px">' + inline(line, wiki) + '</div>';
    } else if (/^[-*]\s/.test(line)) {
      if (!inList) { html += '<ul style="font:400 15.5px/1.85 -apple-system,system-ui;color:#403d37;margin:0 0 16px;padding-left:22px">'; inList = true; }
      html += '<li style="margin-bottom:4px">' + inline(line.slice(2), wiki) + '</li>';
    } else if (line.trim() === '') {
      close();
    } else {
      close();
      html += '<p style="font:400 15.5px/1.75 -apple-system,system-ui;color:#403d37;margin:0 0 16px">' + inline(line, wiki) + '</p>';
    }
  }
  close();
  return { html, codeBlocks, mermaidBlocks };
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
    else if (tag === 'code') out += '`' + (e.textContent || '') + '`';
    else if (tag === 'a') out += '[' + inlineToMd(e) + '](' + (e.getAttribute('href') || '') + ')';
    else if (tag === 'br') out += '\n';
    else if (e.hasAttribute && e.hasAttribute('data-wiki')) out += '[[' + e.getAttribute('data-wiki') + ']]';
    else out += inlineToMd(e);
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
    if (tag === 'h1') lines.push('# ' + inlineToMd(e).trim());
    else if (tag === 'h2') lines.push('## ' + inlineToMd(e).trim());
    else if (tag === 'h3') lines.push('### ' + inlineToMd(e).trim());
    else if (tag === 'blockquote') lines.push('> ' + inlineToMd(e).trim());
    else if (tag === 'ul') {
      e.querySelectorAll(':scope > li').forEach((li) => lines.push('- ' + inlineToMd(li).trim()));
    } else if (tag === 'pre') {
      const code = e.querySelector('code');
      lines.push('```\n' + (code ? code.textContent : e.textContent) + '\n```');
    } else if (tag === 'div' && e.hasAttribute('data-task')) {
      const done = e.querySelector('span')?.textContent?.trim() === '✓';
      const text = e.querySelectorAll('span')[1] ? inlineToMd(e.querySelectorAll('span')[1]).trim() : inlineToMd(e).trim();
      lines.push('- [' + (done ? 'x' : ' ') + '] ' + text);
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
