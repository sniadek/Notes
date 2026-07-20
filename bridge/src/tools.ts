import { z, type ZodRawShape } from 'zod';
import type { Config } from './config.ts';
import { appendUnderSection, dailyNotePath, renderDailyTemplate } from './dailyNotes.ts';
import { buildTaskLine, isOverdue, isToday, scanTasks, todayISO, type TaskPriority } from './tasks.ts';
import type { Vault } from './vault.ts';
import type { VaultIndex } from './vaultIndex.ts';

export interface ToolContext {
  vault: Vault;
  index: VaultIndex;
  config: Config;
  // Mirrors Config.allowWrites. Write tools refuse to execute rather than relying solely on
  // not having been advertised to the client (defense in depth).
  canWrite: boolean;
}

// MCP-shaped tool descriptor. `inputSchema` is a Zod raw shape because the MCP SDK accepts
// Zod schemas only (server/zod-compat.d.ts: AnySchema = z3.ZodTypeAny | z4.$ZodType) — there
// is no raw-JSON-Schema passthrough — and it gives us argument validation for free.
export interface Tool {
  name: string;
  description: string;
  inputSchema: ZodRawShape;
  writes: boolean;
  execute: (args: Record<string, unknown>, ctx: ToolContext) => Promise<string>;
}

const MAX_NOTE_CHARS = 8000;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function str(args: Record<string, unknown>, key: string, fallback?: string): string {
  const v = args[key];
  if (typeof v === 'string' && v.length) return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`missing required argument: ${key}`);
}

const searchNotes: Tool = {
  writes: false,
  name: 'search_notes',
  description: 'Search the notes vault by keyword. Returns matching file paths with a snippet of surrounding context.',
  inputSchema: {
    query: z.string().describe('Keywords to search for.'),
    limit: z.number().optional().describe('Max results to return (default 8).'),
  },
  async execute(args, ctx) {
    const query = str(args, 'query');
    const limit = typeof args.limit === 'number' ? args.limit : 8;
    const hits = await ctx.index.search(query, limit);
    return JSON.stringify(hits);
  },
};

const readNote: Tool = {
  writes: false,
  name: 'read_note',
  description: 'Read the full content of a note, given its vault-relative path (as returned by search_notes or list_tasks).',
  inputSchema: {
    path: z.string().describe('Vault-relative file path, e.g. "Projects/roadmap.md".'),
  },
  async execute(args, ctx) {
    const relPath = str(args, 'path');
    const file = await ctx.index.readByPath(relPath);
    if (!file) return JSON.stringify({ error: `not found: ${relPath}` });
    const content = file.content.length > MAX_NOTE_CHARS ? file.content.slice(0, MAX_NOTE_CHARS) + '\n…(truncated)' : file.content;
    return JSON.stringify({ path: file.path, title: file.title, content });
  },
};

const listTasks: Tool = {
  writes: false,
  name: 'list_tasks',
  description: 'List tasks (checkbox lines) across the vault, optionally filtered.',
  inputSchema: {
    filter: z.enum(['all', 'open', 'done', 'overdue', 'today']).optional().describe('Defaults to "open".'),
  },
  async execute(args, ctx) {
    const filter = typeof args.filter === 'string' ? args.filter : 'open';
    const files = await ctx.index.allIndexed();
    const all = files.filter((f) => f.path.endsWith('.md')).flatMap((f) => scanTasks(f.path, f.content));
    const filtered = all.filter((t) => {
      switch (filter) {
        case 'done': return t.done;
        case 'open': return !t.done;
        case 'overdue': return !t.done && isOverdue(t.due);
        case 'today': return !t.done && isToday(t.due);
        default: return true;
      }
    });
    return JSON.stringify(filtered);
  },
};

const createNote: Tool = {
  writes: true,
  name: 'create_note',
  description: 'Create a new note file in the vault. Fails if the path already exists.',
  inputSchema: {
    path: z.string().describe('Vault-relative path, e.g. "Ideas/new-idea.md". Must end in .md.'),
    content: z.string().describe('Markdown content for the new note.'),
  },
  async execute(args, ctx) {
    const relPath = str(args, 'path');
    const content = str(args, 'content', '');
    await ctx.vault.createFile(relPath, content);
    return JSON.stringify({ ok: true, path: relPath });
  },
};

async function ensureDailyNote(ctx: ToolContext, dateISO: string): Promise<string> {
  const relPath = dailyNotePath(ctx.config.dailyFolder, dateISO);
  if (!(await ctx.vault.exists(relPath))) {
    await ctx.vault.createFile(relPath, renderDailyTemplate(ctx.config.dailyTemplate, dateISO));
  }
  return relPath;
}

