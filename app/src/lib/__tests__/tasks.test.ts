import { describe, expect, it } from 'vitest';
import { buildTaskLine, isOverdue, isToday, parseTaskLine, scanTasks, todayISO } from '../tasks';
import type { NoteFile } from '../../types';

describe('parseTaskLine', () => {
  it('parses done state, due date, and priority', () => {
    const t = parseTaskLine('- [x] ship release 📅 2026-07-01 ⏫');
    expect(t).toEqual({ done: true, text: 'ship release', due: '2026-07-01', priority: 'high' });
  });

  it('returns null for non-task lines', () => {
    expect(parseTaskLine('just text')).toBeNull();
    expect(parseTaskLine('- plain bullet')).toBeNull();
  });
});

describe('buildTaskLine', () => {
  it('round-trips through parseTaskLine', () => {
    const line = buildTaskLine({ text: 'call bank', due: '2026-08-01', priority: 'medium' });
    expect(parseTaskLine(line)).toEqual({ done: false, text: 'call bank', due: '2026-08-01', priority: 'medium' });
  });
});

describe('scanTasks', () => {
  it('collects tasks with line indices from markdown files only', () => {
    const files: NoteFile[] = [
      { id: 'a', title: 'A', file: 'a.md', type: 'md', folder: 'Notes', pinned: false },
      { id: 'b', title: 'B', file: 'b.html', type: 'html', folder: 'Notes', pinned: false },
    ];
    const tasks = scanTasks(files, { a: 'intro\n- [ ] first\n- [x] second', b: '- [ ] ignored' });
    expect(tasks.map((t) => [t.fileId, t.line, t.done])).toEqual([['a', 1, false], ['a', 2, true]]);
  });
});

describe('date helpers', () => {
  it('flags past dates as overdue and today as today', () => {
    expect(isOverdue('2000-01-01')).toBe(true);
    expect(isOverdue(todayISO())).toBe(false);
    expect(isToday(todayISO())).toBe(true);
    expect(isToday(undefined)).toBe(false);
  });
});
