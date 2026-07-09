import type { DocFontSize } from '../types';
import { buildTaskLine, todayISO } from './tasks';

export const FONT_SCALES: Record<DocFontSize, number> = {
  small: 0.9, medium: 1, large: 1.15, xlarge: 1.3,
};

export function agoLabel(ts: number | undefined): string {
  if (!ts) return '';
  const d = Date.now() - ts;
  const m = Math.round(d / 60000);
  if (m < 1) return 'now';
  if (m < 60) return m + 'm';
  const h = Math.round(m / 60);
  if (h < 24) return h + 'h';
  const dd = Math.round(h / 24);
  if (dd < 7) return dd + 'd';
  return Math.round(dd / 7) + 'w';
}

export function nowStamp(): string {
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = new Date();
  return M[d.getMonth()] + ' ' + d.getDate() + ', ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

// Time-only stamp ("14:30") for daily-note capture entries — the file is already dated,
// so entries only need the time, unlike nowStamp which includes the month/day.
export function timeStamp(): string {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function weekdayName(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
}

// Shifts a local ISO date (YYYY-MM-DD) by whole days, staying in local time so month/year
// rollovers and DST are handled by the Date constructor. Used by daily-note day navigation.
export function shiftISO(dateISO: string, deltaDays: number): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const dt = new Date(y, m - 1, d + deltaDays);
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
}

const DEFAULT_DAILY_TEMPLATE = '---\ntags: [daily]\n---\n# {{date}}\n\n';

// Expands a daily-note template's tokens for a given date. Falls back to the built-in
// template when the configured one is blank, so a note is never created empty.
export function renderDailyTemplate(tpl: string, dateISO: string): string {
  const base = tpl && tpl.trim() ? tpl : DEFAULT_DAILY_TEMPLATE;
  return base
    .replace(/\{\{date\}\}/g, dateISO)
    .replace(/\{\{weekday\}\}/g, weekdayName(dateISO))
    .replace(/\{\{time\}\}/g, timeStamp());
}

export { DEFAULT_DAILY_TEMPLATE };

// Finds a `## heading`'s line index and the exclusive end of its section (the next heading
// of any level, or end of file). Shared by appendUnderSection and linesInSection below.
function findSectionBounds(lines: string[], heading: string): { hIdx: number; end: number } | null {
  const headingRe = new RegExp('^#{1,6}\\s+' + escapeRegExp(heading) + '\\s*$');
  const hIdx = lines.findIndex((l) => headingRe.test(l));
  if (hIdx === -1) return null;
  let end = lines.length;
  for (let i = hIdx + 1; i < lines.length; i++) {
    if (/^#{1,6}\s+/.test(lines[i])) { end = i; break; }
  }
  return { hIdx, end };
}

// Inserts a line into a markdown document under the given `## heading`, creating the section
// at the end if it doesn't exist yet. Entries append to the bottom of their section (before
// the next heading), so a daily note reads top-to-bottom in chronological order.
export function appendUnderSection(source: string, heading: string, line: string): string {
  const lines = source.split('\n');
  const bounds = findSectionBounds(lines, heading);
  if (!bounds) {
    let s = source;
    if (s.length && !s.endsWith('\n')) s += '\n';
    if (s.length && !s.endsWith('\n\n')) s += '\n';
    return s + '## ' + heading + '\n' + line + '\n';
  }
  // Skip back over any blank lines that pad the bottom of the section so the new entry sits
  // directly under the last real line, not after a gap.
  let insertAt = bounds.end;
  while (insertAt - 1 > bounds.hIdx && lines[insertAt - 1].trim() === '') insertAt--;
  lines.splice(insertAt, 0, line);
  return lines.join('\n');
}

// Returns the non-blank lines under a `## heading` (used to pull tasks/log entries back out
// of a day's note for the weekly rollup and task carry-over features). Empty array if the
// section doesn't exist.
export function linesInSection(source: string, heading: string): string[] {
  const lines = source.split('\n');
  const bounds = findSectionBounds(lines, heading);
  if (!bounds) return [];
  return lines.slice(bounds.hIdx + 1, bounds.end).filter((l) => l.trim() !== '');
}

// Routes a raw capture string to a target section + rendered line. A leading `todo`/`t`
// makes it a checkbox task (so it shows up in the Task Manager); `q`/`?` files it under
// Questions; `mood::` files it under Mood; everything else becomes a timestamped bullet
// under Log. Pure (no hook deps) so the standalone quick-capture popup window can reuse it
// without pulling in the whole app hook.
export function routeDailyCapture(text: string): { heading: string; line: string } {
  const t = text.trim();
  const todo = t.match(/^(todo|t)\s+(.+)$/is);
  if (todo) return { heading: 'Tasks', line: buildTaskLine({ text: todo[2].trim() }) };
  const q = t.match(/^(q|\?)\s+(.+)$/is);
  if (q) return { heading: 'Questions', line: '- ' + q[2].trim() };
  const mood = t.match(/^mood::\s*(.+)$/i);
  if (mood) return { heading: 'Mood', line: '- ' + timeStamp() + ' mood:: ' + mood[1].trim() };
  return { heading: 'Log', line: '- ' + timeStamp() + ' ' + t };
}

// Replaces `@Word` mentions with `[[Word]]` wiki-links, but only when a case-insensitive
// title match exists among `titles` — an unmatched `@word` is left as literal text rather
// than silently becoming a broken link (mirrors the app's existing wiki-link click behavior,
// which only creates a note on an explicit click, never implicitly).
export function linkifyMentions(text: string, titles: string[]): string {
  const byLower = new Map(titles.map((t) => [t.toLowerCase(), t]));
  return text.replace(/@(\w[\w-]*)/g, (full, word: string) => {
    const match = byLower.get(word.toLowerCase());
    return match ? '[[' + match + ']]' : full;
  });
}

// Monday (as a local ISO date) of the ISO-8601 week containing `dateISO`.
export function isoWeekMonday(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay(); // 0=Sun..6=Sat
  const deltaToMonday = dow === 0 ? -6 : 1 - dow;
  return shiftISO(dateISO, deltaToMonday);
}

// ISO-8601 week label ("2026-W28") for the week containing `dateISO`. Uses the standard
// Thursday-anchored algorithm: the week's year is whichever year owns that week's Thursday.
export function isoWeekLabel(dateISO: string): string {
  const monday = isoWeekMonday(dateISO);
  const [y, m, d] = monday.split('-').map(Number);
  const thursday = new Date(y, m - 1, d + 3);
  const thursdayYear = thursday.getFullYear();
  const jan1 = new Date(thursdayYear, 0, 1);
  const week = Math.floor((thursday.getTime() - jan1.getTime()) / 86400000 / 7) + 1;
  return thursdayYear + '-W' + String(week).padStart(2, '0');
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function download(name: string, text: string, type?: string) {
  try {
    const b = new Blob([text], { type: type || 'text/plain' });
    const u = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = u;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  } catch {
    /* ignore */
  }
}

export function openInBrowser(html: string) {
  try {
    const w = window.open('', '_blank');
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
    }
  } catch {
    /* ignore */
  }
}

// Daily notes are titled with the local ISO date — same format the task lib already
// produces, so delegate instead of keeping a second copy of the date formatting.
export function dailyTitle(): string {
  return todayISO();
}
