import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, MouseEvent, SyntheticEvent } from 'react';
import katex from 'katex';
import mermaid from 'mermaid';
import {
  badgeColors, backlinkMap, files as filesSeed, slashDefs, typeLabels,
} from '../seedData';
import { loadPersistedState, savePersistedState, type PersistedState } from '../lib/persist';
import {
  diffLines, htmlToMd, mdToHtml, outlineHtml, outlineMd, parseFront, slug, wordCount,
} from '../lib/markdown';
import { agoLabel, dailyTitle, download, escapeRegExp, nowStamp, openInBrowser } from '../lib/utils';
import {
  copyFile as tauriCopyFile, createFile as tauriCreateFile, isTauri,
  moveFile as tauriMoveFile, pickVaultRoot as tauriPickVaultRoot, readVaultTree, writeFile,
} from '../lib/tauriFs';
import type { EmlData, FileType, HtmlWidth, NoteFile, ViewMode } from '../types';

interface Suggest { kind: 'wiki' | 'slash'; q: string; caret: number; }

interface EphemeralState {
  paletteOpen: boolean;
  paletteQuery: string;
  paletteIdx: number;
  settingsOpen: boolean;
  findOpen: boolean;
  findQuery: string;
  replaceQuery: string;
  findRegex: boolean;
  historyOpen: boolean;
  historyPick: number;
  graphOpen: boolean;
  captureOpen: boolean;
  captureText: string;
  shortcutsOpen: boolean;
  exportOpen: boolean;
  suggest: Suggest | null;
}

function ephemeralDefaults(): EphemeralState {
  return {
    paletteOpen: false, paletteQuery: '', paletteIdx: 0,
    settingsOpen: false,
    findOpen: false, findQuery: '', replaceQuery: '', findRegex: false,
    historyOpen: false, historyPick: 0,
    graphOpen: false,
    captureOpen: false, captureText: '',
    shortcutsOpen: false,
    exportOpen: false,
    suggest: null,
  };
}

type FullState = PersistedState & EphemeralState;

const ACCENT = 'var(--accent)';
const ACCENT_SOFT = 'var(--accent-soft)';

let mermaidInit = false;

function withoutId(order: string[], id: string): string[] {
  return order.filter((x) => x !== id);
}

function insertRelative(order: string[], id: string, targetId: string, position: 'before' | 'after'): string[] {
  const base = withoutId(order, id);
  const idx = base.indexOf(targetId);
  if (idx === -1) return [...base, id];
  const at = position === 'before' ? idx : idx + 1;
  return [...base.slice(0, at), id, ...base.slice(at)];
}

