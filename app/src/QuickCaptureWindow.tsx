import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { todayISO } from './lib/tasks';
import { appendUnderSection, renderDailyTemplate, routeDailyCapture } from './lib/utils';

const STORAGE_KEY = 'notes-app:v1';

// Deliberately reads localStorage directly rather than importing lib/persist's
// loadPersistedState — this window never mounts the full app hook, so it only needs three
// fields (vaultRoot/dailyFolder/dailyTemplate), not the whole PersistedState shape/defaults.
function readDailyConfig(): { vaultRoot: string | null; dailyFolder: string; dailyTemplate: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      vaultRoot: typeof parsed.vaultRoot === 'string' ? parsed.vaultRoot : null,
      dailyFolder: typeof parsed.dailyFolder === 'string' && parsed.dailyFolder ? parsed.dailyFolder : 'Daily',
      dailyTemplate: typeof parsed.dailyTemplate === 'string' ? parsed.dailyTemplate : '',
    };
  } catch {
    return { vaultRoot: null, dailyFolder: 'Daily', dailyTemplate: '' };
  }
}

// The floating popup opened by the OS-level global shortcut (feature 9). Intentionally
// minimal: no backdate picker, no mood row, today's date only — this is meant to be an
// instant, disposable capture box, not a second copy of the full-featured modal. Talks to
// disk via the same read_file/write_file/create_file Tauri commands the main window uses;
// the main window picks up the change on its next periodic refreshVault() poll.
export default function QuickCaptureWindow() {
  const [text, setText] = useState('');
  const [config] = useState(readDailyConfig);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const hide = async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().hide();
    } catch {
      /* ignore — e.g. running outside Tauri during development */
    }
  };

  const save = async () => {
    const body = text.trim();
    if (!body || !config.vaultRoot) { await hide(); return; }
    const { invoke } = await import('@tauri-apps/api/core');
    const path = config.vaultRoot + '/' + config.dailyFolder + '/' + todayISO() + '.md';
    let existing: string | null = null;
    try {
      existing = await invoke<string>('read_file', { path });
    } catch {
      existing = null;
    }
    const base = existing ?? renderDailyTemplate(config.dailyTemplate, todayISO());
    const { heading, line } = routeDailyCapture(body);
    const updated = appendUnderSection(base, heading, line);
    try {
      if (existing !== null) await invoke('write_file', { path, contents: updated });
      else await invoke('create_file', { path, contents: updated });
    } catch {
      /* ignore — nothing else to fall back to from this minimal window */
    }
    setText('');
    await hide();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void save(); }
    else if (e.key === 'Escape') { e.preventDefault(); void hide(); }
  };

  if (!config.vaultRoot) {
    return (
      <div style={{ padding: 16, font: '13px -apple-system,system-ui', color: 'var(--text-secondary)' }}>
        Pick a vault folder in the main Notes window first.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: 12, gap: 8, background: 'var(--bg-surface)' }}>
      <textarea
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Quick capture to today's Daily Note…"
        style={{ flex: 1, resize: 'none', border: '1px solid var(--border)', borderRadius: 8, outline: 'none', padding: '9px 11px', font: '14px -apple-system,system-ui', color: 'var(--text-primary)', background: 'var(--bg-surface)' }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <span onClick={() => void hide()} style={{ font: '500 12.5px -apple-system,system-ui', color: 'var(--text-muted)', padding: '6px 12px', borderRadius: 8, cursor: 'pointer' }}>Cancel</span>
        <span onClick={() => void save()} style={{ font: '500 12.5px -apple-system,system-ui', color: '#fff', background: 'oklch(0.5 0.12 var(--accent-hue))', padding: '6px 14px', borderRadius: 8, cursor: 'pointer' }}>Add ↵</span>
      </div>
    </div>
  );
}
