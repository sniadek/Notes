import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, MouseEvent, SyntheticEvent } from 'react';
import katex from 'katex';
import mermaid from 'mermaid';
import {
  badgeColors, backlinkMap, files as filesSeed, slashDefs, typeLabels,
} from '../seedData';
import { loadPersistedState, savePersistedState, type PersistedState } from '../lib/persist';
import {
  diffLines, htmlToMd, mdToHtml, outlineHtml, outlineMd, parseEml, parseFront, slug, wordCount,
} from '../lib/markdown';
import { agoLabel, dailyTitle, download, escapeRegExp, nowStamp, openInBrowser } from '../lib/utils';
import {
  copyFile as tauriCopyFile, createFile as tauriCreateFile, deleteFile as tauriDeleteFile, isTauri,
  moveFile as tauriMoveFile, pickVaultRoot as tauriPickVaultRoot, readFile, readVaultTree,
  revealInFinder, writeFile,
} from '../lib/tauriFs';
import {
  TASK_MANAGER_ID, buildTaskLine, isOverdue, isToday, scanTasks,
} from '../lib/tasks';
import type { CustomFilter, EmlData, FileType, FilterRule, HtmlWidth, NoteFile, TaskPriority, ViewMode } from '../types';

interface Suggest { kind: 'wiki' | 'slash'; q: string; caret: number; }

export interface FolderNode {
  path: string;
  name: string;
  roots: NoteFile[];
  children: FolderNode[];
}

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
  addTaskOpen: boolean;
  addTaskText: string;
  addTaskDue: string;
  addTaskPriority: TaskPriority | '';
  addTaskTargetId: string | null;
  shortcutsOpen: boolean;
  exportOpen: boolean;
  suggest: Suggest | null;
  smartFilterModalOpen: boolean;
  editingFilterId: string | null;
  lastSyncedAt: number | null;
}

function ephemeralDefaults(): EphemeralState {
  return {
    paletteOpen: false, paletteQuery: '', paletteIdx: 0,
    settingsOpen: false,
    findOpen: false, findQuery: '', replaceQuery: '', findRegex: false,
    historyOpen: false, historyPick: 0,
    graphOpen: false,
    addTaskOpen: false, addTaskText: '', addTaskDue: '', addTaskPriority: '', addTaskTargetId: null,
    shortcutsOpen: false,
    exportOpen: false,
    suggest: null,
    smartFilterModalOpen: false,
    editingFilterId: null,
    lastSyncedAt: null,
  };
}

type FullState = PersistedState & EphemeralState;

const ACCENT = 'var(--accent)';
const ACCENT_SOFT = 'var(--accent-soft)';
export const VAULT_POLL_MS = 20000;

let mermaidInit = false;

function withoutId(order: string[], id: string): string[] {
  return order.filter((x) => x !== id);
}

// Used when reconciling two dynamicFiles entries that turned out to represent the same
// on-disk file (see refreshVault): folds any lines unique to the entry being dropped into
// the surviving one, instead of silently discarding whichever entry loses the merge.
function mergeNoteContent(winner: string, loser: string): string {
  const seen = new Set(winner.split('\n').map((l) => l.trim()).filter(Boolean));
  const extra = loser.split('\n').filter((l) => l.trim() && !seen.has(l.trim()));
  if (!extra.length) return winner;
  const sep = winner && !winner.endsWith('\n') ? '\n' : '';
  return winner + sep + extra.join('\n') + '\n';
}

function insertRelative(order: string[], id: string, targetId: string, position: 'before' | 'after'): string[] {
  const base = withoutId(order, id);
  const idx = base.indexOf(targetId);
  if (idx === -1) return [...base, id];
  const at = position === 'before' ? idx : idx + 1;
  return [...base.slice(0, at), id, ...base.slice(at)];
}

// Folders are identified by '/'-joined path strings ("Engineering", "Engineering/A1"),
// so nesting falls out of the string itself — no separate parent-id bookkeeping needed.
const MAX_FOLDER_DEPTH = 3;

function folderParentPath(path: string): string | undefined {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? undefined : path.slice(0, idx);
}

function folderLeafName(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? path : path.slice(idx + 1);
}

function folderPathDepth(path: string): number {
  return path.split('/').length - 1;
}

interface DerivedDoc {
  isMd: boolean;
  isHtml: boolean;
  isEml: boolean;
  sourceValue: string;
  outline: ReturnType<typeof outlineMd>;
  words: number;
  activeTags: string[];
  emlData: EmlData;
  mdHtml: string;
  codeBlocks: Record<string, string>;
  mermaidBlocks: Record<string, string>;
}

