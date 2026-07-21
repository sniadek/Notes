import { describe, expect, it } from 'vitest';
import {
  diffLines, esc, htmlToMd, mdToHtml, outlineMd, parseEml, parseFront, slug, wordCount,
} from '../markdown';

describe('esc', () => {
  it('escapes HTML-significant characters including quotes', () => {
    expect(esc('<b>&"\'</b>')).toBe('&lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;');
  });
});

describe('slug', () => {
  it('lowercases and dashes non-alphanumerics', () => {
    expect(slug('Hello, World! 2024')).toBe('hello-world-2024');
  });
});

describe('parseFront', () => {
  it('returns body untouched when there is no frontmatter', () => {
    const r = parseFront('# Title\n\nBody');
    expect(r.body).toBe('# Title\n\nBody');
    expect(r.offset).toBe(0);
    expect(r.tags).toEqual([]);
  });

  it('parses tags, known keys, and extra keys with a line offset', () => {
    const md = '---\ntags: [daily, work]\ntype: "Person"\ncustom: hello\n---\n# Hi\n';
    const r = parseFront(md);
    expect(r.tags).toEqual(['daily', 'work']);
    expect(r.type).toBe('Person');
    expect(r.extra).toEqual({ custom: 'hello' });
    expect(r.body).toBe('# Hi\n');
    // 5 lines precede the body (---, tags, type, custom, ---)
    expect(r.offset).toBe(5);
  });
});

