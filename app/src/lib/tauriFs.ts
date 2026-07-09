export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export interface FsEntry { path: string; name: string; is_dir: boolean; }

export async function pickVaultRoot(): Promise<string | null> {
  if (!isTauri()) return null;
  const { open } = await import('@tauri-apps/plugin-dialog');
  const dir = await open({ directory: true, multiple: false });
  return typeof dir === 'string' ? dir : null;
}

// Registers the vault root with the Rust side, which scopes every file command to it —
// must be called (idempotent) before any other FS command after app start or vault switch.
export async function setVaultRoot(root: string): Promise<void> {
  if (!isTauri()) return;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('set_vault_root', { path: root });
}

export async function readVaultTree(root: string): Promise<FsEntry[]> {
  if (!isTauri()) return [];
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<FsEntry[]>('read_vault_tree', { root });
}

export async function readFile(path: string): Promise<string> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string>('read_file', { path });
}

// Points directly at a file on disk via Tauri's asset protocol, instead of reading its bytes
// into JS — used for PDFs, which can't be read as UTF-8 text like the other file types.
export async function assetUrl(path: string): Promise<string> {
  const { convertFileSrc } = await import('@tauri-apps/api/core');
  return convertFileSrc(path);
}

export async function writeFile(path: string, contents: string): Promise<void> {
  if (!isTauri()) return;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('write_file', { path, contents });
}

export async function createFile(path: string, contents: string): Promise<void> {
  if (!isTauri()) return;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('create_file', { path, contents });
}

export async function copyFile(src: string, dest: string): Promise<void> {
  if (!isTauri()) return;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('copy_file', { src, dest });
}

export async function moveFile(src: string, dest: string): Promise<void> {
  if (!isTauri()) return;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('move_file', { src, dest });
}

export async function deleteFile(path: string): Promise<void> {
  if (!isTauri()) return;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('delete_file', { path });
}

export async function revealInFinder(path: string): Promise<void> {
  if (!isTauri()) return;
  const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
  await revealItemInDir(path);
}