export function useNotesApp(showRightSidebar = true) {
  const [state, setStateRaw] = useState<FullState>(() => ({ ...loadPersistedState(), ...ephemeralDefaults() }));
  const stateRef = useRef(state);
  stateRef.current = state;

  const setState = useCallback((patch: Partial<FullState> | ((s: FullState) => Partial<FullState>)) => {
    setStateRaw((prev) => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) }));
  }, []);

  // ---- persistence (debounced) ----
  const saveTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const p: PersistedState = {
        collapsed: state.collapsed, railHidden: state.railHidden, view: state.view, activeId: state.activeId,
        openTabs: state.openTabs, filter: state.filter, expandedDocs: state.expandedDocs, editedAt: state.editedAt,
        dynamicFiles: state.dynamicFiles, sources: state.sources, eml: state.eml, history: state.history,
        wiki: state.wiki, autosave: state.autosave, htmlWidth: state.htmlWidth, vaultRoot: state.vaultRoot,
        design: state.design, folderOrder: state.folderOrder, noteOrder: state.noteOrder, fileMoves: state.fileMoves,
        createdAt: state.createdAt,
      };
      savePersistedState(p);
    }, 250);
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
  }, [state]);

  useEffect(() => {
    document.documentElement.dataset.design = state.design;
  }, [state.design]);

  // ---- file helpers ----
  // Seed files are immutable imports, so folder/parent moves (drag reorder, nesting) are
  // recorded here and merged on top — this lets any note (seed or dynamic) be reorganized.
  const all = useMemo<NoteFile[]>(() => {
    const merged = [...filesSeed, ...state.dynamicFiles];
    if (!Object.keys(state.fileMoves).length) return merged;
    return merged.map((f) => (state.fileMoves[f.id] ? { ...f, ...state.fileMoves[f.id] } : f));
  }, [state.dynamicFiles, state.fileMoves]);
  const fileOfMap = useMemo(() => {
    const map = new Map<string, NoteFile>();
    all.forEach((f) => map.set(f.id, f));
    return map;
  }, [all]);
  const fileOf = useCallback((id: string | null | undefined) => (id ? fileOfMap.get(id) : undefined), [fileOfMap]);

  const fileTags = useCallback((id: string): string[] => {
    const f = fileOf(id);
    if (!f || f.type !== 'md') return [];
    return parseFront(state.sources[id] || '').tags;
  }, [fileOf, state.sources]);

  // refs
  const sourceElRef = useRef<HTMLTextAreaElement | null>(null);
  const previewElRef = useRef<HTMLDivElement | null>(null);
  const paletteInputRef = useRef<HTMLInputElement | null>(null);
  const captureInputRef = useRef<HTMLTextAreaElement | null>(null);
  const mermaidBlocksRef = useRef<Record<string, string>>({});

  const touch = useCallback((id: string) => {
    setState((s) => ({ editedAt: { ...s.editedAt, [id]: Date.now() } }));
  }, [setState]);

  const setSource = useCallback((id: string, v: string) => {
    setState((s) => ({ sources: { ...s.sources, [id]: v } }));
    touch(id);
    const f = fileOfMap.get(id);
    if (isTauri() && f?.path) writeFile(f.path, v).catch(() => {});
  }, [fileOfMap, setState, touch]);

  const setEml = useCallback((id: string, key: keyof EmlData, val: string) => {
    setState((s) => ({ eml: { ...s.eml, [id]: { ...s.eml[id], [key]: val } } }));
    touch(id);
  }, [setState, touch]);

  const open = useCallback((id: string) => {
    setState((s) => ({ activeId: id, openTabs: s.openTabs.includes(id) ? s.openTabs : [...s.openTabs, id] }));
  }, [setState]);

  const closeTab = useCallback((id: string, e?: SyntheticEvent) => {
    if (e) e.stopPropagation();
    setState((s) => {
      const tabs = s.openTabs.filter((t) => t !== id);
      let act = s.activeId;
      if (act === id) act = tabs[tabs.length - 1] || null;
      return { openTabs: tabs, activeId: act };
    });
  }, [setState]);

  const openOrCreate = useCallback((title: string) => {
    const f = all.find((x) => x.title.toLowerCase() === title.toLowerCase());
    if (f) { open(f.id); return; }
    const id = 'note-' + slug(title);
    setState((s) => ({
      dynamicFiles: [...s.dynamicFiles, { id, title, file: slug(title) + '.md', type: 'md' as FileType, folder: 'Notes', pinned: false }],
      sources: { ...s.sources, [id]: '# ' + title + '\n\n' },
      activeId: id,
      openTabs: [...s.openTabs, id],
    }));
  }, [all, open, setState]);

  const vaultPath = useCallback((folder: string, file: string) => {
    const root = stateRef.current.vaultRoot;
    return root ? root + '/' + folder + '/' + file : '';
  }, []);

  const pickVaultRoot = useCallback(async () => {
    const dir = await tauriPickVaultRoot();
    if (dir) setState({ vaultRoot: dir });
  }, [setState]);

  const newFile = useCallback((folder: string, parent?: string) => {
    const n = stateRef.current.dynamicFiles.filter((f) => f.folder === folder).length + 1;
    const title = 'Untitled ' + n;
    const id = 'note-' + slug(title) + '-' + Date.now();
    const file = slug(title) + '.md';
    const body = '# ' + title + '\n\n';
    const nf: NoteFile = { id, title, file, type: 'md', folder, pinned: false, parent };
    if (isTauri() && stateRef.current.vaultRoot) {
      nf.path = vaultPath(folder, file);
      tauriCreateFile(nf.path, body).catch(() => {});
    }
    setState((s) => ({
      dynamicFiles: [...s.dynamicFiles, nf],
      sources: { ...s.sources, [id]: body },
      activeId: id,
      openTabs: [...s.openTabs, id],
      noteOrder: [...s.noteOrder, id],
      createdAt: { ...s.createdAt, [id]: Date.now() },
    }));
  }, [setState, vaultPath]);

  const duplicateFile = useCallback((srcId: string) => {
    const src = fileOf(srcId);
    if (!src) return;
    const title = src.title + ' copy';
    const id = 'note-' + slug(title) + '-' + Date.now();
    const file = slug(title) + (src.type === 'md' ? '.md' : src.type === 'html' ? '.html' : '.eml');
    const body = stateRef.current.sources[srcId] || '';
    const nf: NoteFile = { id, title, file, type: src.type, folder: src.folder, parent: src.parent, pinned: false };
    if (isTauri() && stateRef.current.vaultRoot && src.path) {
      nf.path = vaultPath(src.folder, file);
      tauriCopyFile(src.path, nf.path).catch(() => {});
    }
    setState((s) => ({
      dynamicFiles: [...s.dynamicFiles, nf],
      sources: { ...s.sources, [id]: body },
      eml: src.type === 'eml' ? { ...s.eml, [id]: s.eml[srcId] } : s.eml,
      activeId: id,
      openTabs: [...s.openTabs, id],
      noteOrder: insertRelative(s.noteOrder, id, srcId, 'after'),
      createdAt: { ...s.createdAt, [id]: Date.now() },
    }));
  }, [fileOf, setState, vaultPath]);

  const moveFileTo = useCallback((id: string, folder: string, parent?: string) => {
    const f = fileOf(id);
    if (!f || (f.folder === folder && f.parent === parent)) return;
    let newPath: string | undefined;
    if (isTauri() && stateRef.current.vaultRoot && f.path) {
      newPath = vaultPath(folder, f.file);
      tauriMoveFile(f.path, newPath).catch(() => {});
    }
    setState((s) => ({
      fileMoves: { ...s.fileMoves, [id]: { ...s.fileMoves[id], folder, parent, ...(newPath ? { path: newPath } : {}) } },
      noteOrder: [...withoutId(s.noteOrder, id), id],
    }));
  }, [fileOf, setState, vaultPath]);

  const toggleExpand = useCallback((key: string) => {
    setState((s) => ({ expandedDocs: { ...s.expandedDocs, [key]: !s.expandedDocs[key] } }));
  }, [setState]);

  const refreshVault = useCallback(async () => {
    const root = stateRef.current.vaultRoot;
    if (!isTauri() || !root) return;
    const entries = await readVaultTree(root).catch(() => []);
    const known = new Set(stateRef.current.dynamicFiles.map((f) => f.path).filter(Boolean));
    const added: NoteFile[] = [];
    entries.filter((e) => !e.is_dir).forEach((e) => {
      if (known.has(e.path)) return;
      const rel = e.path.slice(root.length + 1);
      const folder = rel.includes('/') ? rel.split('/')[0] : 'Notes';
      const ext = e.name.split('.').pop() || 'md';
      const type: FileType = ext === 'html' ? 'html' : ext === 'eml' ? 'eml' : 'md';
      added.push({ id: 'fs-' + e.path, title: e.name.replace(/\.[^.]+$/, ''), file: e.name, type, folder, pinned: false, path: e.path });
    });
    if (added.length) {
      const now = Date.now();
      setState((s) => ({
        dynamicFiles: [...s.dynamicFiles, ...added],
        noteOrder: [...s.noteOrder, ...added.map((f) => f.id)],
        createdAt: { ...s.createdAt, ...Object.fromEntries(added.map((f) => [f.id, now])) },
      }));
    }
  }, [setState]);

  // Poll the vault folder in the background so files created externally (e.g. by an
  // automation) surface in "Recently created" without the user manually hitting refresh.
  useEffect(() => {
    if (!isTauri()) return;
    const id = window.setInterval(() => {
      if (stateRef.current.vaultRoot) refreshVault();
    }, 20000);
    return () => window.clearInterval(id);
  }, [refreshVault]);

  const toggleTask = useCallback((idx: number) => {
    const id = stateRef.current.activeId;
    if (!id) return;
    const lines = (stateRef.current.sources[id] || '').split('\n');
    if (!lines[idx]) return;
    lines[idx] = /\[x\]/i.test(lines[idx]) ? lines[idx].replace(/\[x\]/i, '[ ]') : lines[idx].replace(/\[ \]/, '[x]');
    setSource(id, lines.join('\n'));
  }, [setSource]);

  const ensureDaily = useCallback((): string => {
    const title = dailyTitle();
    const id = 'daily-' + title;
    if (!fileOf(id)) {
      setState((s) => ({
        dynamicFiles: [...s.dynamicFiles, { id, title, file: title + '.md', type: 'md' as FileType, folder: 'Daily', pinned: false }],
        sources: { ...s.sources, [id]: '---\ntags: [daily]\n---\n# ' + title + '\n\n' },
        createdAt: { ...s.createdAt, [id]: Date.now() },
      }));
    }
    return id;
  }, [fileOf, setState]);

  const openDaily = useCallback(() => {
    const id = ensureDaily();
    setTimeout(() => open(id), 0);
  }, [ensureDaily, open]);

  const openCapture = useCallback(() => setState({ captureOpen: true, captureText: '' }), [setState]);
  const closeCapture = useCallback(() => setState({ captureOpen: false }), [setState]);

  const saveCapture = useCallback(() => {
    const txt = stateRef.current.captureText.trim();
    if (!txt) { setState({ captureOpen: false }); return; }
    const id = ensureDaily();
    const t = new Date();
    const stamp = String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
    setTimeout(() => {
      setState((s) => ({
        sources: { ...s.sources, [id]: (s.sources[id] || '') + '- ' + stamp + ' ' + txt + '\n' },
        captureOpen: false,
        captureText: '',
        activeId: id,
        openTabs: s.openTabs.includes(id) ? s.openTabs : [...s.openTabs, id],
      }));
    }, 0);
  }, [ensureDaily, setState]);

  const aiGenerate = useCallback(() => {
    const id = stateRef.current.activeId;
    if (!id) return;
    setState((s) => ({
      eml: {
        ...s.eml,
        [id]: { ...s.eml[id], body: s.eml[id].body + '\n<p style="font:400 14px/1.7 -apple-system,system-ui;color:var(--text-secondary);margin:14px 0 0"><em>Generated insight: deploy frequency rose 22% week-over-week.</em></p>' },
      },
    }));
  }, [setState]);

  // ---- bodyOf / export ----
  const bodyOf = useCallback((f: NoteFile): string => (f.type === 'eml' ? (stateRef.current.eml[f.id] || {} as EmlData).body || '' : stateRef.current.sources[f.id] || ''), []);

  const currentExportHtml = useCallback((): string => {
    const a = fileOf(stateRef.current.activeId);
    if (!a) return '';
    if (a.type === 'md') {
      const fr = parseFront(stateRef.current.sources[a.id] || '');
      return mdToHtml(fr.body, stateRef.current.wiki, '', fr.offset).html;
    }
    if (a.type === 'html') return stateRef.current.sources[a.id] || '';
    const d = stateRef.current.eml[a.id] || ({} as EmlData);
    return d.body || '';
  }, [fileOf]);

  const exportPrint = useCallback(() => {
    const a = fileOf(stateRef.current.activeId);
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write('<!doctype html><meta charset="utf-8"><title>' + (a ? a.title : '') + '</title><body style="font-family:-apple-system,system-ui,sans-serif;max-width:680px;margin:40px auto;padding:0 20px;color:var(--text-primary)">' + currentExportHtml() + '</body>');
    w.document.close();
    setTimeout(() => { try { w.print(); } catch { /* ignore */ } }, 350);
  }, [currentExportHtml, fileOf]);

  const exportDownload = useCallback(() => {
    const a = fileOf(stateRef.current.activeId);
    if (!a) return;
    if (a.type === 'eml') {
      const d = stateRef.current.eml[a.id] || ({} as EmlData);
      const eml = 'From: ' + d.from + '\nTo: ' + d.to + '\nSubject: ' + d.subject + '\nContent-Type: text/html\n\n' + d.body;
      download(a.file, eml, 'message/rfc822');
    } else {
      download(a.file, stateRef.current.sources[a.id] || '', 'text/plain');
    }
  }, [fileOf]);

  const exportDoc = useCallback(() => {
    const a = fileOf(stateRef.current.activeId);
    if (!a) return;
    const html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"></head><body>' + currentExportHtml() + '</body></html>';
    download((a.title || 'document') + '.doc', html, 'application/msword');
  }, [currentExportHtml, fileOf]);

  const exportCopyHtml = useCallback(() => {
    if (navigator.clipboard) navigator.clipboard.writeText(currentExportHtml());
  }, [currentExportHtml]);

  // ---- preview click delegation (copy / task / wiki) ----
  const codeBlocksRef = useRef<Record<string, string>>({});
  const onPreviewClick = useCallback((e: MouseEvent) => {
    const target = (e.target as HTMLElement).closest('[data-copy],[data-task],[data-wiki]') as HTMLElement | null;
    if (!target) return;
    if (target.hasAttribute('data-copy')) {
      const raw = codeBlocksRef.current[target.getAttribute('data-copy')!];
      if (raw && navigator.clipboard) navigator.clipboard.writeText(raw);
      const o = target.textContent;
      target.textContent = 'Copied';
      setTimeout(() => { try { target.textContent = o; } catch { /* ignore */ } }, 1000);
      return;
    }
    if (target.hasAttribute('data-task')) { toggleTask(+target.getAttribute('data-task')!); return; }
    if (target.hasAttribute('data-wiki')) { openOrCreate(target.getAttribute('data-wiki')!); return; }
  }, [openOrCreate, toggleTask]);

  // ---- source input + suggestions ----
  const onSourceInput = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    const id = stateRef.current.activeId;
    if (!id) return;
    const v = e.target.value;
    const caret = e.target.selectionStart;
    const before = v.slice(0, caret);
    let sug: Suggest | null = null;
    const mw = /\[\[([^\]\n]*)$/.exec(before);
    const ms = /(?:^|\n)\/(\w*)$/.exec(before);
    if (mw) sug = { kind: 'wiki', q: mw[1], caret };
    else if (ms) sug = { kind: 'slash', q: ms[1], caret };
    setState((s) => ({ sources: { ...s.sources, [id]: v }, suggest: sug }));
    touch(id);
  }, [setState, touch]);

  const pickSuggest = useCallback((item: string) => {
    const id = stateRef.current.activeId;
    const sg = stateRef.current.suggest;
    if (!id || !sg) return;
    const v = stateRef.current.sources[id] || '';
    const caret = sg.caret;
    const removeLen = (sg.kind === 'wiki' ? 2 : 1) + sg.q.length;
    const start = caret - removeLen;
    const insert = sg.kind === 'wiki' ? '[[' + item + ']]' : item;
    const nv = v.slice(0, start) + insert + v.slice(caret);
    setState({ sources: { ...stateRef.current.sources, [id]: nv }, suggest: null });
    const el = sourceElRef.current;
    if (el) {
      const pos = start + insert.length;
      setTimeout(() => { try { el.focus(); el.setSelectionRange(pos, pos); } catch { /* ignore */ } }, 10);
    }
  }, [setState]);

  const selectInSource = useCallback((start: number, end: number) => {
    const el = sourceElRef.current;
    if (!el || start < 0) return;
    el.setSelectionRange(start, end);
    const lineHeight = 25;
    const line = el.value.slice(0, start).split('\n').length - 1;
    el.scrollTop = Math.max(0, line * lineHeight - el.clientHeight / 2);
  }, []);

  const selectPreviewTextInSource = useCallback((text: string) => {
    const t = text.trim();
    if (!t) return;
    const src = stateRef.current.sources[stateRef.current.activeId || ''] || '';
    const idx = src.indexOf(t);
    if (idx === -1) return;
    selectInSource(idx, idx + t.length);
  }, [selectInSource]);

  const scrollTo = useCallback((id: string) => {
    const c = previewElRef.current;
    if (c && id) {
      const el = c.querySelector('#' + CSS.escape(id));
      if (el) c.scrollTop = (el as HTMLElement).offsetTop - 18;
    }
  }, []);

  // ---- keyboard shortcuts ----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      const s = stateRef.current;
      if (meta && k === 'k') { e.preventDefault(); setState((s2) => ({ paletteOpen: !s2.paletteOpen, paletteQuery: '', paletteIdx: 0 })); }
      else if (meta && k === 'f' && s.activeId) { e.preventDefault(); setState((s2) => ({ findOpen: !s2.findOpen })); }
      else if (meta && k === 'g') { e.preventDefault(); setState((s2) => ({ graphOpen: !s2.graphOpen })); }
      else if (meta && e.shiftKey && k === 'n') { e.preventDefault(); openCapture(); }
      else if (meta && k === 'e' && s.activeId) { e.preventDefault(); setState((s2) => ({ view: s2.view === 'preview' ? 'edit' : 'preview' })); }
      else if (meta && e.key === '/') { e.preventDefault(); setState((s2) => ({ shortcutsOpen: !s2.shortcutsOpen })); }
      else if (meta && k === 'w' && s.activeId) { e.preventDefault(); closeTab(s.activeId); }
      else if (meta && /^[1-9]$/.test(e.key)) { const i = +e.key - 1; if (s.openTabs[i]) { e.preventDefault(); setState({ activeId: s.openTabs[i] }); } }
      else if (meta && e.shiftKey && e.key === '|') { e.preventDefault(); setState((s2) => ({ railHidden: !s2.railHidden })); }
      else if (meta && e.key === '\\') { e.preventDefault(); setState((s2) => ({ collapsed: !s2.collapsed })); }
      else if (e.key === 'Escape') { setState({ paletteOpen: false, settingsOpen: false, findOpen: false, historyOpen: false, graphOpen: false, captureOpen: false, shortcutsOpen: false, exportOpen: false, suggest: null }); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [closeTab, openCapture, setState]);

  // focus management
  useEffect(() => {
    if (state.paletteOpen && paletteInputRef.current) setTimeout(() => { try { paletteInputRef.current?.focus(); } catch { /* ignore */ } }, 20);
  }, [state.paletteOpen]);
  useEffect(() => {
    if (state.captureOpen && captureInputRef.current) setTimeout(() => { try { captureInputRef.current?.focus(); } catch { /* ignore */ } }, 20);
  }, [state.captureOpen]);

  // =================== derived view model ===================
  const active = fileOf(state.activeId);
  const isMd = active?.type === 'md';
  const isHtml = active?.type === 'html';
  const isEml = active?.type === 'eml';
  const showSource = !!active && (state.view === 'edit' || state.view === 'split');
  const showPreview = !!active && (state.view === 'preview' || state.view === 'split');

  let sourceValue = '';
  let outline: ReturnType<typeof outlineMd> = [];
  let words = 0;
  let activeTags: string[] = [];
  let emlData: EmlData = { from: '', to: '', subject: '', body: '' };
  let mdHtml = '';

  if (active) {
    if (isMd) {
      sourceValue = state.sources[active.id] || '';
      const fr = parseFront(sourceValue);
      words = wordCount(fr.body);
      outline = outlineMd(fr.body);
      activeTags = fr.tags;
      const rendered = mdToHtml(fr.body, state.wiki, '', fr.offset);
      mdHtml = rendered.html;
      codeBlocksRef.current = rendered.codeBlocks;
      mermaidBlocksRef.current = rendered.mermaidBlocks;
    } else if (isHtml) {
      sourceValue = state.sources[active.id] || '';
      words = wordCount(sourceValue);
      outline = outlineHtml(sourceValue);
    } else if (isEml) {
      emlData = state.eml[active.id] || { from: '', to: '', subject: '', body: '' };
      words = wordCount(emlData.body);
      outline = outlineHtml(emlData.body);
    }
  }

  // katex/mermaid hydration after markdown preview paints
  useEffect(() => {
    const root = previewElRef.current;
    if (!root || !isMd) return;
    root.querySelectorAll('[data-tex]:not([data-done])').forEach((el) => {
      el.setAttribute('data-done', '1');
      try { katex.render(el.getAttribute('data-tex') || '', el as HTMLElement, { throwOnError: false }); } catch { /* ignore */ }
    });
    if (!mermaidInit) {
      try { mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', theme: 'neutral' }); } catch { /* ignore */ }
      mermaidInit = true;
    }
    root.querySelectorAll('.mmd:not([data-done])').forEach((el, i) => {
      el.setAttribute('data-done', '1');
      const code = mermaidBlocksRef.current[el.getAttribute('data-mmd') || ''];
      if (!code) return;
      const id = 'mmdsvg' + Date.now() + i;
      try {
        mermaid.render(id, code).then((r) => { el.innerHTML = r.svg; }).catch(() => { el.setAttribute('data-done', ''); });
      } catch { /* ignore */ }
    });
  }, [isMd, mdHtml]);

  // backlinks
  const backlinks = (active && backlinkMap[active.id]) || [];

  // unlinked mentions
  const unlinked = useMemo(() => {
    const out: { id: string; title: string; snippet: string }[] = [];
    if (active) {
      const title = active.title.toLowerCase();
      all.forEach((f) => {
        if (f.id === active.id) return;
        const raw = bodyOf(f);
        if (raw.toLowerCase().includes(title) && !raw.toLowerCase().includes('[[' + title)) {
          const flat = raw.replace(/<[^>]+>/g, ' ');
          const idx = flat.toLowerCase().indexOf(title);
          const snip = flat.slice(Math.max(0, idx - 24), idx + title.length + 24).replace(/\s+/g, ' ').trim();
          out.push({ id: f.id, title: f.title, snippet: '…' + snip + '…' });
        }
      });
    }
    return out;
  }, [active, all, bodyOf, state.sources, state.eml]);

  // graph
  const graph = useMemo(() => {
    const gIndex: Record<string, string> = {};
    all.forEach((f) => { gIndex[f.title.toLowerCase()] = f.id; });
    const cx = 360, cy = 200, RAD = 150;
    const fillByType: Record<string, string> = { md: '#dfe3ea', html: '#f1e3d3', eml: '#dde7f2' };
    const posOf: Record<string, { x: number; y: number }> = {};
    all.forEach((f, i) => {
      const a = (i / all.length) * Math.PI * 2 - Math.PI / 2;
      posOf[f.id] = { x: cx + RAD * Math.cos(a), y: cy + RAD * Math.sin(a) };
    });
    const nodes = all.map((f) => {
      const p = posOf[f.id];
      const on = f.id === state.activeId;
      return {
        id: f.id, x: p.x, y: p.y, ty: p.y + 26, r: on ? 13 : 10,
        fill: on ? 'oklch(0.86 0.07 var(--accent-hue))' : fillByType[f.type],
        stroke: on ? 'oklch(0.5 0.12 var(--accent-hue))' : 'rgba(0,0,0,.14)',
        label: f.title.length > 16 ? f.title.slice(0, 15) + '…' : f.title,
      };
    });
    const edges: { x1: number; y1: number; x2: number; y2: number }[] = [];
    all.forEach((f) => {
      const raw = bodyOf(f);
      const re = /\[\[([^\]]+)\]\]/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(raw))) {
        const tid = gIndex[m[1].toLowerCase()];
        if (tid && posOf[tid] && posOf[f.id] && tid !== f.id) edges.push({ x1: posOf[f.id].x, y1: posOf[f.id].y, x2: posOf[tid].x, y2: posOf[tid].y });
      }
    });
    return { nodes, edges };
  }, [all, bodyOf, state.activeId, state.sources, state.eml]);

  // command palette results
  const paletteResults = useMemo(() => {
    const q = state.paletteQuery.trim().toLowerCase();
    const titleHits = all.filter((f) => !q || f.title.toLowerCase().includes(q) || f.file.toLowerCase().includes(q));
    const fileResults = titleHits.map((f) => ({
      kind: 'file' as const, id: f.id, title: f.title, hint: f.folder, icon: f.type.toUpperCase(),
    }));
    const textResults: { kind: 'text'; id: string; title: string; hint: string; icon: string }[] = [];
    if (q) {
      const titleIds = new Set(titleHits.map((f) => f.id));
      all.forEach((f) => {
        if (titleIds.has(f.id)) return;
        const body = bodyOf(f).replace(/<[^>]+>/g, ' ');
        const idx = body.toLowerCase().indexOf(q);
        if (idx < 0) return;
        const snip = body.slice(Math.max(0, idx - 22), idx + 32).replace(/\s+/g, ' ').trim();
        textResults.push({ kind: 'text', id: f.id, title: f.title, hint: '…' + snip + '…', icon: '⌕' });
      });
    }
    const cmds = [
      { title: 'New Markdown Note', run: 'newNote' },
      { title: "Open Today's Daily Note", run: 'openDaily' },
      { title: 'Quick Capture', run: 'capture' },
      { title: 'Graph View', run: 'graph' },
      { title: 'Toggle Sidebar', run: 'sidebar' },
      { title: 'Find & Replace', run: 'find' },
      { title: 'Version History', run: 'history' },
      { title: 'Keyboard Shortcuts', run: 'shortcuts' },
      { title: 'New Window', run: 'window' },
      { title: 'Open Settings', run: 'settings' },
    ].filter((c) => !q || c.title.toLowerCase().includes(q))
      .map((c) => ({ kind: 'cmd' as const, id: c.run, title: c.title, hint: 'command', icon: '⌘' }));
    return [...fileResults, ...textResults, ...cmds];
  }, [all, bodyOf, state.paletteQuery, state.sources, state.eml]);

  const runPaletteResult = useCallback((r: { kind: string; id: string }) => {
    if (r.kind === 'file' || r.kind === 'text') { setState({ paletteOpen: false }); open(r.id); return; }
    setState({ paletteOpen: false });
    switch (r.id) {
      case 'newNote': openOrCreate('Untitled ' + (stateRef.current.dynamicFiles.length + 1)); break;
      case 'openDaily': openDaily(); break;
      case 'capture': openCapture(); break;
      case 'graph': setState({ graphOpen: true }); break;
      case 'sidebar': setState((s) => ({ collapsed: !s.collapsed })); break;
      case 'find': setState({ findOpen: true }); break;
      case 'history': setState({ historyOpen: true, historyPick: 0 }); break;
      case 'shortcuts': setState({ shortcutsOpen: true }); break;
      case 'window': try { window.open(location.href, '_blank'); } catch { /* ignore */ } break;
      case 'settings': setState({ settingsOpen: true }); break;
    }
  }, [open, openCapture, openDaily, openOrCreate, setState]);

  // find & replace
  let findCount = '';
  if (state.findQuery && active && (isMd || isHtml)) {
    try {
      const re = state.findRegex ? new RegExp(state.findQuery, 'g') : new RegExp(escapeRegExp(state.findQuery), 'g');
      const m = (state.sources[active.id] || '').match(re);
      findCount = (m ? m.length : 0) + ' found';
    } catch { findCount = 'bad regex'; }
  }
  const replaceAllFn = useCallback(() => {
    const a = fileOf(stateRef.current.activeId);
    if (!a || !stateRef.current.findQuery) return;
    try {
      const re = stateRef.current.findRegex ? new RegExp(stateRef.current.findQuery, 'g') : new RegExp(escapeRegExp(stateRef.current.findQuery), 'g');
      setSource(a.id, (stateRef.current.sources[a.id] || '').replace(re, stateRef.current.replaceQuery));
    } catch { /* ignore */ }
  }, [fileOf, setSource]);
  const findNextFn = useCallback(() => {
    const el = sourceElRef.current;
    if (!el || !stateRef.current.findQuery) return;
    const txt = el.value;
    const from = el.selectionEnd || 0;
    let idx = txt.indexOf(stateRef.current.findQuery, from);
    if (idx === -1) idx = txt.indexOf(stateRef.current.findQuery, 0);
    if (idx >= 0) { el.focus(); el.setSelectionRange(idx, idx + stateRef.current.findQuery.length); }
  }, []);

  // suggestions
  let suggestItems: { label: string; hint: string; icon: string; isCreate?: boolean }[] = [];
  let suggestTitle = '';
  if (state.suggest) {
    const sq = state.suggest.q.toLowerCase();
    if (state.suggest.kind === 'wiki') {
      suggestTitle = 'LINK TO NOTE';
      suggestItems = all.filter((f) => f.title.toLowerCase().includes(sq)).slice(0, 5).map((f) => ({ label: f.title, hint: f.type, icon: '🔗' }));
      if (sq && !all.some((f) => f.title.toLowerCase() === sq)) suggestItems.push({ label: 'Create "' + state.suggest!.q + '"', hint: 'new', icon: '＋', isCreate: true });
    } else {
      suggestTitle = 'INSERT BLOCK';
      suggestItems = slashDefs.filter((d) => d.label.toLowerCase().includes(sq)).map((d) => ({ label: d.ins, hint: d.hint, icon: '▦' }));
    }
  }

  // history
  const canHistory = !!active && (isMd || isHtml);
  const hid = active ? active.id : null;
  const hist = (hid && state.history[hid]) || [];
  const curText = canHistory && hid ? (state.sources[hid] || '') : '';
  const snap = state.historyPick >= 0 ? hist[state.historyPick] : null;
  const diffRows = snap ? diffLines(snap.text.split('\n'), curText.split('\n')) : [];
  const saveSnapshot = useCallback(() => {
    if (!hid) return;
    setState((s) => ({ history: { ...s.history, [hid]: [{ ts: nowStamp(), text: s.sources[hid] || '' }, ...((s.history[hid]) || [])] } }));
  }, [hid, setState]);
  const restore = useCallback(() => {
    if (snap && hid) { setSource(hid, snap.text); setState({ historyOpen: false }); }
  }, [hid, setSource, setState, snap]);

  // recently edited / created
  const recentDocs = useMemo(() => all
    .filter((f) => state.editedAt[f.id])
    .sort((a, b) => state.editedAt[b.id] - state.editedAt[a.id])
    .slice(0, 10), [all, state.editedAt]);

  const recentlyCreated = useMemo(() => all
    .filter((f) => state.createdAt[f.id])
    .sort((a, b) => state.createdAt[b.id] - state.createdAt[a.id])
    .slice(0, 10), [all, state.createdAt]);

  // tags
  const tagCount = useMemo(() => {
    const m: Record<string, number> = {};
    all.forEach((f) => fileTags(f.id).forEach((t) => { m[t] = (m[t] || 0) + 1; }));
    return m;
  }, [all, fileTags, state.sources]);

  // folders + note ordering
  const orderIndex = useMemo(() => {
    const m = new Map<string, number>();
    state.noteOrder.forEach((id, i) => m.set(id, i));
    return m;
  }, [state.noteOrder]);
  const orderIdx = useCallback((id: string) => orderIndex.get(id) ?? Number.MAX_SAFE_INTEGER, [orderIndex]);

  const childrenOf = useCallback(
    (pid: string) => all.filter((f) => f.parent === pid).sort((a, b) => orderIdx(a.id) - orderIdx(b.id)),
    [all, orderIdx],
  );

  const depthOf = useCallback((id: string): number => {
    let depth = 0;
    let cur = fileOf(id);
    while (cur?.parent && depth < 50) {
      depth += 1;
      cur = fileOf(cur.parent);
    }
    return depth;
  }, [fileOf]);

  const subtreeDepth = useCallback((id: string): number => {
    const kids = childrenOf(id);
    if (!kids.length) return 0;
    return 1 + Math.max(...kids.map((k) => subtreeDepth(k.id)));
  }, [childrenOf]);

  const isDescendantOf = useCallback((ancestorId: string, id: string): boolean => {
    let cur = fileOf(id);
    let hops = 0;
    while (cur?.parent && hops < 50) {
      if (cur.parent === ancestorId) return true;
      cur = fileOf(cur.parent);
      hops += 1;
    }
    return false;
  }, [fileOf]);

  const reorderNote = useCallback((draggedId: string, targetId: string, position: 'before' | 'after' | 'inside') => {
    if (draggedId === targetId) return;
    const target = fileOf(targetId);
    if (!fileOf(draggedId) || !target) return;
    if (isDescendantOf(draggedId, targetId)) return;

    if (position === 'inside') {
      if (depthOf(targetId) + 1 + subtreeDepth(draggedId) > 3) return;
      setState((s) => ({
        fileMoves: { ...s.fileMoves, [draggedId]: { ...s.fileMoves[draggedId], folder: target.folder, parent: targetId } },
        noteOrder: [...withoutId(s.noteOrder, draggedId), draggedId],
      }));
      return;
    }

    setState((s) => ({
      fileMoves: { ...s.fileMoves, [draggedId]: { ...s.fileMoves[draggedId], folder: target.folder, parent: target.parent } },
      noteOrder: insertRelative(s.noteOrder, draggedId, targetId, position),
    }));
  }, [depthOf, fileOf, isDescendantOf, setState, subtreeDepth]);

  const reorderFolder = useCallback((draggedName: string, targetName: string, position: 'before' | 'after') => {
    if (draggedName === targetName) return;
    setState((s) => ({ folderOrder: insertRelative(s.folderOrder, draggedName, targetName, position) }));
  }, [setState]);

  const renameFile = useCallback((id: string, newTitle: string) => {
    const f = fileOf(id);
    const title = newTitle.trim();
    if (!f || !title || title === f.title) return;
    const ext = f.type === 'md' ? '.md' : f.type === 'html' ? '.html' : '.eml';
    const file = slug(title) + ext;
    let newPath: string | undefined;
    if (isTauri() && stateRef.current.vaultRoot && f.path) {
      newPath = vaultPath(f.folder, file);
      tauriMoveFile(f.path, newPath).catch(() => {});
    }
    setState((s) => ({
      fileMoves: { ...s.fileMoves, [id]: { ...s.fileMoves[id], title, file, ...(newPath ? { path: newPath } : {}) } },
    }));
  }, [fileOf, setState, vaultPath]);

  const collapseAllFolders = useCallback(() => {
    setState((s) => ({
      expandedDocs: {
        ...s.expandedDocs,
        ...Object.fromEntries(s.folderOrder.map((name) => ['folder:' + name, false])),
      },
    }));
  }, [setState]);

  const createFolder = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setState((s) => (s.folderOrder.includes(trimmed) ? {} : { folderOrder: [...s.folderOrder, trimmed] }));
  }, [setState]);

  const pred = useCallback((f: NoteFile): boolean => {
    const k = state.filter;
    if (k === 'all') return true;
    if (k === 'pinned') return f.pinned;
    if (k === 'markdown') return f.type === 'md';
    if (k === 'html') return f.type === 'html';
    if (k === 'email') return f.type === 'eml';
    if (k.startsWith('tag:')) return fileTags(f.id).includes(k.slice(4));
    return true;
  }, [fileTags, state.filter]);

  const folders = useMemo(() => state.folderOrder.map((name) => ({
    name,
    roots: all.filter((f) => f.folder === name && !f.parent && pred(f)).sort((a, b) => orderIdx(a.id) - orderIdx(b.id)),
  })).filter((g) => g.roots.length || state.filter === 'all'), [all, pred, state.folderOrder, orderIdx, state.filter]);

  // breadcrumb
  const pathSegments = useMemo(() => {
    if (!active) return [];
    const ancestors: NoteFile[] = [];
    let p = active.parent;
    while (p) { const pf = fileOf(p); if (!pf) break; ancestors.unshift(pf); p = pf.parent; }
    const firstInFolder = all.find((f) => f.folder === active.folder && !f.parent);
    const segs: { label: string; title: string; id?: string; current: boolean }[] = [];
    segs.push({ label: active.folder, title: 'Folder · ' + active.folder, id: firstInFolder?.id, current: false });
    ancestors.forEach((a) => segs.push({ label: a.title, title: a.file, id: a.id, current: false }));
    segs.push({ label: active.file, title: active.file, current: true });
    return segs;
  }, [active, all, fileOf]);

  return {
    state, setState, stateRef,
    all, fileOf, fileTags, allFiles: all,
    badgeColors, typeLabels,
    active, isMd, isHtml, isEml, showSource, showPreview,
    sourceValue, mdHtml, outline, words, activeTags, emlData,
    backlinks, backlinkCount: backlinks.length, unlinked, graph, paletteResults, runPaletteResult,
    findCount, replaceAllFn, findNextFn,
    suggestItems, suggestTitle, pickSuggest,
    canHistory, historyList: hist, snap, diffRows, saveSnapshot, restore,
    recentDocs, recentlyCreated, tagCount, folders, pathSegments,
    accent: ACCENT, accentSoft: ACCENT_SOFT,
    showRightSidebar,
    // refs
    sourceElRef, previewElRef, paletteInputRef, captureInputRef,
    // actions
    open, closeTab, touch, setSource, setEml, aiGenerate, toggleTask, openOrCreate,
    openCapture, closeCapture, saveCapture, ensureDaily, openDaily,
    currentExportHtml, exportPrint, exportDownload, exportDoc, exportCopyHtml,
    onPreviewClick, onSourceInput, scrollTo, selectInSource, selectPreviewTextInSource,
    openInBrowser,
    agoLabel,
    childrenOf, newFile, duplicateFile, moveFileTo, toggleExpand, pickVaultRoot, refreshVault,
    reorderNote, reorderFolder, depthOf, renameFile, collapseAllFolders, createFolder,
    allFolderNames: state.folderOrder,
    isTauri: isTauri(),
    htmlToMd,
  };
}

export type NotesAppVM = ReturnType<typeof useNotesApp>;
export type { ViewMode, HtmlWidth };
