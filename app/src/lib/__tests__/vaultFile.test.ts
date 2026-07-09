import { describe, expect, it } from 'vitest';
import { MERGE_MARKER, isSupportedFile, mergeNoteContent, typeFromFilename } from '../vaultFile';

describe('typeFromFilename', () => {
  it('maps extensions case-insensitively', () => {
    expect(typeFromFilename('a.MD')).toBe('md');
    expect(typeFromFilename('a.Html')).toBe('html');
    expect(typeFromFilename('a.PDF')).toBe('pdf');
    expect(typeFromFilename('a.JPEG')).toBe('image');
    expect(typeFromFilename('a.eml')).toBe('eml');
  });
});

describe('isSupportedFile', () => {
  it('accepts app-representable types and rejects binaries', () => {
    expect(isSupportedFile('note.md')).toBe(true);
    expect(isSupportedFile('page.html')).toBe(true);
    expect(isSupportedFile('scan.pdf')).toBe(true);
    expect(isSupportedFile('pic.webp')).toBe(true);
    expect(isSupportedFile('doc.docx')).toBe(false);
    expect(isSupportedFile('archive.zip')).toBe(false);
  });
});

describe('mergeNoteContent', () => {
  it('returns the winner unchanged when the loser has nothing unique', () => {
    expect(mergeNoteContent('a\nb\n', 'a\nb')).toBe('a\nb\n');
  });

  it('folds unique loser lines in under a visible marker', () => {
    const merged = mergeNoteContent('a\nb\n', 'b\nc\nd');
    expect(merged).toContain(MERGE_MARKER);
    expect(merged.indexOf('c')).toBeGreaterThan(merged.indexOf(MERGE_MARKER));
    expect(merged).toContain('c\nd');
    expect(merged.startsWith('a\nb\n')).toBe(true);
  });
});
