import { describe, expect, it } from 'vitest';
import {
  appendUnderSection, isoWeekLabel, isoWeekMonday, linesInSection, linkifyMentions, renderDailyTemplate,
  routeDailyCapture, shiftISO, weekdayName,
} from '../utils';

describe('appendUnderSection', () => {
  it('creates the section when missing, padding a blank line before the heading', () => {
    const out = appendUnderSection('# 2026-07-07\n', 'Log', '- 09:00 first');
    expect(out).toBe('# 2026-07-07\n\n## Log\n- 09:00 first\n');
  });

  it('appends under an existing section, above the following heading', () => {
    const src = '# 2026-07-07\n\n## Log\n- 09:00 first\n\n## Tasks\n- [ ] a\n';
    const out = appendUnderSection(src, 'Log', '- 10:00 second');
    expect(out).toBe('# 2026-07-07\n\n## Log\n- 09:00 first\n- 10:00 second\n\n## Tasks\n- [ ] a\n');
  });

  it('appends to the last section when it runs to end of file', () => {
    const src = '# 2026-07-07\n\n## Log\n- 09:00 first\n';
    const out = appendUnderSection(src, 'Log', '- 10:00 second');
    expect(out).toBe('# 2026-07-07\n\n## Log\n- 09:00 first\n- 10:00 second\n');
  });
});

describe('renderDailyTemplate', () => {
  it('expands date, weekday, and time tokens', () => {
    const out = renderDailyTemplate('# {{date}} ({{weekday}})\n', '2026-07-07');
    expect(out).toBe('# 2026-07-07 (Tuesday)\n');
  });

  it('falls back to the built-in template when blank', () => {
    expect(renderDailyTemplate('   ', '2026-07-07')).toContain('# 2026-07-07');
  });
});

describe('shiftISO', () => {
  it('walks days forward and backward across month boundaries', () => {
    expect(shiftISO('2026-07-07', 1)).toBe('2026-07-08');
    expect(shiftISO('2026-07-01', -1)).toBe('2026-06-30');
    expect(shiftISO('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('weekdayName', () => {
  it('names the weekday for an ISO date', () => {
    expect(weekdayName('2026-07-07')).toBe('Tuesday');
  });
});

describe('linesInSection', () => {
  it('returns the non-blank lines under a heading', () => {
    const src = '# 2026-07-07\n\n## Tasks\n- [ ] a\n- [x] b\n\n## Log\n- 09:00 hi\n';
    expect(linesInSection(src, 'Tasks')).toEqual(['- [ ] a', '- [x] b']);
    expect(linesInSection(src, 'Log')).toEqual(['- 09:00 hi']);
  });

  it('returns an empty array when the section does not exist', () => {
    expect(linesInSection('# 2026-07-07\n', 'Tasks')).toEqual([]);
  });
});

describe('routeDailyCapture', () => {
  it('routes a todo prefix to a Tasks checkbox line', () => {
    expect(routeDailyCapture('todo buy milk')).toEqual({ heading: 'Tasks', line: '- [ ] buy milk' });
  });

  it('routes a question prefix to Questions', () => {
    expect(routeDailyCapture('? when is standup')).toEqual({ heading: 'Questions', line: '- when is standup' });
  });

  it('routes a mood:: prefix to Mood with a timestamp', () => {
    const r = routeDailyCapture('mood:: 4');
    expect(r.heading).toBe('Mood');
    expect(r.line).toMatch(/^- \d{2}:\d{2} mood:: 4$/);
  });

  it('falls back to a timestamped Log bullet for plain text', () => {
    const r = routeDailyCapture('shipped the feature');
    expect(r.heading).toBe('Log');
    expect(r.line).toMatch(/^- \d{2}:\d{2} shipped the feature$/);
  });
});

describe('linkifyMentions', () => {
  const titles = ['Alice', 'Project X'];

  it('links a mention that matches a known title case-insensitively', () => {
    expect(linkifyMentions('talked to @alice today', titles)).toBe('talked to [[Alice]] today');
  });

  it('leaves an unmatched mention as literal text', () => {
    expect(linkifyMentions('pinged @bob', titles)).toBe('pinged @bob');
  });
});

describe('isoWeekMonday / isoWeekLabel', () => {
  it('finds the Monday of the ISO week containing a date', () => {
    expect(isoWeekMonday('2026-07-07')).toBe('2026-07-06');
    expect(isoWeekMonday('2026-07-06')).toBe('2026-07-06');
    expect(isoWeekMonday('2026-07-12')).toBe('2026-07-06');
  });

  it('labels the ISO week', () => {
    expect(isoWeekLabel('2026-07-07')).toBe('2026-W28');
  });
});
