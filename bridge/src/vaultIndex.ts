import path from 'node:path';
import { Vault } from './vault.ts';

const TEXT_EXTS = new Set(['.md', '.markdown', '.txt', '.html', '.eml']);
const STALE_MS = 30_000;

interface IndexedFile {
  path: string;
  title: string;
  content: string;
}

export interface SearchHit {
  path: string;
  title: string;
  snippet: string;
  score: number;
}

// In-memory keyword index over the vault's text files, lazily rescanned when stale. No
// file-watcher and no vector DB for v1 — personal vaults are small enough that a full rescan
// every ~30s of query activity is cheap; revisit with embeddings if search quality on a large
// vault ever falls short (see plan).
export class VaultIndex {
  private vault: Vault;
  private files: IndexedFile[] = [];
  private lastScan = 0;

  constructor(vault: Vault) {
    this.vault = vault;
  }

  private async ensureFresh(): Promise<void> {
    if (Date.now() - this.lastScan < STALE_MS && this.files.length) return;
    await this.rescan();
  }

  // Forces the next read to rescan from disk instead of serving the cached snapshot — call
  // after any write, since writes bypass this cache entirely and STALE_MS would otherwise
  // let a read immediately following a write see pre-write content.
  invalidate(): void {
    this.lastScan = 0;
  }

  async rescan(): Promise<void> {
    const relPaths = await this.vault.listFiles();
    const textPaths = relPaths.filter((p) => TEXT_EXTS.has(path.extname(p).toLowerCase()));
    const files: IndexedFile[] = [];
    for (const relPath of textPaths) {
      try {
        const content = await this.vault.readFile(relPath);
        files.push({ path: relPath, title: path.basename(relPath, path.extname(relPath)), content });
      } catch {
        // Skip unreadable files (permissions, race with a concurrent delete) rather than
        // failing the whole index.
      }
    }
    this.files = files;
    this.lastScan = Date.now();
  }

  async listPaths(): Promise<string[]> {
    await this.ensureFresh();
    return this.files.map((f) => f.path);
  }

  async allIndexed(): Promise<IndexedFile[]> {
    await this.ensureFresh();
    return this.files;
  }

  async readByPath(relPath: string): Promise<IndexedFile | undefined> {
    await this.ensureFresh();
    return this.files.find((f) => f.path === relPath);
  }

  async search(query: string, limit = 8): Promise<SearchHit[]> {
    await this.ensureFresh();
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];

    const hits: SearchHit[] = [];
    for (const file of this.files) {
      const title = file.title.toLowerCase();
      const body = file.content.toLowerCase();
      let score = 0;
      for (const term of terms) {
        // Title and body scored separately so a title match is worth 5×, not 6× (a shared
        // haystack would count each title hit in the body total too).
        score += countOccurrences(title, term) * 5 + countOccurrences(body, term);
      }
      if (score > 0) {
        hits.push({ path: file.path, title: file.title, snippet: snippetAround(file.content, terms[0]), score });
      }
    }
    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, limit);
  }
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let idx = 0;
  while ((idx = haystack.indexOf(needle, idx)) !== -1) {
    count++;
    idx += needle.length;
  }
  return count;
}

function snippetAround(content: string, term: string, radius = 120): string {
  const lower = content.toLowerCase();
  const idx = lower.indexOf(term.toLowerCase());
  if (idx === -1) return content.slice(0, radius * 2).trim();
  const start = Math.max(0, idx - radius);
  const end = Math.min(content.length, idx + term.length + radius);
  return (start > 0 ? '…' : '') + content.slice(start, end).trim() + (end < content.length ? '…' : '');
}
