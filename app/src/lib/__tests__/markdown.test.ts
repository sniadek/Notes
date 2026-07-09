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
