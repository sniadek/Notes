// Ported from app/src/lib/utils.ts — daily-note template rendering and section helpers,
// kept compatible with the desktop app's `{dailyFolder}/{iso}.md` + `## Heading` conventions.

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function weekdayName(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
}

export function timeStamp(): string {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

export const DEFAULT_DAILY_TEMPLATE = '---\ntags: [daily]\n---\n# {{date}}\n\n';

export function renderDailyTemplate(tpl: string, dateISO: string): string {
  const base = tpl && tpl.trim() ? tpl : DEFAULT_DAILY_TEMPLATE;
  return base
    .replace(/\{\{date\}\}/g, dateISO)
    .replace(/\{\{weekday\}\}/g, weekdayName(dateISO))
    .replace(/\{\{time\}\}/g, timeStamp());
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

// Inserts a line under the given `## heading`, creating the section at the end if it doesn't
// exist yet — mirrors appendUnderSection in app/src/lib/utils.ts.
export function appendUnderSection(source: string, heading: string, line: string): string {
  const lines = source.split('\n');
  const bounds = findSectionBounds(lines, heading);
  if (!bounds) {
    let s = source;
    if (s.length && !s.endsWith('\n')) s += '\n';
    if (s.length && !s.endsWith('\n\n')) s += '\n';
    return s + '## ' + heading + '\n' + line + '\n';
  }
  let insertAt = bounds.end;
  while (insertAt - 1 > bounds.hIdx && lines[insertAt - 1].trim() === '') insertAt--;
  lines.splice(insertAt, 0, line);
  return lines.join('\n');
}

export function dailyNotePath(dailyFolder: string, dateISO: string): string {
  return `${dailyFolder}/${dateISO}.md`;
}
