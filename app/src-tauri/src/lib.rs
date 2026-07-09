use serde::Serialize;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;
use tauri::State;

#[derive(Serialize)]
pub struct FsEntry {
  path: String,
  name: String,
  is_dir: bool,
}

// All file commands are scoped to this root: the webview can hold arbitrary HTML from
// notes/emails, so an XSS there must not translate into arbitrary filesystem access.
// (Defense in depth — the root itself is still supplied by the frontend after the user
// picks it in the native dialog, so this guards against path traversal and stray paths,
// not against fully compromised webview code choosing a hostile root.)
#[derive(Default)]
pub struct VaultRoot(Mutex<Option<PathBuf>>);

#[tauri::command]
fn set_vault_root(path: String, state: State<VaultRoot>) -> Result<(), String> {
  // Store the root exactly as the frontend gave it — do NOT canonicalize. On macOS
  // `/Users` is a firmlink to `/System/Volumes/Data/Users`, and iCloud paths add further
  // symlinks, so canonicalize() rewrites the prefix. The frontend always sends the raw
  // `/Users/...` form, so a canonicalized root would no longer prefix-match those paths and
  // scoped() would reject every read/write. The `..` rejection in scoped() is what actually
  // prevents traversal; the prefix check just confines operations to the chosen folder.
  let root = PathBuf::from(&path);
  if !root.is_dir() {
    return Err("vault root must be a directory".into());
  }
  if root.parent().is_none() {
    return Err("vault root must not be the filesystem root".into());
  }
  *state.0.lock().unwrap() = Some(root);
  Ok(())
}

// Rejects `..` traversal and anything outside the configured vault root. Works on the
// lexical path (not canonicalize) so not-yet-existing files can still be validated.
fn scoped(state: &State<VaultRoot>, path: &str) -> Result<PathBuf, String> {
  let root = state
    .0
    .lock()
    .unwrap()
    .clone()
    .ok_or_else(|| "no vault root set".to_string())?;
  let p = Path::new(path);
  if p.components().any(|c| matches!(c, Component::ParentDir)) {
    return Err("path escapes vault root".into());
  }
  if !p.starts_with(&root) {
    return Err("path outside vault root".into());
  }
  Ok(p.to_path_buf())
}

#[tauri::command]
fn read_vault_tree(root: String, state: State<VaultRoot>) -> Result<Vec<FsEntry>, String> {
  let dir = scoped(&state, &root)?;
  let mut out = Vec::new();
  walk(&dir, &mut out).map_err(|e| e.to_string())?;
  Ok(out)
}

fn walk(dir: &Path, out: &mut Vec<FsEntry>) -> std::io::Result<()> {
  if !dir.is_dir() {
    return Ok(());
  }
  for entry in fs::read_dir(dir)? {
    let entry = entry?;
    let path = entry.path();
    let name = entry.file_name().to_string_lossy().to_string();
    if name.starts_with('.') {
      continue;
    }
    let is_dir = path.is_dir();
    out.push(FsEntry { path: path.to_string_lossy().to_string(), name, is_dir });
    if is_dir {
      walk(&path, out)?;
    }
  }
  Ok(())
}

#[tauri::command]
fn read_file(path: String, state: State<VaultRoot>) -> Result<String, String> {
  let p = scoped(&state, &path)?;
  fs::read_to_string(p).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file(path: String, contents: String, state: State<VaultRoot>) -> Result<(), String> {
  let p = scoped(&state, &path)?;
  if let Some(parent) = p.parent() {
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  fs::write(p, contents).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_file(path: String, contents: String, state: State<VaultRoot>) -> Result<(), String> {
  let p = scoped(&state, &path)?;
  // Never truncate an existing file: callers create optimistically (daily note, "New
  // note") and a file that already exists on disk holds real content the in-memory
  // state may not have seen yet.
  if p.exists() {
    return Err("file already exists".into());
  }
  if let Some(parent) = p.parent() {
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  fs::write(p, contents).map_err(|e| e.to_string())
}

#[tauri::command]
fn copy_file(src: String, dest: String, state: State<VaultRoot>) -> Result<(), String> {
  let s = scoped(&state, &src)?;
  let d = scoped(&state, &dest)?;
  if d.exists() {
    return Err("destination already exists".into());
  }
  if let Some(parent) = d.parent() {
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  fs::copy(s, d).map(|_| ()).map_err(|e| e.to_string())
}

#[tauri::command]
fn move_file(src: String, dest: String, state: State<VaultRoot>) -> Result<(), String> {
  let s = scoped(&state, &src)?;
  let d = scoped(&state, &dest)?;
  if d.exists() {
    return Err("destination already exists".into());
  }
  if let Some(parent) = d.parent() {
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  fs::rename(s, d).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_file(path: String, state: State<VaultRoot>) -> Result<(), String> {
  let p = scoped(&state, &path)?;
  fs::remove_file(p).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(VaultRoot::default())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_opener::init())
    // Registration of the actual accelerator (dailyGlobalShortcut) happens from the
    // frontend via @tauri-apps/plugin-global-shortcut, which lets it be reconfigured at
    // runtime from Settings without a rebuild — this just wires the plugin in.
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      set_vault_root,
      read_vault_tree,
      read_file,
      write_file,
      create_file,
      copy_file,
      move_file,
      delete_file
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
