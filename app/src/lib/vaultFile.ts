import type { FileType } from '../types';

// Extension matching is case-insensitive (a vault can contain "Report.PDF" as easily as
// "report.pdf") — used both for freshly-discovered files and to self-heal any file whose
// stored type disagrees with what its actual filename says (see refreshVault).
const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']);
const TEXT_EXTS = new Set(['md', 'markdown', 'txt']);

function extOf(name: string): string {
  return (name.split('.').pop() || '').toLowerCase();
}

export function typeFromFilename(name: string): FileType {
  const ext = extOf(name);
  if (ext === 'html') return 'html';
  if (ext === 'eml') return 'eml';
  if (ext === 'pdf') return 'pdf';
  if (IMAGE_EXTS.has(ext)) return 'image';
  return 'md';
}

// Vault scans only adopt files the app can actually represent — anything else (binaries,
// office docs, archives) would be typed 'md', fail every UTF-8 read, and get retried on
// every poll forever.
export function isSupportedFile(name: string): boolean {
  const ext = extOf(name);
  return TEXT_EXTS.has(ext) || IMAGE_EXTS.has(ext) || ext === 'html' || ext === 'eml' || ext === 'pdf';
}

// Used when reconciling two dynamicFiles entries that turned out to represent the same
// on-disk file (see refreshVault): folds any lines unique to the entry being dropped into
// the surviving one under a visible marker, instead of silently discarding whichever entry
// loses the merge — and instead of splicing them in unmarked where they'd read as ordinary
// content out of context.
export const MERGE_MARKER = '<!-- recovered from a duplicate copy of this note -->';

export function mergeNoteContent(winner: string, loser: string): string {
  const seen = new Set(winner.split('\n').map((l) => l.trim()).filter(Boolean));
  const extra = loser.split('\n').filter((l) => l.trim() && !seen.has(l.trim()));
  if (!extra.length) return winner;
  const sep = winner && !winner.endsWith('\n') ? '\n' : '';
  return winner + sep + '\n' + MERGE_MARKER + '\n' + extra.join('\n') + '\n';
}
