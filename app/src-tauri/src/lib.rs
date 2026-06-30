use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Serialize)]
pub struct FsEntry {
  path: String,
  name: String,
  is_dir: bool,
}

#[tauri::command]
fn read_vault_tree(root: String) -> Result<Vec<FsEntry>, String> {
  let mut out = Vec::new();
  walk(Path::new(&root), &mut out).map_err(|e| e.to_string())?;
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
fn read_file(path: String) -> Result<String, String> {
  fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file(path: String, contents: String) -> Result<(), String> {
  if let Some(parent) = Path::new(&path).parent() {
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  fs::write(path, contents).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_file(path: String, contents: String) -> Result<(), String> {
  write_file(path, contents)
}

#[tauri::command]
fn copy_file(src: String, dest: String) -> Result<(), String> {
  if let Some(parent) = Path::new(&dest).parent() {
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  fs::copy(src, dest).map(|_| ()).map_err(|e| e.to_string())
}

#[tauri::command]
fn move_file(src: String, dest: String) -> Result<(), String> {
  if let Some(parent) = Path::new(&dest).parent() {
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  fs::rename(src, dest).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
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
      read_vault_tree,
      read_file,
      write_file,
      create_file,
      copy_file,
      move_file
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
