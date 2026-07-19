import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Config } from '../config.ts';
import { buildTaskLine, isOverdue, parseTaskLine } from '../tasks.ts';
import { appendUnderSection, renderDailyTemplate } from '../dailyNotes.ts';
import { ALL_TOOLS, executeTool, toolsFor, type Tool, type ToolContext } from '../tools.ts';
import { Vault } from '../vault.ts';
import { VaultIndex } from '../vaultIndex.ts';

const tool = (name: string): Tool => ALL_TOOLS.find((t) => t.name === name)!;

// Mirrors the MCP request handler in mcp.ts: catch throws into {error}, invalidate the index
// after a write.
async function run(name: string, args: Record<string, unknown>, ctx: ToolContext) {
  const t = tool(name);
  try {
    const out = JSON.parse(await executeTool(t, args, ctx));
    if (t.writes) ctx.index.invalidate();
    return out;
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

const testConfig = (root: string): Config => ({
  vaultRoot: root,
  dailyFolder: 'Daily',
  dailyTemplate: '---\ntags: [daily]\n---\n# {{date}}\n\n',
  allowWrites: true,
});

const todayFile = () => 'Daily/' + new Date().toISOString().slice(0, 10) + '.md';

describe('tasks helpers', () => {
  it('parses a full task line', () => {
    expect(parseTaskLine('- [ ] Buy milk 📅 2026-07-14 ⏫')).toEqual({
      done: false, text: 'Buy milk', due: '2026-07-14', priority: 'high',
    });
  });
  it('round-trips build -> parse', () => {
    const line = buildTaskLine({ text: 'Ship it', due: '2026-07-20', priority: 'low' });
    expect(line).toBe('- [ ] Ship it 📅 2026-07-20 🔽');
    expect(parseTaskLine(line)).toMatchObject({ text: 'Ship it', due: '2026-07-20', priority: 'low', done: false });
  });
  it('non-task lines return null', () => {
    expect(parseTaskLine('## Heading')).toBeNull();
  });
});

describe('daily note helpers', () => {
  it('renders template tokens', () => {
    expect(renderDailyTemplate('# {{date}}', '2026-07-16')).toBe('# 2026-07-16');
  });
  it('appendUnderSection creates a missing section', () => {
    expect(appendUnderSection('# Day\n', 'Tasks', '- [ ] x')).toContain('## Tasks\n- [ ] x');
  });
  it('appendUnderSection reuses an existing section', () => {
    const src = '# Day\n\n## Tasks\n- [ ] a\n';
    const out = appendUnderSection(src, 'Tasks', '- [ ] b');
    expect((out.match(/^## Tasks$/gm) || []).length).toBe(1);
    expect(out).toContain('- [ ] a');
    expect(out).toContain('- [ ] b');
  });
});

describe('vault scoping', () => {
  let root: string;
  beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'vault-')); });
  afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });

  it('rejects traversal and absolute paths, allows relative', () => {
    const v = new Vault(root);
    expect(() => v.scoped('../etc/passwd')).toThrow(/escape/);
    expect(() => v.scoped('/etc/passwd')).toThrow(/relative/);
    expect(() => v.scoped('a/../../b')).toThrow(/escape/);
    expect(v.scoped('Notes/x.md')).toBe(path.join(root, 'Notes/x.md'));
  });
});

