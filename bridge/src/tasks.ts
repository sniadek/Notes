// Ported from app/src/lib/tasks.ts — kept byte-for-byte compatible on the task-line format
// so tasks created here parse identically in the desktop app, and vice versa.

export type TaskPriority = 'low' | 'medium' | 'high';

const CHECKBOX_RE = /^-\s\[( |x)\]\s/i;
const DUE_RE = /📅\s*(\d{4}-\d{2}-\d{2})/;
const PRIORITY_RE = /(⏫|🔼|🔽)/;

const PRIORITY_EMOJI: Record<TaskPriority, string> = {
  high: '⏫',
  medium: '🔼',
  low: '🔽',
};

export interface ParsedTaskLine {
  done: boolean;
  text: string;
  due?: string;
  priority?: TaskPriority;
}

export function parseTaskLine(line: string): ParsedTaskLine | null {
  if (!CHECKBOX_RE.test(line)) return null;
  const done = /\[x\]/i.test(line);
  let rest = line.replace(CHECKBOX_RE, '');

  let due: string | undefined;
  const dueMatch = rest.match(DUE_RE);
  if (dueMatch) { due = dueMatch[1]; rest = rest.replace(DUE_RE, ''); }

  let priority: TaskPriority | undefined;
  const prMatch = rest.match(PRIORITY_RE);
  if (prMatch) {
    priority = (Object.keys(PRIORITY_EMOJI) as TaskPriority[]).find((k) => PRIORITY_EMOJI[k] === prMatch[1]);
    rest = rest.replace(PRIORITY_RE, '');
  }

  return { done, text: rest.replace(/\s+/g, ' ').trim(), due, priority };
}

export function buildTaskLine(opts: { text: string; due?: string; priority?: TaskPriority; done?: boolean }): string {
  const marker = opts.done ? 'x' : ' ';
  const parts = [opts.text.trim()];
  if (opts.due) parts.push('📅 ' + opts.due);
  if (opts.priority) parts.push(PRIORITY_EMOJI[opts.priority]);
  return '- [' + marker + '] ' + parts.join(' ');
}

export interface ParsedTask extends ParsedTaskLine {
  id: string;
  filePath: string;
  line: number;
}

export function scanTasks(filePath: string, source: string): ParsedTask[] {
  const out: ParsedTask[] = [];
  source.split('\n').forEach((line, idx) => {
    const parsed = parseTaskLine(line);
    if (!parsed) return;
    out.push({ id: filePath + ':' + idx, filePath, line: idx, ...parsed });
  });
  return out;
}

export function todayISO(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function toLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isOverdue(due: string | undefined): boolean {
  if (!due) return false;
  return toLocalDate(due).getTime() < toLocalDate(todayISO()).getTime();
}

export function isToday(due: string | undefined): boolean {
  return !!due && due === todayISO();
}
