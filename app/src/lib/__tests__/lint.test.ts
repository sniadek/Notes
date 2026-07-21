import { describe, expect, it } from 'vitest';
import { lintSource } from '../editor/lint';

const titles = new Set(['Roadmap', 'Meeting Notes']);
const messages = (doc: string, t = titles) => lintSource(doc, t).map((p) => p.message);

describe('lintSource — fenced code', () => {
  it('reports invalid JSON with the parser message', () => {
    const problems = lintSource('```json\n{ "a": 1, }\n```\n');
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe('error');
    // The offset must land inside the block, not at the doc start.
    expect(problems[0].from).toBeGreaterThan(8);
  });

  it('accepts valid JSON', () => {
    expect(lintSource('```json\n{ "a": [1, 2] }\n```\n')).toEqual([]);
  });

  it('flags an unclosed fence', () => {
    expect(messages('# Title\n\n```ts\nconst a = 1;\n')).toEqual(['Unclosed code fence — no matching ```']);
  });

  it('flags unbalanced brackets in a code language', () => {
    expect(messages('```ts\nfunction a() {\n  return 1;\n```\n')).toEqual(['Unclosed "{"']);
  });

  it('ignores braces inside strings and comments', () => {
    expect(lintSource('```ts\nconst s = "{ unclosed";\n// another {\nconst t = `a{b`;\n```\n')).toEqual([]);
  });

  it('leaves languages it cannot parse alone', () => {
    expect(lintSource('```bash\nif [ -f x ]; then echo "{"\n```\n')).toEqual([]);
  });

  it('does not lint markdown constructs inside code blocks', () => {
    expect(lintSource('```md\n[[Nonexistent]]\n| a | b |\n| --- | --- |\n| 1 |\n```\n', titles)).toEqual([]);
  });
});

describe('lintSource — markdown structure', () => {
  it('flags a wikilink with no matching note', () => {
    expect(messages('See [[Nonexistent]] here.')).toEqual(['No note titled "Nonexistent"']);
  });

  it('accepts known notes case-insensitively, with aliases and headings', () => {
    expect(lintSource('[[Roadmap]] [[roadmap]] [[Roadmap|the plan]] [[Meeting Notes#Agenda]]', titles)).toEqual([]);
  });

  it('flags table rows whose cell count differs from the header', () => {
    const doc = '| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 |\n';
    expect(messages(doc)).toEqual(['Table row has 1 cells, header has 2']);
  });

  it('accepts a well-formed table', () => {
    expect(lintSource('| A | B |\n| --- | --- |\n| 1 | 2 |\n')).toEqual([]);
  });
});

describe('lintSource — frontmatter', () => {
  it('flags a line parseFront would silently drop', () => {
    expect(messages('---\ntitle: Ok\nthis is not a pair\n---\n\nBody')).toEqual([
      'Frontmatter line is not a "key: value" pair and will be ignored',
    ]);
  });

  it('accepts flat pairs and inline tag lists', () => {
    expect(lintSource('---\ntitle: Ok\ntags: [a, b]\n---\n\nBody')).toEqual([]);
  });

  it('flags an unclosed frontmatter block', () => {
    expect(messages('---\ntitle: Ok\n\nBody')).toEqual(['Unclosed frontmatter — no closing ---']);
  });

  it('ignores a --- rule that is not frontmatter', () => {
    expect(lintSource('# Title\n\n---\n\nBody')).toEqual([]);
  });
});

describe('lintSource — offsets', () => {
  it('returns ranges in document order', () => {
    const doc = 'See [[Missing One]] then [[Missing Two]]';
    const problems = lintSource(doc, titles);
    expect(problems).toHaveLength(2);
    expect(problems[0].from).toBeLessThan(problems[1].from);
    expect(doc.slice(problems[0].from, problems[0].to)).toBe('[[Missing One]]');
    expect(doc.slice(problems[1].from, problems[1].to)).toBe('[[Missing Two]]');
  });

  it('is empty for a clean document', () => {
    expect(lintSource('# Title\n\nSome prose with [[Roadmap]].\n\n```json\n{}\n```\n', titles)).toEqual([]);
  });
});