describe('tools', () => {
  let root: string;
  let ctx: ToolContext;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'vault-'));
    await fs.mkdir(path.join(root, 'Projects'), { recursive: true });
    await fs.writeFile(path.join(root, 'Projects/roadmap.md'),
      '# Roadmap\nNotes about Ollama.\n## Tasks\n- [ ] Ship harness 📅 2026-07-10 ⏫\n- [x] Draft plan\n');
    const vault = new Vault(root);
    ctx = { vault, index: new VaultIndex(vault), config: testConfig(root), canWrite: true };
  });
  afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });

  it('search finds by keyword, empty query returns []', async () => {
    expect((await run('search_notes', { query: 'Ollama' }, ctx)).some((h: any) => h.path === 'Projects/roadmap.md')).toBe(true);
    expect(await run('search_notes', { query: '   ' }, ctx)).toEqual([]);
  });

  it('read_note returns content, missing path returns error', async () => {
    expect((await run('read_note', { path: 'Projects/roadmap.md' }, ctx)).content).toContain('Roadmap');
    expect((await run('read_note', { path: 'nope.md' }, ctx)).error).toBeTruthy();
  });

  it('list_tasks open excludes done tasks', async () => {
    const open = await run('list_tasks', { filter: 'open' }, ctx);
    expect(open.some((t: any) => t.text === 'Ship harness')).toBe(true);
    expect(open.some((t: any) => t.done)).toBe(false);
  });

  it('create_note writes, rejects duplicate and traversal', async () => {
    expect((await run('create_note', { path: 'Ideas/x.md', content: 'hi' }, ctx)).ok).toBe(true);
    expect(await ctx.vault.readFile('Ideas/x.md')).toContain('hi');
    expect((await run('create_note', { path: 'Ideas/x.md', content: 'again' }, ctx)).error).toBeTruthy();
    expect((await run('create_note', { path: '../escape.md', content: 'x' }, ctx)).error).toMatch(/escape/);
  });

  it('freshly created note is visible to read_note in the same turn', async () => {
    await run('create_note', { path: 'Ideas/y.md', content: 'fresh' }, ctx);
    expect((await run('read_note', { path: 'Ideas/y.md' }, ctx)).content).toContain('fresh');
  });

  it('add_task writes app-compatible line to today\'s daily note', async () => {
    const r = await run('add_task', { text: 'Call bank', due: '2026-07-18', priority: 'high' }, ctx);
    expect(r.ok).toBe(true);
    expect(await ctx.vault.readFile(todayFile())).toContain('- [ ] Call bank 📅 2026-07-18 ⏫');
  });

  it('add_task rejects non-ISO due dates', async () => {
    expect((await run('add_task', { text: 'x', due: 'tomorrow' }, ctx)).error).toMatch(/YYYY-MM-DD/);
  });

  it('add_task to a missing explicit path errors clearly and creates nothing', async () => {
    const r = await run('add_task', { text: 'Ghost', path: 'Projects/ghost.md' }, ctx);
    expect(r.error).toMatch(/does not exist/);
    expect(await ctx.vault.exists('Projects/ghost.md')).toBe(false);
  });

  it('complete_task toggles done state on disk', async () => {
    const ship = (await run('list_tasks', { filter: 'open' }, ctx)).find((t: any) => t.text === 'Ship harness');
    expect((await run('complete_task', { id: ship.id }, ctx)).done).toBe(true);
    expect(await ctx.vault.readFile('Projects/roadmap.md')).toContain('- [x] Ship harness');
    expect((await run('complete_task', { id: ship.id, done: false }, ctx)).done).toBe(false);
    expect(await ctx.vault.readFile('Projects/roadmap.md')).toContain('- [ ] Ship harness');
  });

  it('complete_task rejects malformed / non-task / out-of-range ids', async () => {
    expect((await run('complete_task', { id: 'Projects/roadmap.md' }, ctx)).error).toBeTruthy();
    expect((await run('complete_task', { id: 'Projects/roadmap.md:0' }, ctx)).error).toBeTruthy();
    expect((await run('complete_task', { id: 'Projects/roadmap.md:9999' }, ctx)).error).toBeTruthy();
  });

  it('overdue detection is date-correct', () => {
    expect(isOverdue('2000-01-01')).toBe(true);
    expect(isOverdue('2999-01-01')).toBe(false);
    expect(isOverdue(undefined)).toBe(false);
  });
});

describe('ALLOW_WRITES gating', () => {
  it('read-only server advertises only the read tools', () => {
    const names = toolsFor({ canWrite: false } as ToolContext).map((t) => t.name);
    expect(names).toEqual(['search_notes', 'read_note', 'list_tasks']);
  });

  it('write-enabled server advertises all seven', () => {
    const tools = toolsFor({ canWrite: true } as ToolContext);
    expect(tools).toHaveLength(7);
    expect(tools.filter((t) => t.writes).map((t) => t.name))
      .toEqual(['create_note', 'append_daily_note', 'add_task', 'complete_task']);
  });

  it('write tools still refuse when canWrite is false, even if invoked directly', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vault-'));
    try {
      const vault = new Vault(root);
      const ctx: ToolContext = {
        vault, index: new VaultIndex(vault), config: { ...testConfig(root), allowWrites: false }, canWrite: false,
      };
      const r = await run('create_note', { path: 'x.md', content: 'nope' }, ctx);
      expect(r.error).toMatch(/read-only|not allowed|writes/i);
      expect(await vault.exists('x.md')).toBe(false);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