// Pure computation shared by the primary and secondary (split) panes — given a
// file plus the raw source/eml maps, builds everything a pane needs to render.
// idPrefix keeps generated code-block/mermaid-block ids from colliding when both
// panes render markdown at once.
function deriveDoc(file: NoteFile | undefined, sources: Record<string, string>, eml: Record<string, EmlData>, wiki: boolean, idPrefix: string): DerivedDoc {
  const isMd = file?.type === 'md';
  const isHtml = file?.type === 'html';
  const isEml = file?.type === 'eml';
  let sourceValue = '';
  let outline: ReturnType<typeof outlineMd> = [];
  let words = 0;
  let activeTags: string[] = [];
  let emlData: EmlData = { from: '', to: '', subject: '', body: '' };
  let mdHtml = '';
  let codeBlocks: Record<string, string> = {};
  let mermaidBlocks: Record<string, string> = {};

  if (file) {
    if (isMd) {
      sourceValue = sources[file.id] || '';
      const fr = parseFront(sourceValue);
      words = wordCount(fr.body);
      outline = outlineMd(fr.body);
      activeTags = fr.tags;
      const rendered = mdToHtml(fr.body, wiki, idPrefix, fr.offset);
      mdHtml = rendered.html;
      codeBlocks = rendered.codeBlocks;
      mermaidBlocks = rendered.mermaidBlocks;
    } else if (isHtml) {
      sourceValue = sources[file.id] || '';
      words = wordCount(sourceValue);
      outline = outlineHtml(sourceValue);
    } else if (isEml) {
      emlData = eml[file.id] || { from: '', to: '', subject: '', body: '' };
      words = wordCount(emlData.body);
      outline = outlineHtml(emlData.body);
    }
  }

  return { isMd, isHtml, isEml, sourceValue, outline, words, activeTags, emlData, mdHtml, codeBlocks, mermaidBlocks };
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
        secondaryId: state.secondaryId, secondaryView: state.secondaryView,
        openTabs: state.openTabs, filter: state.filter, expandedDocs: state.expandedDocs, editedAt: state.editedAt,
        dynamicFiles: state.dynamicFiles, sources: state.sources, eml: state.eml, history: state.history,
        wiki: state.wiki, autosave: state.autosave, htmlWidth: state.htmlWidth,
        docWidth: state.docWidth, docFontSize: state.docFontSize, vaultRoot: state.vaultRoot,
        design: state.design, folderOrder: state.folderOrder, noteOrder: state.noteOrder, fileMoves: state.fileMoves,
        createdAt: state.createdAt, customFilters: state.customFilters, pinnedFolders: state.pinnedFolders,
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
    // Once a real vault is connected, the sidebar mirrors that folder only — the
    // built-in demo notes are a no-vault/first-run convenience, not permanent content.
    const merged = state.vaultRoot ? [...state.dynamicFiles] : [...filesSeed, ...state.dynamicFiles];
    if (!Object.keys(state.fileMoves).length) return merged;
    return merged.map((f) => (state.fileMoves[f.id] ? { ...f, ...state.fileMoves[f.id] } : f));
  }, [state.dynamicFiles, state.fileMoves, state.vaultRoot]);
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
  const addTaskInputRef = useRef<HTMLInputElement | null>(null);
  const mermaidBlocksRef = useRef<Record<string, string>>({});
  // secondary (split) pane refs — mirror the primary pane's refs above
  const sourceElRef2 = useRef<HTMLTextAreaElement | null>(null);
  const previewElRef2 = useRef<HTMLDivElement | null>(null);
  const mermaidBlocksRef2 = useRef<Record<string, string>>({});

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

  const openSplit = useCallback((id: string) => {
    setState((s) => ({
      secondaryId: id,
      // Land the split doc right next to the primary tab, so the pair shows up
      // adjacent in the tab bar instead of the secondary doc having no tab at all.
      openTabs: s.openTabs.includes(id)
        ? s.openTabs
        : (s.activeId ? insertRelative(s.openTabs, id, s.activeId, 'after') : [...s.openTabs, id]),
    }));
  }, [setState]);

  const closeSplitPane = useCallback(() => {
    setState({ secondaryId: null });
  }, [setState]);

  const vaultPath = useCallback((folder: string, file: string) => {
    const root = stateRef.current.vaultRoot;
    return root ? root + '/' + folder + '/' + file : '';
  }, []);

  const openOrCreate = useCallback((title: string) => {
    const f = all.find((x) => x.title.toLowerCase() === title.toLowerCase());
    if (f) { open(f.id); return; }
    const id = 'note-' + slug(title);
    const file = slug(title) + '.md';
    // Two differently-punctuated titles (e.g. "Note!" and "Note?") can slug to the same
    // filename even though the title check above didn't match — without this, creating the
    // second one would silently overwrite the first's file on disk via tauriCreateFile below,
    // since both compute the identical vaultPath. Match by the actual resulting identity too.
    const existingByFile = all.find((x) => x.folder === 'Notes' && x.file === file);
    if (existingByFile) { open(existingByFile.id); return; }
    const body = '# ' + title + '\n\n';
    const nf: NoteFile = { id, title, file, type: 'md', folder: 'Notes', pinned: false };
    if (isTauri() && stateRef.current.vaultRoot) {
      nf.path = vaultPath('Notes', file);
      tauriCreateFile(nf.path, body).catch(() => {});
    }
    setState((s) => ({
      dynamicFiles: [...s.dynamicFiles, nf],
      sources: { ...s.sources, [id]: body },
      activeId: id,
      openTabs: [...s.openTabs, id],
    }));
  }, [all, open, setState, vaultPath]);

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

    const moves = stateRef.current.fileMoves;
    const effective = (f: NoteFile): NoteFile => (moves[f.id] ? { ...f, ...moves[f.id] } : f);
    const current = stateRef.current.dynamicFiles.map(effective);

    // Reconcile entries that already ended up representing the same underlying file —
    // e.g. a note created before its path was known (so it never synced to disk), plus
    // a separate `fs-` entry the vault scan created once it discovered that same file.
    // The disk-backed entry wins the id, but any lines unique to the other are folded
    // in first (mergeNoteContent), so a stray duplicate can never silently lose content.
    const byIdentity = new Map<string, NoteFile[]>();
    current.forEach((f) => {
      const key = f.folder + '/' + f.file;
      if (!byIdentity.has(key)) byIdentity.set(key, []);
      byIdentity.get(key)!.push(f);
    });
    const dropIds = new Set<string>();
    const remap = new Map<string, string>();
    // Loser text to fold into each winner, deferred until after the disk-read step below —
    // the winner's own on-disk content may not have been read into `sources` yet (it can be
    // "stale" in the same sense as the self-healing check further down), so folding losers in
    // right now would merge against an empty/incomplete base and then clobber the real content.
    const mergeGroups = new Map<string, string[]>();
    byIdentity.forEach((group) => {
      if (group.length < 2) return;
      const winner = group.find((f) => f.path) ?? group[0];
      group.forEach((loser) => {
        if (loser.id === winner.id) return;
        dropIds.add(loser.id);
        remap.set(loser.id, winner.id);
        if (winner.type === 'md' && stateRef.current.sources[loser.id]) {
          const losers = mergeGroups.get(winner.id) ?? [];
          losers.push(loser.id);
          mergeGroups.set(winner.id, losers);
        }
      });
    });

    const known = new Set(current.filter((f) => !dropIds.has(f.id)).map((f) => f.path).filter(Boolean));
    const pathless = new Map<string, NoteFile>();
    current.forEach((f) => { if (!dropIds.has(f.id) && !f.path) pathless.set(f.folder + '/' + f.file, f); });

    const added: NoteFile[] = [];
    const backfills: { id: string; path: string }[] = [];
    const discoveredFolders = new Set<string>();
    entries.forEach((e) => {
      const rel = e.path.slice(root.length + 1);
      if (!rel) return;
      if (e.is_dir) {
        // Register every real directory, including ones with no files directly in
        // them, so the sidebar is a complete mirror of what's actually on disk.
        discoveredFolders.add(rel);
        return;
      }
      if (known.has(e.path)) return;
      const lastSlash = rel.lastIndexOf('/');
      const folder = lastSlash === -1 ? 'Notes' : rel.slice(0, lastSlash);
      const ext = e.name.split('.').pop() || 'md';
      const type: FileType = ext === 'html' ? 'html' : ext === 'eml' ? 'eml' : 'md';
      // A path-less entry with this exact folder+file already represents this file
      // (e.g. a daily note created before it was ever synced to disk) — adopt it
      // instead of minting a second entry for the same underlying file.
      const match = pathless.get(folder + '/' + e.name);
      if (match) backfills.push({ id: match.id, path: e.path });
      else added.push({ id: 'fs-' + e.path, title: e.name.replace(/\.[^.]+$/, ''), file: e.name, type, folder, pinned: false, path: e.path });
      const parts = folder.split('/');
      for (let i = 1; i <= parts.length; i += 1) discoveredFolders.add(parts.slice(0, i).join('/'));
    });

    // Newly-discovered and freshly-backfilled files never have content yet, and any
    // already-known vault file that's still missing its content (e.g. from before this
    // fix, or a prior failed read) gets picked up here too — so a stale/blank note
    // self-heals on next refresh.
    const backfillFiles = backfills.map((b) => ({ ...current.find((f) => f.id === b.id)!, path: b.path }));
    const stale = current.filter((f) => (
      f.path && !dropIds.has(f.id) && !backfills.some((b) => b.id === f.id)
      && (f.type === 'eml' ? !(f.id in stateRef.current.eml) : !(f.id in stateRef.current.sources))
    ));
    const toRead = [...added, ...stale, ...backfillFiles];
    const newSources: Record<string, string> = {};
    const newEml: Record<string, EmlData> = {};
    if (toRead.length) {
      await Promise.all(toRead.map(async (f) => {
        if (!f.path) return;
        const raw = await readFile(f.path).catch(() => null);
        if (raw === null) return;
        if (f.type === 'eml') newEml[f.id] = parseEml(raw);
        else newSources[f.id] = raw;
      }));
    }
    // Compute the merge text now that the winner's real disk content (if it was stale) has
    // just been read into `newSources` — falling back to the pre-refresh `sources` entry only
    // when the winner wasn't read this pass. A merge result always wins over a plain disk
    // read for the same id (the merge is disk-content-aware and additionally protects the
    // loser's unique lines).
    const mergedSources: Record<string, string> = {};
    mergeGroups.forEach((loserIds, winnerId) => {
      let base = newSources[winnerId] ?? stateRef.current.sources[winnerId] ?? '';
      loserIds.forEach((loserId) => {
        const loserText = stateRef.current.sources[loserId];
        if (loserText) base = mergeNoteContent(base, loserText);
      });
      mergedSources[winnerId] = base;
    });
    Object.assign(newSources, mergedSources);
    if (isTauri()) {
      Object.entries(mergedSources).forEach(([id, text]) => {
        const f = current.find((c) => c.id === id);
        if (f?.path) writeFile(f.path, text).catch(() => {});
      });
    }

    const hasChanges = added.length || discoveredFolders.size || Object.keys(newSources).length
      || Object.keys(newEml).length || backfills.length || dropIds.size;
    if (hasChanges) {
      const now = Date.now();
      setState((s) => {
        const newFolders = Array.from(discoveredFolders).filter((f) => !s.folderOrder.includes(f));
        const strip = <T,>(rec: Record<string, T>): Record<string, T> => (
          Object.fromEntries(Object.entries(rec).filter(([id]) => !dropIds.has(id)))
        );
        const fileMoves = { ...s.fileMoves };
        backfills.forEach((b) => { fileMoves[b.id] = { ...fileMoves[b.id], path: b.path }; });
        dropIds.forEach((id) => { delete fileMoves[id]; });
        const remapId = (id: string) => remap.get(id) ?? id;
        return {
          dynamicFiles: (added.length || dropIds.size)
            ? [...s.dynamicFiles.filter((f) => !dropIds.has(f.id)), ...added]
            : s.dynamicFiles,
          noteOrder: (added.length || dropIds.size)
            ? [...s.noteOrder.filter((id) => !dropIds.has(id)), ...added.map((f) => f.id)]
            : s.noteOrder,
          createdAt: added.length ? { ...s.createdAt, ...Object.fromEntries(added.map((f) => [f.id, now])) } : s.createdAt,
          folderOrder: newFolders.length ? [...s.folderOrder, ...newFolders] : s.folderOrder,
          sources: Object.keys(newSources).length || dropIds.size ? strip({ ...s.sources, ...newSources }) : s.sources,
          eml: Object.keys(newEml).length || dropIds.size ? strip({ ...s.eml, ...newEml }) : s.eml,
          history: dropIds.size ? strip(s.history) : s.history,
          editedAt: dropIds.size ? strip(s.editedAt) : s.editedAt,
          fileMoves,
          activeId: dropIds.size && s.activeId ? remapId(s.activeId) : s.activeId,
          secondaryId: dropIds.size && s.secondaryId ? remapId(s.secondaryId) : s.secondaryId,
          openTabs: dropIds.size ? Array.from(new Set(s.openTabs.map(remapId))) : s.openTabs,
        };
      });
    }
    setState({ lastSyncedAt: Date.now() });
  }, [setState]);

  const pickVaultRoot = useCallback(async () => {
    const dir = await tauriPickVaultRoot();
    if (!dir) return;

    // Switching (or connecting) a vault makes the sidebar mirror that folder only —
    // drop everything tied to whatever was showing before (old vault or demo data)
    // and rescan immediately, so vault and sidebar folders never disagree.
    const oldIds = new Set(stateRef.current.dynamicFiles.map((f) => f.id));
    const stripOld = <T,>(rec: Record<string, T>): Record<string, T> => (
      Object.fromEntries(Object.entries(rec).filter(([id]) => !oldIds.has(id)))
    );
    const reset: Partial<FullState> = {
      vaultRoot: dir,
      dynamicFiles: [],
      folderOrder: [],
      noteOrder: [],
      fileMoves: {},
      expandedDocs: {},
      pinnedFolders: [],
      sources: stripOld(stateRef.current.sources),
      eml: stripOld(stateRef.current.eml),
      history: stripOld(stateRef.current.history),
      editedAt: stripOld(stateRef.current.editedAt),
      createdAt: stripOld(stateRef.current.createdAt),
      openTabs: [],
      activeId: null,
      secondaryId: null,
    };
    setState(reset);
    stateRef.current = { ...stateRef.current, ...reset };
    await refreshVault();
  }, [refreshVault, setState]);

  // Poll the vault folder in the background so files created externally (e.g. by an
  // automation) surface in "Recently created" without the user manually hitting refresh.
  // Scheduled off `lastSyncedAt` (rather than a fixed setInterval from mount) so an
  // out-of-cycle manual refresh (e.g. pickVaultRoot, the sidebar refresh button) always
  // pushes the next tick out a full VAULT_POLL_MS from itself — keeping StatusBar's
  // "next check in Xs" countdown accurate instead of drifting from the real schedule.
  useEffect(() => {
    if (!isTauri() || !state.vaultRoot) return;
    const id = window.setTimeout(() => { refreshVault(); }, VAULT_POLL_MS);
    return () => window.clearTimeout(id);
  }, [refreshVault, state.vaultRoot, state.lastSyncedAt]);

  const toggleTask = useCallback((idx: number, forId?: string | null) => {
    const id = forId ?? stateRef.current.activeId;
    if (!id) return;
    const lines = (stateRef.current.sources[id] || '').split('\n');
    if (!lines[idx]) return;
    lines[idx] = /\[x\]/i.test(lines[idx]) ? lines[idx].replace(/\[x\]/i, '[ ]') : lines[idx].replace(/\[ \]/, '[x]');
    setSource(id, lines.join('\n'));
  }, [setSource]);

  const ensureDaily = useCallback((): string => {
    const title = dailyTitle();
    const id = 'daily-' + title;
    const file = title + '.md';
    // Match by identity (folder+file), not just the synthetic id — a file that already
    // exists on disk (e.g. discovered by refreshVault under an `fs-` id) must be reused
    // rather than getting a second, independently-drifting entry.
    const existing = all.find((f) => f.folder === 'Daily' && f.file === file);
    if (existing) return existing.id;
    if (!fileOf(id)) {
      const body = '---\ntags: [daily]\n---\n# ' + title + '\n\n';
      const nf: NoteFile = { id, title, file, type: 'md', folder: 'Daily', pinned: false };
      if (isTauri() && stateRef.current.vaultRoot) {
        nf.path = vaultPath('Daily', file);
        tauriCreateFile(nf.path, body).catch(() => {});
      }
      setState((s) => ({
        dynamicFiles: [...s.dynamicFiles, nf],
        sources: { ...s.sources, [id]: body },
        createdAt: { ...s.createdAt, [id]: Date.now() },
      }));
    }
    return id;
  }, [all, fileOf, setState, vaultPath]);

  const openDaily = useCallback(() => {
    const id = ensureDaily();
    setTimeout(() => open(id), 0);
  }, [ensureDaily, open]);

  const openTaskManager = useCallback(() => setState({ activeId: TASK_MANAGER_ID }), [setState]);

  const openAddTask = useCallback(() => setState({
    addTaskOpen: true, addTaskText: '', addTaskDue: '', addTaskPriority: '', addTaskTargetId: null,
  }), [setState]);
  const closeAddTask = useCallback(() => setState({ addTaskOpen: false }), [setState]);

  // Shared by the Add Task modal and the Task Manager page's inline add row —
  // `navigate: false` lets a caller append a task without leaving the page it's on.
  const addTaskLine = useCallback((opts: {
    text: string; due?: string; priority?: TaskPriority; targetId?: string | null; navigate?: boolean;
  }) => {
    const txt = opts.text.trim();
    if (!txt) return;
    const line = buildTaskLine({ text: txt, due: opts.due, priority: opts.priority });
    const explicitTarget = opts.targetId;
    const id = explicitTarget || ensureDaily();
    const path = explicitTarget
      ? fileOf(explicitTarget)?.path
      : (isTauri() && stateRef.current.vaultRoot ? vaultPath('Daily', dailyTitle() + '.md') : undefined);
    const navigate = opts.navigate !== false;
    setTimeout(() => {
      setState((s2) => {
        const prev = s2.sources[id] || '';
        const sep = prev && !prev.endsWith('\n') ? '\n' : '';
        const next = prev + sep + line + '\n';
        if (isTauri() && path) writeFile(path, next).catch(() => {});
        return {
          sources: { ...s2.sources, [id]: next },
          editedAt: { ...s2.editedAt, [id]: Date.now() },
          ...(navigate ? { activeId: id, openTabs: s2.openTabs.includes(id) ? s2.openTabs : [...s2.openTabs, id] } : {}),
        };
      });
    }, 0);
  }, [ensureDaily, fileOf, setState, vaultPath]);

  const saveAddTask = useCallback(() => {
    const s = stateRef.current;
    if (!s.addTaskText.trim()) { setState({ addTaskOpen: false }); return; }
    addTaskLine({
      text: s.addTaskText, due: s.addTaskDue || undefined, priority: s.addTaskPriority || undefined, targetId: s.addTaskTargetId,
    });
    setState({
      addTaskOpen: false, addTaskText: '', addTaskDue: '', addTaskPriority: '', addTaskTargetId: null,
    });
  }, [addTaskLine, setState]);

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
  const codeBlocksRef2 = useRef<Record<string, string>>({});
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

  // secondary (split) pane mirror of onPreviewClick above — copies from its own
  // codeBlocksRef2 and toggles tasks against the secondary doc, not the active one.
  const onPreviewClickSecondary = useCallback((e: MouseEvent) => {
    const target = (e.target as HTMLElement).closest('[data-copy],[data-task],[data-wiki]') as HTMLElement | null;
    if (!target) return;
    if (target.hasAttribute('data-copy')) {
      const raw = codeBlocksRef2.current[target.getAttribute('data-copy')!];
      if (raw && navigator.clipboard) navigator.clipboard.writeText(raw);
      const o = target.textContent;
      target.textContent = 'Copied';
      setTimeout(() => { try { target.textContent = o; } catch { /* ignore */ } }, 1000);
      return;
    }
    if (target.hasAttribute('data-task')) { toggleTask(+target.getAttribute('data-task')!, stateRef.current.secondaryId); return; }
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
      else if (meta && e.shiftKey && k === 'n') { e.preventDefault(); openAddTask(); }
      else if (meta && e.shiftKey && k === 't') { e.preventDefault(); openTaskManager(); }
      else if (meta && k === 'e' && s.activeId) { e.preventDefault(); setState((s2) => ({ view: s2.view === 'preview' ? 'edit' : 'preview' })); }
      else if (meta && e.key === '/') { e.preventDefault(); setState((s2) => ({ shortcutsOpen: !s2.shortcutsOpen })); }
      else if (meta && k === 'w' && s.activeId) { e.preventDefault(); closeTab(s.activeId); }
      else if (meta && /^[1-9]$/.test(e.key)) { const i = +e.key - 1; if (s.openTabs[i]) { e.preventDefault(); setState({ activeId: s.openTabs[i] }); } }
      else if (meta && e.shiftKey && e.key === '|') { e.preventDefault(); setState((s2) => ({ railHidden: !s2.railHidden })); }
      else if (meta && e.key === '\\') { e.preventDefault(); setState((s2) => ({ collapsed: !s2.collapsed })); }
      else if (e.key === 'Escape') { setState({ paletteOpen: false, settingsOpen: false, findOpen: false, historyOpen: false, graphOpen: false, addTaskOpen: false, shortcutsOpen: false, exportOpen: false, suggest: null, smartFilterModalOpen: false }); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [closeTab, openAddTask, openTaskManager, setState]);

  // focus management
  useEffect(() => {
    if (state.paletteOpen && paletteInputRef.current) setTimeout(() => { try { paletteInputRef.current?.focus(); } catch { /* ignore */ } }, 20);
  }, [state.paletteOpen]);
  useEffect(() => {
    if (state.addTaskOpen && addTaskInputRef.current) setTimeout(() => { try { addTaskInputRef.current?.focus(); } catch { /* ignore */ } }, 20);
  }, [state.addTaskOpen]);

  // =================== derived view model ===================
  const active = fileOf(state.activeId);
  const isMd = active?.type === 'md';
  const isHtml = active?.type === 'html';
  const isEml = active?.type === 'eml';
  const showSource = !!active && (state.view === 'edit' || state.view === 'split');
  const showPreview = !!active && (state.view === 'preview' || state.view === 'split');

  const primaryDoc = deriveDoc(active, state.sources, state.eml, state.wiki, '');
  const {
    sourceValue, outline, words, activeTags, emlData, mdHtml,
  } = primaryDoc;
  codeBlocksRef.current = primaryDoc.codeBlocks;
  mermaidBlocksRef.current = primaryDoc.mermaidBlocks;

  const secondaryFile = fileOf(state.secondaryId);
  const secondaryDoc = deriveDoc(secondaryFile, state.sources, state.eml, state.wiki, 'sec-');
  codeBlocksRef2.current = secondaryDoc.codeBlocks;
  mermaidBlocksRef2.current = secondaryDoc.mermaidBlocks;

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

  // secondary (split) pane mirror of the katex/mermaid hydration effect above
  useEffect(() => {
    const root = previewElRef2.current;
    if (!root || !secondaryDoc.isMd) return;
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
      const code = mermaidBlocksRef2.current[el.getAttribute('data-mmd') || ''];
      if (!code) return;
      const id = 'mmdsvg2' + Date.now() + i;
      try {
        mermaid.render(id, code).then((r) => { el.innerHTML = r.svg; }).catch(() => { el.setAttribute('data-done', ''); });
      } catch { /* ignore */ }
    });
  }, [secondaryDoc.isMd, secondaryDoc.mdHtml]);

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
      { title: 'Add Task', run: 'addTask' },
      { title: 'Open Task Manager', run: 'taskManager' },
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
      case 'addTask': openAddTask(); break;
      case 'taskManager': openTaskManager(); break;
      case 'graph': setState({ graphOpen: true }); break;
      case 'sidebar': setState((s) => ({ collapsed: !s.collapsed })); break;
      case 'find': setState({ findOpen: true }); break;
      case 'history': setState({ historyOpen: true, historyPick: 0 }); break;
      case 'shortcuts': setState({ shortcutsOpen: true }); break;
      case 'window': try { window.open(location.href, '_blank'); } catch { /* ignore */ } break;
      case 'settings': setState({ settingsOpen: true }); break;
    }
  }, [open, openAddTask, openDaily, openOrCreate, openTaskManager, setState]);

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

  // tasks (aggregated from checkbox lines across all markdown notes)
  const tasks = useMemo(() => scanTasks(all, state.sources), [all, state.sources]);
  const taskCounts = useMemo(
    () => tasks.filter((t) => !t.done && (isOverdue(t.due) || isToday(t.due))).length,
    [tasks],
  );

  // pinned
  const pinnedFiles = useMemo(() => all.filter((f) => f.pinned), [all]);
  const pinnedFolderPaths = useMemo(
    () => state.folderOrder.filter((p) => state.pinnedFolders.includes(p)),
    [state.folderOrder, state.pinnedFolders],
  );

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

  // Seed/demo notes aren't stored as removable entries (they're not in dynamicFiles, only
  // ever patched via fileMoves), so deletion is only offered for real vault/dynamic files.
  const deleteFile = useCallback((id: string) => {
    const f = fileOf(id);
    const isDynamic = stateRef.current.dynamicFiles.some((d) => d.id === id);
    if (!f || !isDynamic) return;
    if (!window.confirm('Delete "' + f.title + '"? This can\'t be undone.')) return;
    if (isTauri() && f.path) tauriDeleteFile(f.path).catch(() => {});
    const kids = childrenOf(id);
    setState((s) => {
      const strip = <T,>(rec: Record<string, T>): Record<string, T> => (
        Object.fromEntries(Object.entries(rec).filter(([k]) => k !== id))
      );
      const fileMoves = { ...s.fileMoves };
      delete fileMoves[id];
      kids.forEach((k) => { fileMoves[k.id] = { ...fileMoves[k.id], parent: f.parent }; });
      return {
        dynamicFiles: s.dynamicFiles.filter((x) => x.id !== id),
        noteOrder: withoutId(s.noteOrder, id),
        sources: strip(s.sources),
        eml: strip(s.eml),
        history: strip(s.history),
        editedAt: strip(s.editedAt),
        createdAt: strip(s.createdAt),
        fileMoves,
      };
    });
    closeTab(id);
  }, [childrenOf, closeTab, fileOf, setState]);

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

  const folderSubtreeDepth = useCallback((path: string): number => {
    const kids = stateRef.current.folderOrder.filter((p) => folderParentPath(p) === path);
    if (!kids.length) return 0;
    return 1 + Math.max(...kids.map((k) => folderSubtreeDepth(k)));
  }, []);

  const reorderFolder = useCallback((draggedPath: string, targetPath: string, position: 'before' | 'after' | 'inside') => {
    if (draggedPath === targetPath) return;
    if (targetPath === draggedPath || targetPath.startsWith(draggedPath + '/')) return; // no cycles

    const targetParent = folderParentPath(targetPath);
    const newParent = position === 'inside' ? targetPath : targetParent;
    const oldParent = folderParentPath(draggedPath);

    if (position === 'inside' && folderPathDepth(targetPath) + 1 + folderSubtreeDepth(draggedPath) > MAX_FOLDER_DEPTH) return;

    if (newParent === oldParent && position !== 'inside') {
      setState((s) => ({ folderOrder: insertRelative(s.folderOrder, draggedPath, targetPath, position) }));
      return;
    }

    const leafName = folderLeafName(draggedPath);
    const newPath = newParent ? newParent + '/' + leafName : leafName;
    if (newPath !== draggedPath && stateRef.current.folderOrder.includes(newPath)) return; // name collision at destination

    const remap = (p: string): string => {
      if (p === draggedPath) return newPath;
      if (p.startsWith(draggedPath + '/')) return newPath + p.slice(draggedPath.length);
      return p;
    };

    setState((s) => {
      let nextOrder = s.folderOrder.map(remap);
      nextOrder = position === 'inside'
        ? [...withoutId(nextOrder, newPath), newPath]
        : insertRelative(nextOrder, newPath, targetPath, position);

      const nextExpanded: Record<string, boolean> = {};
      Object.entries(s.expandedDocs).forEach(([k, v]) => {
        if (k.startsWith('folder:')) {
          const np = remap(k.slice(7));
          nextExpanded['folder:' + np] = v;
        } else {
          nextExpanded[k] = v;
        }
      });

      const nextFileMoves = { ...s.fileMoves };
      all.forEach((f) => {
        if (f.folder === draggedPath || f.folder.startsWith(draggedPath + '/')) {
          nextFileMoves[f.id] = { ...s.fileMoves[f.id], folder: remap(f.folder) };
        }
      });

      return { folderOrder: nextOrder, expandedDocs: nextExpanded, fileMoves: nextFileMoves };
    });
  }, [all, folderSubtreeDepth, setState]);

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

  const togglePinFile = useCallback((id: string) => {
    const f = fileOf(id);
    if (!f) return;
    setState((s) => ({
      fileMoves: { ...s.fileMoves, [id]: { ...s.fileMoves[id], pinned: !f.pinned } },
    }));
  }, [fileOf, setState]);

  const togglePinFolder = useCallback((path: string) => {
    setState((s) => ({
      pinnedFolders: s.pinnedFolders.includes(path)
        ? s.pinnedFolders.filter((p) => p !== path)
        : [...s.pinnedFolders, path],
    }));
  }, [setState]);

  const revealFile = useCallback((id: string) => {
    const f = fileOf(id);
    if (f?.path) revealInFinder(f.path).catch(() => {});
  }, [fileOf]);

  const revealFolder = useCallback((path: string) => {
    const root = stateRef.current.vaultRoot;
    if (root) revealInFinder(root + '/' + path).catch(() => {});
  }, []);

  const collapseAllFolders = useCallback(() => {
    setState((s) => ({
      expandedDocs: {
        ...s.expandedDocs,
        ...Object.fromEntries(s.folderOrder.map((name) => ['folder:' + name, false])),
      },
    }));
  }, [setState]);

  const createFolder = useCallback((name: string, parentPath?: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const path = parentPath ? parentPath + '/' + trimmed : trimmed;
    if (folderPathDepth(path) > MAX_FOLDER_DEPTH) return;
    setState((s) => (s.folderOrder.includes(path) ? {} : { folderOrder: [...s.folderOrder, path] }));
  }, [setState]);

  const matchesRule = useCallback((f: NoteFile, rule: FilterRule): boolean => {
    switch (rule.field) {
      case 'type': return f.type === rule.value;
      case 'tag': return fileTags(f.id).includes(rule.value);
      case 'folder': return f.folder === rule.value || f.folder.startsWith(rule.value + '/');
      case 'pinned': return String(f.pinned) === rule.value;
      case 'filename': return f.file.toLowerCase().includes(rule.value.toLowerCase());
      case 'text': {
        const needle = rule.value.toLowerCase();
        const body = bodyOf(f).replace(/<[^>]+>/g, ' ').toLowerCase();
        return f.title.toLowerCase().includes(needle) || body.includes(needle);
      }
      case 'createdAfter': return (stateRef.current.createdAt[f.id] || 0) >= Date.parse(rule.value);
      case 'createdBefore': return (stateRef.current.createdAt[f.id] || 0) <= Date.parse(rule.value);
      default: return true;
    }
  }, [bodyOf, fileTags]);

  const pred = useCallback((f: NoteFile): boolean => {
    const k = state.filter;
    if (k === 'all') return true;
    if (k === 'pinned') return f.pinned;
    if (k === 'markdown') return f.type === 'md';
    if (k === 'html') return f.type === 'html';
    if (k === 'email') return f.type === 'eml';
    if (k.startsWith('tag:')) return fileTags(f.id).includes(k.slice(4));
    if (k.startsWith('custom:')) {
      const cf = state.customFilters.find((c) => c.id === k.slice(7));
      if (!cf || !cf.rules.length) return true;
      return cf.match === 'all' ? cf.rules.every((r) => matchesRule(f, r)) : cf.rules.some((r) => matchesRule(f, r));
    }
    return true;
  }, [fileTags, matchesRule, state.customFilters, state.filter]);

  const createCustomFilter = useCallback((filter: Omit<CustomFilter, 'id'>): string => {
    const id = 'filter-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    setState((s) => ({ customFilters: [...s.customFilters, { ...filter, id }] }));
    return id;
  }, [setState]);

  const updateCustomFilter = useCallback((id: string, patch: Partial<Omit<CustomFilter, 'id'>>) => {
    setState((s) => ({ customFilters: s.customFilters.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  }, [setState]);

  const deleteCustomFilter = useCallback((id: string) => {
    setState((s) => ({
      customFilters: s.customFilters.filter((c) => c.id !== id),
      filter: s.filter === 'custom:' + id ? 'all' : s.filter,
    }));
  }, [setState]);

  const openSmartFilterCreator = useCallback((editId?: string) => {
    setState({ smartFilterModalOpen: true, editingFilterId: editId ?? null });
  }, [setState]);

  const closeSmartFilterModal = useCallback(() => {
    setState({ smartFilterModalOpen: false });
  }, [setState]);

  const customFilterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    state.customFilters.forEach((cf) => {
      counts[cf.id] = cf.rules.length === 0
        ? all.length
        : all.filter((f) => (cf.match === 'all' ? cf.rules.every((r) => matchesRule(f, r)) : cf.rules.some((r) => matchesRule(f, r)))).length;
    });
    return counts;
  }, [all, matchesRule, state.customFilters]);

  const folderTree = useMemo(() => {
    const byParent = new Map<string | undefined, string[]>();
    state.folderOrder.forEach((path) => {
      const parent = folderParentPath(path);
      const list = byParent.get(parent) || [];
      list.push(path);
      byParent.set(parent, list);
    });
    const build = (parent: string | undefined): FolderNode[] => (byParent.get(parent) || []).map((path) => ({
      path,
      name: folderLeafName(path),
      roots: all.filter((f) => f.folder === path && !f.parent && pred(f)).sort((a, b) => orderIdx(a.id) - orderIdx(b.id)),
      children: build(path),
    }));
    const hasVisibleContent = (node: FolderNode): boolean => node.roots.length > 0 || node.children.some(hasVisibleContent);
    const pruneEmpty = (nodes: FolderNode[]): FolderNode[] => nodes
      .filter((n) => state.filter === 'all' || hasVisibleContent(n))
      .map((n) => ({ ...n, children: pruneEmpty(n.children) }));
    return pruneEmpty(build(undefined));
  }, [all, pred, state.folderOrder, orderIdx, state.filter]);

  // breadcrumb
  const pathSegments = useMemo(() => {
    if (!active) return [];
    const ancestors: NoteFile[] = [];
    let p = active.parent;
    while (p) { const pf = fileOf(p); if (!pf) break; ancestors.unshift(pf); p = pf.parent; }
    const segs: { label: string; title: string; id?: string; current: boolean }[] = [];
    const folderParts = active.folder.split('/');
    folderParts.forEach((part, i) => {
      const prefixPath = folderParts.slice(0, i + 1).join('/');
      const firstInFolder = all.find((f) => f.folder === prefixPath && !f.parent);
      segs.push({ label: part, title: 'Folder · ' + prefixPath, id: firstInFolder?.id, current: false });
    });
    ancestors.forEach((a) => segs.push({ label: a.title, title: a.file, id: a.id, current: false }));
    segs.push({ label: active.file, title: active.file, current: true });
    return segs;
  }, [active, all, fileOf]);

  // secondary (split) pane — mirrors the primary doc's shape for EditorPane/PreviewPane
  const secondary = {
    id: state.secondaryId,
    file: secondaryFile,
    isMd: secondaryDoc.isMd,
    isHtml: secondaryDoc.isHtml,
    isEml: secondaryDoc.isEml,
    sourceValue: secondaryDoc.sourceValue,
    mdHtml: secondaryDoc.mdHtml,
    emlData: secondaryDoc.emlData,
    view: state.secondaryView,
    sourceElRef: sourceElRef2,
    previewElRef: previewElRef2,
    onSourceInput: (e: ChangeEvent<HTMLTextAreaElement>) => {
      const id = stateRef.current.secondaryId;
      if (!id) return;
      setSource(id, e.target.value);
    },
    onPreviewClick: onPreviewClickSecondary,
  };

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
    recentDocs, recentlyCreated, tagCount, folderTree, pathSegments,
    pinnedFiles, pinnedFolderPaths,
    accent: ACCENT, accentSoft: ACCENT_SOFT,
    showRightSidebar,
    // refs
    sourceElRef, previewElRef, paletteInputRef, addTaskInputRef,
    // split pane
    secondary, openSplit, closeSplitPane,
    // actions
    open, closeTab, touch, setSource, setEml, aiGenerate, toggleTask, openOrCreate,
    tasks, taskCounts,
    openAddTask, closeAddTask, saveAddTask, addTaskLine, openTaskManager, ensureDaily, openDaily,
    currentExportHtml, exportPrint, exportDownload, exportDoc, exportCopyHtml,
    onPreviewClick, onSourceInput, scrollTo, selectInSource, selectPreviewTextInSource,
    openInBrowser,
    agoLabel,
    childrenOf, newFile, duplicateFile, moveFileTo, deleteFile, toggleExpand, pickVaultRoot, refreshVault,
    reorderNote, reorderFolder, depthOf, renameFile, collapseAllFolders, createFolder,
    createCustomFilter, updateCustomFilter, deleteCustomFilter, openSmartFilterCreator, closeSmartFilterModal,
    customFilterCounts, togglePinFile, togglePinFolder, revealFile, revealFolder,
    allFolderNames: state.folderOrder,
    maxFolderDepth: MAX_FOLDER_DEPTH,
    isTauri: isTauri(),
    htmlToMd,
  };
}

export type NotesAppVM = ReturnType<typeof useNotesApp>;
export type { ViewMode, HtmlWidth };