describe('mdToHtml', () => {
  it('renders headings with slug ids', () => {
    const { html } = mdToHtml('## My Section', false);
    expect(html).toContain('<h2 id="my-section"');
    expect(html).toContain('My Section');
  });

  it('emits task rows with the frontmatter offset applied', () => {
    const { html } = mdToHtml('- [ ] buy milk', false, '', 5);
    expect(html).toContain('data-task="5"');
  });

  it('keeps code block source retrievable and records the language', () => {
    const { html, codeBlocks } = mdToHtml('```js\nconst a = 1;\n```', false);
    expect(codeBlocks.cb0).toBe('const a = 1;');
    expect(html).toContain('data-copy="cb0"');
  });

  it('records mermaid source in mermaidBlocks', () => {
    const { mermaidBlocks } = mdToHtml('```mermaid\ngraph TD;\nA-->B;\n```', false);
    expect(mermaidBlocks.mmd0).toBe('graph TD;\nA-->B;');
  });

  it('neutralizes attribute injection through wiki links', () => {
    const { html } = mdToHtml('[[x" onpointerover="alert(1)]]', true);
    // The payload must not surface as a live attribute.
    expect(html).not.toMatch(/onpointerover="alert/);
  });

  it('neutralizes attribute injection through inline math', () => {
    const { html } = mdToHtml('$x" onclick="alert(1)$', false);
    expect(html).not.toMatch(/onclick="alert/);
  });

  it('renders inline links, and leaves unsafe schemes as literal text', () => {
    const { html } = mdToHtml('See [Current State](#current-state) and [x](javascript:alert(1))', false);
    expect(html).toContain('<a href="#current-state"');
    expect(html).toContain('>Current State</a>');
    // The unsafe one stays inert literal text rather than becoming a clickable href.
    expect(html).not.toMatch(/<a[^>]+javascript:/);
    expect(html).toContain('[x](javascript:alert(1))');
  });

  it('joins a soft-wrapped paragraph into one block', () => {
    const { html } = mdToHtml('Full wipe of the previous install,\nrebuilt clean from scratch.', false);
    expect(html.match(/<p /g)).toHaveLength(1);
    expect(html).toContain('install, rebuilt clean');
  });

  it('renders thematic breaks instead of literal dashes', () => {
    const { html } = mdToHtml('a\n\n---\n\nb', false);
    expect(html).toContain('<hr');
    expect(html).not.toContain('>---<');
  });

  it('renders ordered lists and nested items as real lists', () => {
    const { html } = mdToHtml('1. first\n2. second\n   - nested\n', false);
    expect(html).toContain('<ol');
    expect(html).toContain('<li style="margin-bottom:5px">first</li>');
    expect(html).toContain('<ul');
    expect(html).toContain('nested');
  });

  it('renders emphasis and strikethrough but leaves snake_case alone', () => {
    const { html } = mdToHtml('*soft* and ~~gone~~ but not snake_case_name', false);
    expect(html).toContain('<em>soft</em>');
    expect(html).toContain('<del');
    expect(html).toContain('snake_case_name');
  });

  it('does not apply emphasis inside code spans', () => {
    const { html } = mdToHtml('`a_b_c` and `**x**`', false);
    expect(html).not.toContain('<em>');
    expect(html).toContain('**x**');
  });

  it('renders h4-h6', () => {
    const { html } = mdToHtml('#### Deep', false);
    expect(html).toContain('<h4 id="deep"');
  });

  it('renders tables with alignment', () => {
    const { html } = mdToHtml('| a | b |\n| :-- | --: |\n| 1 | 2 |', false);
    expect(html).toContain('<table');
    expect(html).toContain('text-align:right');
  });
});

describe('htmlToMd round-trip', () => {
  it('preserves headings, tasks, lists, and bold through a render cycle', () => {
    const src = '# Title\n\n- [x] done thing\n\n- item one\n- item two\n\nSome **bold** text';
    const { html } = mdToHtml(src, false);
    const back = htmlToMd(html);
    expect(back).toContain('# Title');
    expect(back).toContain('- [x] done thing');
    expect(back).toContain('- item one');
    expect(back).toContain('**bold**');
  });

  it('preserves nested and ordered lists through a render cycle', () => {
    const src = '1. first\n2. second\n   - nested a\n   - nested b';
    const back = htmlToMd(mdToHtml(src, false).html);
    expect(back).toContain('1. first');
    expect(back).toContain('2. second');
    expect(back).toContain('  - nested a');
    expect(back).toContain('  - nested b');
  });

  it('preserves links and thematic breaks through a render cycle', () => {
    const back = htmlToMd(mdToHtml('[docs](https://example.com)\n\n---\n\ntail', false).html);
    expect(back).toContain('[docs](https://example.com)');
    expect(back).toContain('---');
  });

  it('preserves code fence language through a render cycle', () => {
    const { html } = mdToHtml('```python\nprint(1)\n```', false);
    const back = htmlToMd(html);
    expect(back).toContain('```python');
    expect(back).toContain('print(1)');
  });

  it('preserves mermaid source through a render cycle', () => {
    const { html } = mdToHtml('```mermaid\ngraph TD;\nA-->B;\n```', false);
    const back = htmlToMd(html);
    expect(back).toContain('```mermaid');
    expect(back).toContain('A-->B;');
  });

  it('preserves inline math through a render cycle', () => {
    const { html } = mdToHtml('Euler: $e^{i\\pi}+1=0$', false);
    const back = htmlToMd(html);
    expect(back).toContain('$e^{i\\pi}+1=0$');
  });

  it('preserves wiki links through a render cycle', () => {
    const { html } = mdToHtml('See [[Other Note]]', true);
    const back = htmlToMd(html);
    expect(back).toContain('[[Other Note]]');
  });
});

describe('parseEml', () => {
  it('splits headers and body', () => {
    const r = parseEml('From: a@x.com\nTo: b@y.com\nSubject: Hi\n\n<p>Body</p>');
    expect(r.from).toBe('a@x.com');
    expect(r.to).toBe('b@y.com');
    expect(r.subject).toBe('Hi');
    expect(r.body).toBe('<p>Body</p>');
  });
});

describe('outlineMd / wordCount', () => {
  it('collects h1-h3 headings', () => {
    expect(outlineMd('# A\n## B\n#### D')).toEqual([
      { level: 1, text: 'A', id: 'a' },
      { level: 2, text: 'B', id: 'b' },
    ]);
  });

  it('counts words ignoring markup', () => {
    expect(wordCount('# Hello world `code`')).toBe(3);
  });
});

describe('diffLines', () => {
  it('marks additions and deletions around a common core', () => {
    const rows = diffLines(['a', 'b', 'c'], ['a', 'x', 'c']);
    expect(rows).toEqual([
      { t: 'same', v: 'a' },
      { t: 'del', v: 'b' },
      { t: 'add', v: 'x' },
      { t: 'same', v: 'c' },
    ]);
  });
});