const appendDailyNote: Tool = {
  writes: true,
  name: 'append_daily_note',
  description: "Append a line to today's daily note, under a section heading (creating the day's note and/or heading if needed).",
  inputSchema: {
    text: z.string().describe('The line to add.'),
    heading: z.string().optional().describe('Section heading, e.g. "Log" or "Questions". Defaults to "Log".'),
  },
  async execute(args, ctx) {
    const text = str(args, 'text');
    const heading = str(args, 'heading', 'Log');
    const dateISO = todayISO();
    const relPath = await ensureDailyNote(ctx, dateISO);
    const current = await ctx.vault.readFile(relPath);
    await ctx.vault.writeFile(relPath, appendUnderSection(current, heading, '- ' + text));
    return JSON.stringify({ ok: true, path: relPath, heading });
  },
};

const addTask: Tool = {
  writes: true,
  name: 'add_task',
  description: "Add a task checkbox. Defaults to today's daily note under a \"Tasks\" heading; pass path to target a different note instead.",
  inputSchema: {
    text: z.string().describe('Task description.'),
    due: z.string().optional().describe('Due date as YYYY-MM-DD.'),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    path: z.string().optional().describe("Vault-relative note path to add the task to. Defaults to today's daily note."),
  },
  async execute(args, ctx) {
    const text = str(args, 'text');
    const due = typeof args.due === 'string' ? args.due : undefined;
    if (due !== undefined && !ISO_DATE_RE.test(due)) {
      throw new Error(`due must be an exact YYYY-MM-DD date, got: ${due}`);
    }
    const priority = typeof args.priority === 'string' ? (args.priority as TaskPriority) : undefined;
    const line = buildTaskLine({ text, due, priority });
    let relPath: string;
    if (typeof args.path === 'string' && args.path) {
      relPath = args.path;
      // Don't silently create an arbitrary note when the model names a non-existent target —
      // surface a clear error instead of a raw ENOENT (or a note appearing at a guessed path).
      if (!(await ctx.vault.exists(relPath))) {
        throw new Error(`note does not exist: ${relPath} (omit path to add to today's daily note, or create_note first)`);
      }
    } else {
      relPath = await ensureDailyNote(ctx, todayISO());
    }
    const current = await ctx.vault.readFile(relPath);
    await ctx.vault.writeFile(relPath, appendUnderSection(current, 'Tasks', line));
    return JSON.stringify({ ok: true, path: relPath, line });
  },
};

const completeTask: Tool = {
  writes: true,
  name: 'complete_task',
  description: 'Mark a task done or not-done, given the task id returned by list_tasks (format "path:lineNumber").',
  inputSchema: {
    id: z.string().describe('Task id from list_tasks, e.g. "Daily/2026-07-16.md:4".'),
    done: z.boolean().optional().describe('Defaults to true.'),
  },
  async execute(args, ctx) {
    const id = str(args, 'id');
    const sep = id.lastIndexOf(':');
    if (sep === -1) throw new Error(`malformed task id: ${id}`);
    const relPath = id.slice(0, sep);
    const lineNo = Number(id.slice(sep + 1));
    const done = args.done === undefined ? true : Boolean(args.done);
    const current = await ctx.vault.readFile(relPath);
    const lines = current.split('\n');
    const line = lines[lineNo];
    if (line === undefined || !/^-\s\[( |x)\]\s/i.test(line)) {
      throw new Error(`no task found at ${id}`);
    }
    lines[lineNo] = line.replace(/^-\s\[( |x)\]\s/i, done ? '- [x] ' : '- [ ] ');
    await ctx.vault.writeFile(relPath, lines.join('\n'));
    return JSON.stringify({ ok: true, id, done });
  },
};

export const ALL_TOOLS: Tool[] = [searchNotes, readNote, listTasks, createNote, appendDailyNote, addTask, completeTask];

export function toolsFor(ctx: ToolContext): Tool[] {
  return ctx.canWrite ? ALL_TOOLS : ALL_TOOLS.filter((t) => !t.writes);
}

// Single enforcement point for the write gate, used by the MCP request handler. toolsFor()
// already hides write tools from a read-only server, but a client can invoke a name it cached
// from an earlier write-enabled session — so refuse here too rather than trusting the
// advertised list (the same defense-in-depth the old agent loop applied per sender).
export async function executeTool(tool: Tool, args: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  if (tool.writes && !ctx.canWrite) {
    throw new Error('server is read-only: writes are disabled (set ALLOW_WRITES=true to enable)');
  }
  return tool.execute(args, ctx);
}
