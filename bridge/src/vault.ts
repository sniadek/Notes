import { promises as fs } from 'node:fs';
import path from 'node:path';

// Mirrors the scoped() path-validation pattern in app/src-tauri/src/lib.rs: every vault
// operation here takes a vault-relative path, rejects `..` traversal, and re-checks the
// resolved absolute path still lives under VAULT_ROOT before touching disk.
export class Vault {
  readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  scoped(relPath: string): string {
    if (path.isAbsolute(relPath)) {
      throw new Error(`path must be relative to the vault: ${relPath}`);
    }
    const segments = relPath.split(/[/\\]/);
    if (segments.some((s) => s === '..')) {
      throw new Error(`path escapes vault root: ${relPath}`);
    }
    const resolved = path.resolve(this.root, relPath);
    const rootWithSep = this.root.endsWith(path.sep) ? this.root : this.root + path.sep;
    if (resolved !== this.root && !resolved.startsWith(rootWithSep)) {
      throw new Error(`path outside vault root: ${relPath}`);
    }
    return resolved;
  }

  async readFile(relPath: string): Promise<string> {
    return fs.readFile(this.scoped(relPath), 'utf8');
  }

  async writeFile(relPath: string, contents: string): Promise<void> {
    const abs = this.scoped(relPath);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, contents, 'utf8');
  }

  // Never truncates an existing file — same guarantee as create_file in lib.rs.
  async createFile(relPath: string, contents: string): Promise<void> {
    const abs = this.scoped(relPath);
    if (await this.exists(relPath)) {
      throw new Error(`file already exists: ${relPath}`);
    }
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, contents, 'utf8');
  }

  async exists(relPath: string): Promise<boolean> {
    try {
      await fs.access(this.scoped(relPath));
      return true;
    } catch {
      return false;
    }
  }

  // Recursively lists every vault-relative file path, skipping dotfiles/dotfolders. No
  // delete/move here — deliberately not exposed, see tools.ts.
  async listFiles(): Promise<string[]> {
    const out: string[] = [];
    const walk = async (dir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(abs);
        } else {
          out.push(path.relative(this.root, abs));
        }
      }
    };
    await walk(this.root);
    return out;
  }
}
