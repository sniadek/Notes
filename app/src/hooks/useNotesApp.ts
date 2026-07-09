import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, MouseEvent, SyntheticEvent } from 'react';
import katex from 'katex';
import mermaid from 'mermaid';
import {
  badgeColors, files as filesSeed, slashDefs, typeLabels,
} from '../seedData';
import { loadPersistedState, savePersistedState, type PersistedState } from '../lib/persist';
import {
  diffLines, esc, htmlToMd, mdToHtml, outlineHtml, outlineMd, parseEml, parseFront, parseFrontCached, slug, wordCount,
} from '../lib/markdown';
import type { FrontMatter } from '../lib/markdown';
import {
  agoLabel, appendUnderSection, dailyTitle, download, escapeRegExp, isoWeekLabel, isoWeekMonday, linesInSection,
  linkifyMentions, nowStamp, openInBrowser, renderDailyTemplate, routeDailyCapture, shiftISO,
} from '../lib/utils';
import {
  copyFile as tauriCopyFile, createFile as tauriCreateFile, deleteFile as tauriDeleteFile, isTauri,
  moveFile as tauriMoveFile, pickVaultRoot as tauriPickVaultRoot, readFile, readVaultTree,
  revealInFinder, setVaultRoot as tauriSetVaultRoot, writeFile,
} from '../lib/tauriFs';
import {
  TASK_MANAGER_ID, buildTaskLine, isOverdue, isToday, parseTaskLine, scanTasks, todayISO,
} from '../lib/tasks';
import { isSupportedFile, mergeNoteContent, typeFromFilename } from '../lib/vaultFile';
import type { CustomFilter, EmlData, FileType, FilterRule, HtmlWidth, NoteFile, TaskPriority, ViewMode } from '../types';

interface Suggest { kind: 'wiki' | 'slash'; q: string; caret: number; pane: 'primary' | 'secondary'; }

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
  // Which file the History modal is inspecting. null ⇒ the active (primary) file; the
  // secondary breadcrumb sets this to the split pane's file so its History opens correctly.
  historyTargetId: string | null;
  graphOpen: boolean;
  addTaskOpen: boolean;
  addTaskText: string;
  addTaskDue: string;
  addTaskPriority: TaskPriority | '';
  addTaskTargetId: string | null;
  dailyCaptureOpen: boolean;
  dailyCaptureText: string;
  // Which day the capture lands in (ISO). Defaults to today when the modal opens; the
  // modal's date picker lets you backdate an entry into an earlier (or later) day's note.
  dailyCaptureDate: string;
  // Transient confirmation banner shown after a capture, with an Undo affordance.
  toast: { message: string } | null;
  shortcutsOpen: boolean;
  exportOpen: boolean;
  // Separate flag for the split pane's breadcrumb export menu, so opening one column's
  // Export menu doesn't also pop the other column's.
  exportOpenSecondary: boolean;
  suggest: Suggest | null;
  smartFilterModalOpen: boolean;
  editingFilterId: string | null;
  lastSyncedAt: number | null;
  // id of the last note whose disk write failed (cleared on the next successful write),
  // and whether the last localStorage persist failed (e.g. quota) — both surfaced in the
  // sidebar footer so a failing save is never silent.
  saveError: string | null;
  persistError: boolean;
  // Which half of a split pair last had interaction focus — drives the tab bar's bold/current
  // styling independent of activeId/secondaryId, which stay pinned to their left/right panes.
  // false = primary (left) tab looks current; true = secondary (right) tab does. Only consulted
  // while a pair actually exists (state.secondaryId is set) — otherwise ignored.
  secondaryFocused: boolean;
  // Mini calendar/heatmap popover for the Daily Note button (feature 2) — calendarMonth is
  // the displayed month as "YYYY-MM", not persisted (always reopens on the current month).
  calendarOpen: boolean;
  calendarMonth: string;
}

function ephemeralDefaults(): EphemeralState {
  return {
    paletteOpen: false, paletteQuery: '', paletteIdx: 0,
    settingsOpen: false,
    findOpen: false, findQuery: '', replaceQuery: '', findRegex: false,
    historyOpen: false, historyPick: 0, historyTargetId: null,
    graphOpen: false,
    addTaskOpen: false, addTaskText: '', addTaskDue: '', addTaskPriority: '', addTaskTargetId: null,
    dailyCaptureOpen: false, dailyCaptureText: '', dailyCaptureDate: '', toast: null,
    shortcutsOpen: false,
    exportOpen: false,
    exportOpenSecondary: false,
    suggest: null,
    smartFilterModalOpen: false,
    editingFilterId: null,
    lastSyncedAt: null,
    saveError: null,
    persistError: false,
    secondaryFocused: false,
    calendarOpen: false,
    calendarMonth: todayISO().slice(0, 7),
  };
}

type FullState = PersistedState & EphemeralState;

const ACCENT = 'var(--accent)';
const ACCENT_SOFT = 'var(--accent-soft)';
export const VAULT_POLL_MS = 20000;

// Exported/printed HTML is full of inline styles referencing the app's CSS variables — a
// fresh window (or Word) has none of them, so exports define the light-theme palette
// explicitly (mirrors html[data-design="default"] in index.css).
const EXPORT_STYLE = '<style>:root{--text-primary:#26241f;--text-secondary:#403d37;--text-muted:#8a8a8f;--text-tertiary:#a8a29a;--text-faint:#b5b0a6;--text-faintest:#bdb8af;--border:rgba(0,0,0,.07);--border-soft:rgba(0,0,0,.05);--bg-subtle:#f0eee9;--bg-surface:#fffefb;--accent-hue:264;--accent:oklch(0.5 0.12 264);--accent-soft:oklch(0.95 0.025 264)}</style>';

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

// Like insertRelative, but moves a whole group of ids at once, preserving their relative
// order — used by tab drag-reordering so a split pair always moves as one unit.
function moveRelative(order: string[], ids: string[], targetId: string, position: 'before' | 'after'): string[] {
  const idSet = new Set(ids);
  const base = order.filter((x) => !idSet.has(x));
  const idx = base.indexOf(targetId);
  const at = idx === -1 ? base.length : (position === 'before' ? idx : idx + 1);
  return [...base.slice(0, at), ...ids, ...base.slice(at)];
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
  isPdf: boolean;
  isImage: boolean;
  sourceValue: string;
  outline: ReturnType<typeof outlineMd>;
  words: number;
  activeTags: string[];
  frontMatter: FrontMatter;
  emlData: EmlData;
  mdHtml: string;
  codeBlocks: Record<string, string>;
  mermaidBlocks: Record<string, string>;
}

// Pure computation shared by the primary and secondary (split) panes — given a file plus
// its raw source (and parsed eml, for .eml files), builds everything a pane needs to
// render. Takes the individual note's data rather than the whole sources/eml maps so the
// callers' useMemo can key on exactly what this reads — the maps change identity on every
// keystroke in ANY note. idPrefix keeps generated code-block/mermaid-block ids from
// colliding when both panes render markdown at once.
function deriveDoc(file: NoteFile | undefined, source: string, emlEntry: EmlData | undefined, wiki: boolean, idPrefix: string): DerivedDoc {
  const isMd = file?.type === 'md';
  const isHtml = file?.type === 'html';
  const isEml = file?.type === 'eml';
  const isPdf = file?.type === 'pdf';
  const isImage = file?.type === 'image';
  let sourceValue = '';
  let outline: ReturnType<typeof outlineMd> = [];
  let words = 0;
  let activeTags: string[] = [];
  let frontMatter: FrontMatter = { body: '', offset: 0, tags: [], extra: {} };
  let emlData: EmlData = { from: '', to: '', subject: '', body: '' };
  let mdHtml = '';
  let codeBlocks: Record<string, string> = {};
  let mermaidBlocks: Record<string, string> = {};

  if (file) {
    if (isMd) {
      sourceValue = source;
      const fr = parseFront(sourceValue);
      frontMatter = fr;
      words = wordCount(fr.body);
      outline = outlineMd(fr.body);
      activeTags = fr.tags;
      const rendered = mdToHtml(fr.body, wiki, idPrefix, fr.offset);
      mdHtml = rendered.html;
      codeBlocks = rendered.codeBlocks;
      mermaidBlocks = rendered.mermaidBlocks;
    } else if (isHtml) {
      sourceValue = source;
      words = wordCount(sourceValue);
      outline = outlineHtml(sourceValue);
    } else if (isEml) {
      emlData = emlEntry || { from: '', to: '', subject: '', body: '' };
      words = wordCount(emlData.body);
      outline = outlineHtml(emlData.body);
    }
  }

  return { isMd, isHtml, isEml, isPdf, isImage, sourceValue, outline, words, activeTags, frontMatter, emlData, mdHtml, codeBlocks, mermaidBlocks };
}

export function useNotesApp(showRightSidebar = true) {
  const [state, setStateRaw] = useState<FullState>(() => ({ ...loadPersistedState(), ...ephemeralDefaults() }));
  const stateRef = useRef(state);
  stateRef.current = state;

  const setState = useCallback((patch: Partial<FullState> | ((s: FullState) => Partial<FullState>)) => {
    setStateRaw((prev) => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) }));
  }, []);

  // The document actually being edited — the focused half of a split pair, or the sole open
  // tab otherwise. Editing machinery (source input, suggestions, select-in-source, AI draft)
  // targets this instead of activeId, so it follows focus instead of staying pinned to the
  // left pane. activeId/secondaryId themselves stay fixed to their left/right panes.
  const focusedNoteId = useCallback((): string | null => {
    const s = stateRef.current;
    return (s.secondaryFocused && s.secondaryId) ? s.secondaryId : s.activeId;
  }, []);

  // Sets the view mode (edit/split/preview) for whichever tab is focused *at call time* —
  // resolved fresh inside the updater so a stale closure can never write to the wrong tab.
  const setView = useCallback((mode: ViewMode) => {
    setState((s) => {
      const id = (s.secondaryFocused && s.secondaryId) ? s.secondaryId : s.activeId;
      if (!id) return {};
      return { viewByNote: { ...s.viewByNote, [id]: mode } };
    });
  }, [setState]);

  // ---- persistence (debounced) ----
  const saveTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      // Disk-backed note contents are NOT persisted to localStorage — the vault file on
      // disk is their source of truth (refreshVault re-reads any missing ones on launch).
      // Persisting them too would blow the ~5MB quota on any real vault and silently stop
      // ALL persistence. Path-less notes (created before a vault existed) keep their text
      // here since localStorage is the only place it lives.
      const diskBacked = new Set<string>();
      const moves = state.fileMoves;
      state.dynamicFiles.forEach((f) => {
        if (f.path || moves[f.id]?.path) diskBacked.add(f.id);
      });
      const p: PersistedState = {
        collapsed: state.collapsed, railHidden: state.railHidden, defaultView: state.defaultView, viewByNote: state.viewByNote, activeId: state.activeId,
        secondaryId: state.secondaryId,
        openTabs: state.openTabs, filter: state.filter, expandedDocs: state.expandedDocs, editedAt: state.editedAt,
        dynamicFiles: state.dynamicFiles,
        sources: Object.fromEntries(Object.entries(state.sources).filter(([id]) => !diskBacked.has(id))),
        eml: state.eml, history: state.history,
        wiki: state.wiki, autosave: state.autosave, htmlWidth: state.htmlWidth,
        docWidth: state.docWidth, docFontSize: state.docFontSize, vaultRoot: state.vaultRoot,
        design: state.design, folderOrder: state.folderOrder, noteOrder: state.noteOrder, fileMoves: state.fileMoves,
        createdAt: state.createdAt, customFilters: state.customFilters, pinnedFolders: state.pinnedFolders,
        dailyFolder: state.dailyFolder, dailyTemplate: state.dailyTemplate,
        dailyPrompts: state.dailyPrompts, dailyCarryOverTasks: state.dailyCarryOverTasks, dailyGlobalShortcut: state.dailyGlobalShortcut,
      };
      const ok = savePersistedState(p);
      if (!ok !== stateRef.current.persistError) setState({ persistError: !ok });
    }, 250);
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
  }, [state, setState]);

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
  // Ref mirror for timer/event callbacks (the debounced disk writes): they must resolve a
  // note's path at fire time, not the path from the render that scheduled them — otherwise
  // a rename with a write pending would re-create the file under its old name.
  const fileOfMapRef = useRef(fileOfMap);
  fileOfMapRef.current = fileOfMap;

  const fileTags = useCallback((id: string): string[] => {
    const f = fileOf(id);
    if (!f || f.type !== 'md') return [];
    return parseFrontCached(id, state.sources[id] || '').tags;
  }, [fileOf, state.sources]);

  const fileFrontMatter = useCallback((id: string): FrontMatter => {
    const f = fileOf(id);
    if (!f || f.type !== 'md') return { body: '', offset: 0, tags: [], extra: {} };
    return parseFrontCached(id, state.sources[id] || '');
  }, [fileOf, state.sources]);

  // refs
  const sourceElRef = useRef<HTMLTextAreaElement | null>(null);
  const previewElRef = useRef<HTMLDivElement | null>(null);
  const paletteInputRef = useRef<HTMLInputElement | null>(null);
  const addTaskInputRef = useRef<HTMLInputElement | null>(null);
  const dailyCaptureInputRef = useRef<HTMLTextAreaElement | null>(null);
  // Holds the pre-append source of the last capture so the toast's Undo can restore it.
  const captureUndoRef = useRef<{ id: string; prevSource: string } | null>(null);
  const mermaidBlocksRef = useRef<Record<string, string>>({});
  // secondary (split) pane refs — mirror the primary pane's refs above. Both panes can be
  // independently editable, so the secondary gets its own source textarea ref too.
  const previewElRef2 = useRef<HTMLDivElement | null>(null);
  const sourceElRef2 = useRef<HTMLTextAreaElement | null>(null);
  const mermaidBlocksRef2 = useRef<Record<string, string>>({});

  const touch = useCallback((id: string) => {
    setState((s) => ({ editedAt: { ...s.editedAt, [id]: Date.now() } }));
  }, [setState]);

  // ---- disk write queue ----
  // All source edits funnel through markDirty: writes are debounced per note (so typing
  // doesn't hit the disk per keystroke), chained per note (so an earlier slow write can
  // never land after — and clobber — a later one), gated on the autosave setting (edits
  // still flush on window blur/close when it's off), and failures surface via saveError
  // instead of vanishing.
  const writeTimers = useRef<Map<string, number>>(new Map());
  const writeChains = useRef<Map<string, Promise<void>>>(new Map());
  const dirtyIds = useRef<Set<string>>(new Set());
  // Timestamp (captured when `contents` was read, not when the write later confirms) of the
  // last edit actually confirmed written to disk for each note. refreshVault compares this
  // against editedAt to tell "fully saved" apart from "edited but not yet confirmed on disk"
  // — dirtyIds alone isn't enough for that, since it's cleared the instant a write *starts*,
  // not when it's *confirmed*, leaving a window where a background disk read can still race
  // in with pre-edit content (see the "captures reappear after editing" bug).
  const lastWrittenAt = useRef<Map<string, number>>(new Map());

  const flushNoteToDisk = useCallback((id: string) => {
    const t = writeTimers.current.get(id);
    if (t) { window.clearTimeout(t); writeTimers.current.delete(id); }
    dirtyIds.current.delete(id);
    if (!isTauri()) return;
    const path = fileOfMapRef.current.get(id)?.path;
    const contents = stateRef.current.sources[id];
    if (!path || contents === undefined) return;
    // Captured now, before the write even starts — if a newer edit lands while this write is
    // still in flight, its editedAt will be later than this capturedAt, correctly keeping the
    // note flagged unsafe until *that* edit is itself confirmed written.
    const capturedAt = Date.now();
    const prev = writeChains.current.get(id) ?? Promise.resolve();
    const next = prev.then(
      () => writeFile(path, contents).then(
        () => {
          lastWrittenAt.current.set(id, capturedAt);
          if (stateRef.current.saveError === id) setState({ saveError: null });
        },
        () => setState({ saveError: id }),
      ),
    );
    writeChains.current.set(id, next);
  }, [setState]);

  const markDirty = useCallback((id: string) => {
    dirtyIds.current.add(id);
    if (!isTauri() || !stateRef.current.autosave) return;
    const t = writeTimers.current.get(id);
    if (t) window.clearTimeout(t);
    writeTimers.current.set(id, window.setTimeout(() => flushNoteToDisk(id), 600));
  }, [flushNoteToDisk]);

  const flushAllWrites = useCallback(() => {
    Array.from(dirtyIds.current).forEach((id) => flushNoteToDisk(id));
  }, [flushNoteToDisk]);

  useEffect(() => {
    window.addEventListener('blur', flushAllWrites);
    window.addEventListener('beforeunload', flushAllWrites);
    return () => {
      window.removeEventListener('blur', flushAllWrites);
      window.removeEventListener('beforeunload', flushAllWrites);
    };
  }, [flushAllWrites]);

  const setSource = useCallback((id: string, v: string) => {
    setState((s) => ({ sources: { ...s.sources, [id]: v } }));
    touch(id);
    markDirty(id);
  }, [markDirty, setState, touch]);

  const setEml = useCallback((id: string, key: keyof EmlData, val: string) => {
    setState((s) => ({ eml: { ...s.eml, [id]: { ...s.eml[id], [key]: val } } }));
    touch(id);
  }, [setState, touch]);

  const open = useCallback((id: string) => {
    setState((s) => {
      const openTabs = s.openTabs.includes(id) ? s.openTabs : [...s.openTabs, id];
      if (id === s.activeId) return { openTabs, secondaryFocused: false };
      // Clicking the split partner's tab (or its pane) is a no-op for pane assignment — the
      // left pane stays pinned to activeId (editable) and the right pane stays pinned to
      // secondaryId (read-only preview) for as long as the pair exists, regardless of which
      // one was last clicked. It does move the tab bar's highlight there (secondaryFocused),
      // so "current tab" tracks interaction even though the panes themselves don't move.
      // Activating anything else dissolves any existing pairing — otherwise a stale
      // secondaryId tags along onto an unrelated note (the "phantom split" bug, where opening
      // a fresh note after closing everything still rendered two panes).
      if (s.secondaryId && id === s.secondaryId) return { openTabs, secondaryFocused: true };
      return { activeId: id, secondaryId: null, openTabs, secondaryFocused: false };
    });
  }, [setState]);

  const closeTab = useCallback((id: string, e?: SyntheticEvent) => {
    if (e) e.stopPropagation();
    setState((s) => {
      const tabs = s.openTabs.filter((t) => t !== id);
      let act = s.activeId;
      // Closing either half of a split pair permanently dissolves the link, rather than
      // leaving a dangling secondaryId that resurfaces as a phantom split on the next open().
      const dissolved = s.secondaryId && (id === s.secondaryId || id === s.activeId);
      const sec = dissolved ? null : s.secondaryId;
      if (act === id) act = tabs[tabs.length - 1] || null;
      return { openTabs: tabs, activeId: act, secondaryId: sec, secondaryFocused: dissolved ? false : s.secondaryFocused };
    });
  }, [setState]);

  const closeAllTabs = useCallback(() => {
    setState({ openTabs: [], activeId: null, secondaryId: null, secondaryFocused: false });
  }, [setState]);

  const closeOtherTabs = useCallback((keepId: string) => {
    setState((s) => ({
      openTabs: s.openTabs.includes(keepId) ? [keepId] : s.openTabs,
      activeId: keepId,
      secondaryId: null,
      secondaryFocused: false,
    }));
  }, [setState]);

  const openSplit = useCallback((id: string) => {
    setState((s) => ({
      secondaryId: id,
      secondaryFocused: false,
      // Land the split doc right next to the primary tab, so the pair shows up
      // adjacent in the tab bar instead of the secondary doc having no tab at all.
      openTabs: s.openTabs.includes(id)
        ? s.openTabs
        : (s.activeId ? insertRelative(s.openTabs, id, s.activeId, 'after') : [...s.openTabs, id]),
    }));
  }, [setState]);

  const closeSplitPane = useCallback(() => {
    // Whichever pane had focus becomes the sole remaining document — unlinking shouldn't
    // silently snap back to the primary tab if you'd been looking at the secondary one.
    setState((s) => ({
      activeId: (s.secondaryFocused && s.secondaryId) ? s.secondaryId : s.activeId,
      secondaryId: null,
      secondaryFocused: false,
    }));
  }, [setState]);

  // Pairs two already-open tabs into split view from the tab bar's own "Split with…" picker
  // (as opposed to openSplit, which always pairs a note with whatever is currently active).
  // Reuses insertRelative the same way openSplit does, so the pair always lands adjacent.
  const pairTabs = useCallback((primaryId: string, otherId: string) => {
    if (primaryId === otherId) return;
    setState((s) => ({
      activeId: primaryId,
      secondaryId: otherId,
      secondaryFocused: false,
      openTabs: insertRelative(s.openTabs, otherId, primaryId, 'after'),
    }));
  }, [setState]);

  // Drag-to-reorder in the tab bar. Dragging either half of the active split pair moves both
  // tabs together (they must stay adjacent — that's how the pane pairing is tracked), and
  // dropping a plain tab onto the *inside* boundary of someone else's pair snaps it just
  // outside instead, so a pair never gets split apart by an unrelated tab landing between them.
  const reorderTab = useCallback((draggedId: string, targetId: string, position: 'before' | 'after') => {
    if (draggedId === targetId) return;
    setState((s) => {
      const pairIds = (s.secondaryId && s.activeId) ? [s.activeId, s.secondaryId] : [];
      const isDraggedPaired = pairIds.includes(draggedId);
      const unit = isDraggedPaired ? pairIds : [draggedId];
      if (unit.includes(targetId)) return {};
      let effTarget = targetId;
      let effPosition = position;
      if (!isDraggedPaired && pairIds.length === 2 && pairIds.includes(targetId)) {
        const [primary, secondary] = pairIds;
        if (targetId === primary && position === 'after') { effTarget = secondary; effPosition = 'after'; }
        else if (targetId === secondary && position === 'before') { effTarget = primary; effPosition = 'before'; }
      }
      return { openTabs: moveRelative(s.openTabs, unit, effTarget, effPosition) };
    });
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
    const srcDot = src.file.lastIndexOf('.');
    const file = slug(title) + (srcDot === -1 ? '' : src.file.slice(srcDot));
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

  // Paths whose disk read failed (permissions, non-UTF8 content in a supported extension…).
  // Without this the poll would retry them every VAULT_POLL_MS forever; cleared when a new
  // vault is picked.
  const failedReads = useRef<Set<string>>(new Set());

  const refreshVault = useCallback(async () => {
    const root = stateRef.current.vaultRoot;
    if (!isTauri() || !root) return;
    // The Rust side scopes every file command to a registered root; a fresh process (or a
    // vault switch) hasn't registered one yet, so (re-)register before scanning. Idempotent.
    await tauriSetVaultRoot(root).catch(() => {});
    const refreshStart = Date.now();
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
    // Never drop/remap a note that's currently open (as the active or secondary tab) and has
    // an edit not yet confirmed written to disk. Dropping it repoints activeId/secondaryId to
    // a different id (see the remap below), which changes the preview pane's React `key` and
    // forces a remount — silently discarding any not-yet-blurred contentEditable edit (the
    // "text disappears while still focused, in split view" bug). Leaves the pair
    // un-reconciled for this pass; it retries on the next poll once the note settles.
    const isUnsafeLoser = (id: string) => (
      (id === stateRef.current.activeId || id === stateRef.current.secondaryId)
      && (stateRef.current.editedAt[id] || 0) > (lastWrittenAt.current.get(id) || 0)
    );
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
        if (isUnsafeLoser(loser.id)) return;
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

    // Self-heals any already-known file whose stored type disagrees with its actual filename —
    // e.g. a .pdf that was scanned before pdf support existed and is stuck typed as 'md'
    // forever otherwise, since the `known` check below skips re-deriving type for it.
    const typeFixes = new Map<string, FileType>();
    current.forEach((f) => {
      if (!f.path || dropIds.has(f.id)) return;
      const correct = typeFromFilename(f.file);
      if (correct !== f.type) typeFixes.set(f.id, correct);
    });

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
      // Unsupported extensions (binaries, office docs…) would be typed 'md', fail every
      // UTF-8 read, and get retried on every poll forever — don't adopt them at all.
      if (!isSupportedFile(e.name)) return;
      const lastSlash = rel.lastIndexOf('/');
      const folder = lastSlash === -1 ? 'Notes' : rel.slice(0, lastSlash);
      const type = typeFromFilename(e.name);
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
    const currentById = new Map(current.map((f) => [f.id, f]));
    const backfillFiles = backfills.map((b) => ({ ...currentById.get(b.id)!, path: b.path }));
    const stale = current.filter((f) => (
      f.path && !dropIds.has(f.id) && !backfills.some((b) => b.id === f.id) && f.type !== 'pdf' && f.type !== 'image'
      && (f.type === 'eml' ? !(f.id in stateRef.current.eml) : !(f.id in stateRef.current.sources))
    ));
    const toRead = [...added, ...stale, ...backfillFiles];
    const newSources: Record<string, string> = {};
    const newEml: Record<string, EmlData> = {};
    if (toRead.length) {
      await Promise.all(toRead.map(async (f) => {
        // PDFs and images are binary — never read as UTF-8 text; PreviewPane points an iframe/img
        // straight at the file on disk via the asset protocol instead.
        if (!f.path || f.type === 'pdf' || f.type === 'image') return;
        if (failedReads.current.has(f.path)) return;
        const raw = await readFile(f.path).catch(() => null);
        if (raw === null) { failedReads.current.add(f.path); return; }
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
    // Never let a merge computed from a stale/in-flight-write snapshot get written to disk for
    // a note with an edit newer than the last edit actually *confirmed* written — otherwise a
    // real edit can be silently overwritten on disk by resurrected "duplicate" text, which then
    // reads back as truth on the *next* refresh. Scoped to mergedSources specifically (not the
    // general disk-read path below): a merge winner is, by construction, a note this session
    // has already loaded/edited, so there's no first-load case here to worry about blocking —
    // unlike freshSources below, which also covers notes never read into memory this session at
    // all, where lastWrittenAt (an in-memory map, empty on every fresh launch) would otherwise
    // wrongly appear "unwritten" forever for anything with an old *persisted* editedAt and block
    // their very first load from disk.
    const unsafeToWriteMerge = (id: string) => (stateRef.current.editedAt[id] || 0) > (lastWrittenAt.current.get(id) || 0);
    if (isTauri()) {
      Object.entries(mergedSources).forEach(([id, text]) => {
        if (unsafeToWriteMerge(id)) return;
        const f = currentById.get(id);
        if (f?.path) writeFile(f.path, text).catch(() => {});
      });
    }

    const hasChanges = added.length || discoveredFolders.size || Object.keys(newSources).length
      || Object.keys(newEml).length || backfills.length || dropIds.size || typeFixes.size;
    if (hasChanges) {
      const now = Date.now();
      setState((s) => {
        const newFolders = Array.from(discoveredFolders).filter((f) => !s.folderOrder.includes(f));
        const strip = <T,>(rec: Record<string, T>): Record<string, T> => (
          Object.fromEntries(Object.entries(rec).filter(([id]) => !dropIds.has(id)))
        );
        // A note the user edited while this refresh's disk reads were in flight must keep the
        // newer in-memory text — the read snapshot is already stale for it. Merge-derived
        // entries get the additional, stricter unsafeToWriteMerge check (see above).
        const freshSources = Object.fromEntries(
          Object.entries(newSources).filter(([id]) => {
            if (id in mergedSources) return !unsafeToWriteMerge(id);
            return !((s.editedAt[id] || 0) > refreshStart);
          }),
        );
        const fileMoves = { ...s.fileMoves };
        backfills.forEach((b) => { fileMoves[b.id] = { ...fileMoves[b.id], path: b.path }; });
        dropIds.forEach((id) => { delete fileMoves[id]; });
        const remapId = (id: string) => remap.get(id) ?? id;
        return {
          dynamicFiles: (added.length || dropIds.size || typeFixes.size)
            ? [
                ...s.dynamicFiles
                  .filter((f) => !dropIds.has(f.id))
                  .map((f) => (typeFixes.has(f.id) ? { ...f, type: typeFixes.get(f.id)! } : f)),
                ...added,
              ]
            : s.dynamicFiles,
          noteOrder: (added.length || dropIds.size)
            ? [...s.noteOrder.filter((id) => !dropIds.has(id)), ...added.map((f) => f.id)]
            : s.noteOrder,
          createdAt: added.length ? { ...s.createdAt, ...Object.fromEntries(added.map((f) => [f.id, now])) } : s.createdAt,
          folderOrder: newFolders.length ? [...s.folderOrder, ...newFolders] : s.folderOrder,
          sources: Object.keys(newSources).length || dropIds.size ? strip({ ...s.sources, ...freshSources }) : s.sources,
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
    failedReads.current.clear();

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
    // First scan of a session runs almost immediately (lastSyncedAt is ephemeral, so it's
    // null right after launch): disk-backed note contents aren't persisted to localStorage,
    // so this initial read is what populates them.
    const delay = state.lastSyncedAt == null ? 200 : VAULT_POLL_MS;
    const id = window.setTimeout(() => { refreshVault(); }, delay);
    return () => window.clearTimeout(id);
  }, [refreshVault, state.vaultRoot, state.lastSyncedAt]);

  // Registers the OS-level global quick-capture shortcut (feature 9). The handler toggles a
  // small floating WebviewWindow (label "quickcapture", loading index.html?quickcapture=1 —
  // see main.tsx/QuickCaptureWindow.tsx) rather than focusing the main window, so capture
  // works without switching away from whatever app you're in. Re-registers whenever the
  // configured accelerator string changes, unregistering the previous one first. No-op
  // outside Tauri (the browser preview has no OS-level shortcut API).
  useEffect(() => {
    if (!isTauri()) return;
    const shortcut = state.dailyGlobalShortcut;
    if (!shortcut) return;
    let cancelled = false;
    let registered = false;
    (async () => {
      try {
        const { register } = await import('@tauri-apps/plugin-global-shortcut');
        await register(shortcut, async () => {
          const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
          const existing = await WebviewWindow.getByLabel('quickcapture');
          if (existing) {
            if (await existing.isVisible()) { await existing.hide(); } else { await existing.show(); await existing.setFocus(); }
            return;
          }
          new WebviewWindow('quickcapture', {
            url: 'index.html?quickcapture=1',
            width: 420, height: 220, center: true, decorations: false, resizable: false, alwaysOnTop: true, title: 'Quick Capture', skipTaskbar: true,
          });
        });
        if (!cancelled) registered = true;
      } catch {
        /* not running under a Tauri build with this plugin wired up yet */
      }
    })();
    return () => {
      cancelled = true;
      if (!registered) return;
      import('@tauri-apps/plugin-global-shortcut').then(({ unregister }) => unregister(shortcut)).catch(() => {});
    };
  }, [state.dailyGlobalShortcut]);

  const toggleTask = useCallback((idx: number, forId?: string | null) => {
    const id = forId ?? stateRef.current.activeId;
    if (!id) return;
    const lines = (stateRef.current.sources[id] || '').split('\n');
    if (!lines[idx]) return;
    lines[idx] = /\[x\]/i.test(lines[idx]) ? lines[idx].replace(/\[x\]/i, '[ ]') : lines[idx].replace(/\[ \]/, '[x]');
    setSource(id, lines.join('\n'));
  }, [setSource]);

  // Finds or creates the daily note for a given day (defaults to today), returning its id.
  // The folder and seed content come from the configurable dailyFolder/dailyTemplate settings.
  const ensureDaily = useCallback((dateISO?: string): string => {
    const title = dateISO || dailyTitle();
    const folder = stateRef.current.dailyFolder || 'Daily';
    const id = 'daily-' + title;
    const file = title + '.md';
    // Match by identity (folder+file), not just the synthetic id — a file that already
    // exists on disk (e.g. discovered by refreshVault under an `fs-` id) must be reused
    // rather than getting a second, independently-drifting entry.
    const existing = all.find((f) => f.folder === folder && f.file === file);
    if (existing) return existing.id;
    if (!fileOf(id)) {
      let body = renderDailyTemplate(stateRef.current.dailyTemplate, title);
      // Seed prompts as an unchecked checklist under a new Prompts section.
      stateRef.current.dailyPrompts.forEach((prompt) => {
        if (prompt.trim()) body = appendUnderSection(body, 'Prompts', buildTaskLine({ text: prompt.trim() }));
      });
      // Carry unchecked Tasks forward from the previous day, if it already exists — never
      // creates the previous day just to check it.
      if (stateRef.current.dailyCarryOverTasks) {
        const prevFile = shiftISO(title, -1) + '.md';
        const prevNote = all.find((f) => f.folder === folder && f.file === prevFile);
        if (prevNote) {
          const prevBody = stateRef.current.sources[prevNote.id] || '';
          linesInSection(prevBody, 'Tasks').forEach((line) => {
            const parsed = parseTaskLine(line);
            if (parsed && !parsed.done) body = appendUnderSection(body, 'Tasks', line);
          });
        }
      }
      const nf: NoteFile = { id, title, file, type: 'md', folder, pinned: false };
      if (isTauri() && stateRef.current.vaultRoot) {
        nf.path = vaultPath(folder, file);
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

  // Regenerates the ISO-week rollup note for the week containing `dateISO` (defaults to
  // today) — a re-derived digest of that week's daily notes, so unlike ensureDaily it
  // overwrites on every call rather than only creating once. Skips any day that has no
  // note yet (never creates the missing days just to check them). Fixed 'Weekly' folder.
  const generateWeeklyReview = useCallback((dateISO?: string) => {
    const day = dateISO || todayISO();
    const monday = isoWeekMonday(day);
    const label = isoWeekLabel(day);
    const folder = 'Weekly';
    const file = label + '.md';
    const id = 'weekly-' + label;
    const dailyFolder = stateRef.current.dailyFolder || 'Daily';

    const sections: Record<'Tasks' | 'Questions' | 'Log', string[]> = { Tasks: [], Questions: [], Log: [] };
    for (let i = 0; i < 7; i++) {
      const iso = shiftISO(monday, i);
      const note = all.find((f) => f.folder === dailyFolder && f.file === iso + '.md');
      if (!note) continue;
      const body = stateRef.current.sources[note.id] || '';
      (['Tasks', 'Questions', 'Log'] as const).forEach((h) => {
        linesInSection(body, h).forEach((line) => sections[h].push(line));
      });
    }

    let content = '# Week ' + label + '\n\n';
    let any = false;
    (['Tasks', 'Questions', 'Log'] as const).forEach((h) => {
      if (sections[h].length) { any = true; content += '## ' + h + '\n' + sections[h].join('\n') + '\n\n'; }
    });
    if (!any) content += '_No daily-note entries for this week yet._\n';

    const existing = all.find((f) => f.folder === folder && f.file === file);
    const targetId = existing ? existing.id : id;
    if (!existing) {
      const nf: NoteFile = { id, title: label, file, type: 'md', folder, pinned: false };
      if (isTauri() && stateRef.current.vaultRoot) {
        nf.path = vaultPath(folder, file);
        tauriCreateFile(nf.path, content).catch(() => {});
      }
      setState((s) => ({
        dynamicFiles: [...s.dynamicFiles, nf],
        sources: { ...s.sources, [id]: content },
        createdAt: { ...s.createdAt, [id]: Date.now() },
      }));
    } else {
      setState((s) => ({ sources: { ...s.sources, [targetId]: content }, editedAt: { ...s.editedAt, [targetId]: Date.now() } }));
      markDirty(targetId);
    }
    setTimeout(() => open(targetId), 0);
  }, [all, markDirty, open, setState, vaultPath]);

  const openDailyCapture = useCallback(() => setState({ dailyCaptureOpen: true, dailyCaptureText: '', dailyCaptureDate: todayISO() }), [setState]);
  const closeDailyCapture = useCallback(() => setState({ dailyCaptureOpen: false }), [setState]);

  // Opens (creating on demand) the daily note for a specific day and navigates to it —
  // used by the daily-note day-navigation arrows in the breadcrumb bar.
  const openDailyFor = useCallback((dateISO: string) => {
    const id = ensureDaily(dateISO);
    setTimeout(() => open(id), 0);
  }, [ensureDaily, open]);

  // Appends a capture to a day's note without navigating there — the whole point of
  // quick-capture. Reuses the same markDirty/persist path as addTaskLine. A leading
  // `todo`/`q`/`?` prefix routes the entry into a Tasks/Questions section; anything else
  // becomes a timestamped bullet under Log (see routeDailyCapture).
  const appendDaily = useCallback((text: string, dateISO?: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const day = dateISO || todayISO();
    const id = ensureDaily(day);
    const body = linkifyMentions(trimmed, all.map((f) => f.title));
    const { heading, line } = routeDailyCapture(body);
    const folder = stateRef.current.dailyFolder || 'Daily';
    setTimeout(() => {
      setState((s) => {
        const prev = s.sources[id] || '';
        captureUndoRef.current = { id, prevSource: prev };
        return {
          sources: { ...s.sources, [id]: appendUnderSection(prev, heading, line) },
          editedAt: { ...s.editedAt, [id]: Date.now() },
          toast: { message: 'Added to ' + folder + ' / ' + day },
        };
      });
      markDirty(id);
    }, 0);
  }, [all, ensureDaily, markDirty, setState]);

  const saveDailyCapture = useCallback(() => {
    const s = stateRef.current;
    appendDaily(s.dailyCaptureText, s.dailyCaptureDate || undefined);
    setState({ dailyCaptureOpen: false, dailyCaptureText: '' });
  }, [appendDaily, setState]);

  // Restores the daily note to its pre-capture state (invoked from the toast's Undo).
  const undoLastCapture = useCallback(() => {
    const u = captureUndoRef.current;
    if (!u) { setState({ toast: null }); return; }
    setState((s) => ({ sources: { ...s.sources, [u.id]: u.prevSource }, editedAt: { ...s.editedAt, [u.id]: Date.now() }, toast: null }));
    markDirty(u.id);
    captureUndoRef.current = null;
  }, [markDirty, setState]);

  const dismissToast = useCallback(() => setState({ toast: null }), [setState]);

  // Lets the sidebar highlight its Daily Note button the same way it highlights Tasks
  // (state.activeId === TASK_MANAGER_ID) without duplicating the 'daily-' + dailyTitle() id
  // convention from ensureDaily above.
  const dailyNoteId = 'daily-' + dailyTitle();

  // Dissolves any active split — the Task Manager is a full-page view, not a split partner,
  // and leaving a stale secondaryId behind would make its old tab a dead click (it'd hit the
  // no-op branch in open() instead of switching away from the Task Manager).
  const openTaskManager = useCallback(() => setState({ activeId: TASK_MANAGER_ID, secondaryId: null }), [setState]);

  // Folder tree pane — same "full-page view, not a split partner" shape as the Task Manager
  // above, but keyed per-folder via a synthetic 'folder:<path>' id instead of one constant.
  const openFolder = useCallback((path: string) => setState({ activeId: 'folder:' + path, secondaryId: null }), [setState]);

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
    const navigate = opts.navigate !== false;
    setTimeout(() => {
      setState((s2) => {
        const prev = s2.sources[id] || '';
        const sep = prev && !prev.endsWith('\n') ? '\n' : '';
        return {
          sources: { ...s2.sources, [id]: prev + sep + line + '\n' },
          editedAt: { ...s2.editedAt, [id]: Date.now() },
        };
      });
      markDirty(id);
      if (navigate) open(id);
    }, 0);
  }, [ensureDaily, markDirty, open, setState]);

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

  const aiGenerate = useCallback((id: string) => {
    setState((s) => ({
      eml: {
        ...s.eml,
        [id]: { ...s.eml[id], body: s.eml[id].body + '\n<p style="font:400 14px/1.7 -apple-system,system-ui;color:var(--text-secondary);margin:14px 0 0"><em>Generated insight: deploy frequency rose 22% week-over-week.</em></p>' },
      },
    }));
  }, [setState]);

  // ---- bodyOf / export ----
  const bodyOf = useCallback((f: NoteFile): string => (f.type === 'eml' ? (stateRef.current.eml[f.id] || {} as EmlData).body || '' : stateRef.current.sources[f.id] || ''), []);

  // All export helpers accept an optional target id (defaulting to the active/primary file),
  // so the split pane's breadcrumb can export the secondary file without changing existing callers.
  const currentExportHtml = useCallback((targetId?: string | null): string => {
    const a = fileOf(targetId ?? stateRef.current.activeId);
    if (!a) return '';
    if (a.type === 'md') {
      const fr = parseFront(stateRef.current.sources[a.id] || '');
      return mdToHtml(fr.body, stateRef.current.wiki, '', fr.offset).html;
    }
    if (a.type === 'html') return stateRef.current.sources[a.id] || '';
    const d = stateRef.current.eml[a.id] || ({} as EmlData);
    return d.body || '';
  }, [fileOf]);

  const exportPrint = useCallback((targetId?: string | null) => {
    const a = fileOf(targetId ?? stateRef.current.activeId);
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write('<!doctype html><meta charset="utf-8"><title>' + esc(a ? a.title : '') + '</title>' + EXPORT_STYLE + '<body style="font-family:-apple-system,system-ui,sans-serif;max-width:680px;margin:40px auto;padding:0 20px;color:#26241f">' + currentExportHtml(a?.id) + '</body>');
    w.document.close();
    setTimeout(() => { try { w.print(); } catch { /* ignore */ } }, 350);
  }, [currentExportHtml, fileOf]);

  const exportDownload = useCallback((targetId?: string | null) => {
    const a = fileOf(targetId ?? stateRef.current.activeId);
    if (!a) return;
    if (a.type === 'eml') {
      const d = stateRef.current.eml[a.id] || ({} as EmlData);
      const eml = 'From: ' + d.from + '\nTo: ' + d.to + '\nSubject: ' + d.subject + '\nContent-Type: text/html\n\n' + d.body;
      download(a.file, eml, 'message/rfc822');
    } else {
      download(a.file, stateRef.current.sources[a.id] || '', 'text/plain');
    }
  }, [fileOf]);

  const exportDoc = useCallback((targetId?: string | null) => {
    const a = fileOf(targetId ?? stateRef.current.activeId);
    if (!a) return;
    const html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8">' + EXPORT_STYLE + '</head><body>' + currentExportHtml(a.id) + '</body></html>';
    download((a.title || 'document') + '.doc', html, 'application/msword');
  }, [currentExportHtml, fileOf]);

  const exportCopyHtml = useCallback((targetId?: string | null) => {
    if (navigator.clipboard) navigator.clipboard.writeText(currentExportHtml(targetId));
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
  // Each pane resolves its own note directly (activeId/secondaryId) instead of "whichever is
  // focused" — both panes can be independently editable, so this is no longer focus-dependent.
  const onSourceInput = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    const id = stateRef.current.activeId;
    if (!id) return;
    const v = e.target.value;
    const caret = e.target.selectionStart;
    const before = v.slice(0, caret);
    let sug: Suggest | null = null;
    const mw = /\[\[([^\]\n]*)$/.exec(before);
    const ms = /(?:^|\n)\/(\w*)$/.exec(before);
    if (mw) sug = { kind: 'wiki', q: mw[1], caret, pane: 'primary' };
    else if (ms) sug = { kind: 'slash', q: ms[1], caret, pane: 'primary' };
    setState((s) => ({ sources: { ...s.sources, [id]: v }, suggest: sug }));
    touch(id);
    markDirty(id);
  }, [markDirty, setState, touch]);

  // secondary (split) pane mirror of onSourceInput above — same duplication convention as
  // onPreviewClick/onPreviewClickSecondary.
  const onSourceInputSecondary = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    const id = stateRef.current.secondaryId;
    if (!id) return;
    const v = e.target.value;
    const caret = e.target.selectionStart;
    const before = v.slice(0, caret);
    let sug: Suggest | null = null;
    const mw = /\[\[([^\]\n]*)$/.exec(before);
    const ms = /(?:^|\n)\/(\w*)$/.exec(before);
    if (mw) sug = { kind: 'wiki', q: mw[1], caret, pane: 'secondary' };
    else if (ms) sug = { kind: 'slash', q: ms[1], caret, pane: 'secondary' };
    setState((s) => ({ sources: { ...s.sources, [id]: v }, suggest: sug }));
    touch(id);
    markDirty(id);
  }, [markDirty, setState, touch]);

  const pickSuggest = useCallback((item: string) => {
    const sg = stateRef.current.suggest;
    if (!sg) return;
    const isSecondary = sg.pane === 'secondary';
    const id = isSecondary ? stateRef.current.secondaryId : stateRef.current.activeId;
    if (!id) return;
    const v = stateRef.current.sources[id] || '';
    const caret = sg.caret;
    const removeLen = (sg.kind === 'wiki' ? 2 : 1) + sg.q.length;
    const start = caret - removeLen;
    const insert = sg.kind === 'wiki' ? '[[' + item + ']]' : item;
    const nv = v.slice(0, start) + insert + v.slice(caret);
    setState({ sources: { ...stateRef.current.sources, [id]: nv }, suggest: null });
    markDirty(id);
    const el = isSecondary ? sourceElRef2.current : sourceElRef.current;
    if (el) {
      const pos = start + insert.length;
      setTimeout(() => { try { el.focus(); el.setSelectionRange(pos, pos); } catch { /* ignore */ } }, 10);
    }
  }, [markDirty, setState]);

  const selectPreviewTextInSource = useCallback((text: string, pane: 'primary' | 'secondary' = 'primary') => {
    const t = text.trim();
    if (!t) return;
    const isSecondary = pane === 'secondary';
    const id = isSecondary ? stateRef.current.secondaryId : stateRef.current.activeId;
    const src = stateRef.current.sources[id || ''] || '';
    const idx = src.indexOf(t);
    if (idx === -1) return;
    const el = isSecondary ? sourceElRef2.current : sourceElRef.current;
    if (!el) return;
    el.setSelectionRange(idx, idx + t.length);
    const lineHeight = 25;
    const line = el.value.slice(0, idx).split('\n').length - 1;
    el.scrollTop = Math.max(0, line * lineHeight - el.clientHeight / 2);
  }, []);

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
      else if (meta && e.shiftKey && k === 'd') { e.preventDefault(); openDailyCapture(); }
      else if (meta && k === 'e' && s.activeId) {
        e.preventDefault();
        const id = (s.secondaryFocused && s.secondaryId) ? s.secondaryId : s.activeId;
        const cur = (id && s.viewByNote[id]) || s.defaultView;
        setView(cur === 'preview' ? 'edit' : 'preview');
      }
      else if (meta && e.key === '/') { e.preventDefault(); setState((s2) => ({ shortcutsOpen: !s2.shortcutsOpen })); }
      else if (meta && k === 'w' && s.activeId) { e.preventDefault(); closeTab(s.activeId); }
      else if (meta && /^[1-9]$/.test(e.key)) { const i = +e.key - 1; if (s.openTabs[i]) { e.preventDefault(); open(s.openTabs[i]); } }
      else if (meta && e.shiftKey && e.key === '|') { e.preventDefault(); setState((s2) => ({ railHidden: !s2.railHidden })); }
      else if (meta && e.key === '\\') { e.preventDefault(); setState((s2) => ({ collapsed: !s2.collapsed })); }
      else if (e.key === 'Escape') { setState({ paletteOpen: false, settingsOpen: false, findOpen: false, historyOpen: false, historyTargetId: null, graphOpen: false, addTaskOpen: false, dailyCaptureOpen: false, shortcutsOpen: false, exportOpen: false, exportOpenSecondary: false, suggest: null, smartFilterModalOpen: false }); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [closeTab, open, openAddTask, openDaily, openDailyCapture, openTaskManager, setState, setView]);

  // focus management
  useEffect(() => {
    if (state.paletteOpen && paletteInputRef.current) setTimeout(() => { try { paletteInputRef.current?.focus(); } catch { /* ignore */ } }, 20);
  }, [state.paletteOpen]);
  useEffect(() => {
    if (state.addTaskOpen && addTaskInputRef.current) setTimeout(() => { try { addTaskInputRef.current?.focus(); } catch { /* ignore */ } }, 20);
  }, [state.addTaskOpen]);
  useEffect(() => {
    if (state.dailyCaptureOpen && dailyCaptureInputRef.current) setTimeout(() => { try { dailyCaptureInputRef.current?.focus(); } catch { /* ignore */ } }, 20);
  }, [state.dailyCaptureOpen]);
  // Auto-dismiss the capture toast after a few seconds; re-arms whenever a new toast appears.
  useEffect(() => {
    if (!state.toast) return;
    const t = window.setTimeout(() => setState({ toast: null }), 5000);
    return () => window.clearTimeout(t);
  }, [state.toast, setState]);

  // =================== derived view model ===================
  // View mode is per-tab (viewByNote), not global — falls back to defaultView (Settings'
  // "Default view") for any tab that hasn't been individually switched. Each pane looks up its
  // own note's mode, so switching focus never carries one tab's mode onto the other.
  const viewOf = (id: string | null): ViewMode => (id && state.viewByNote[id]) || state.defaultView;

  const active = fileOf(state.activeId);
  const isMd = active?.type === 'md';
  const isHtml = active?.type === 'html';
  const isEml = active?.type === 'eml';
  const isPdf = active?.type === 'pdf';
  const isImage = active?.type === 'image';
  const activeView = viewOf(state.activeId);
  // PDFs and images are preview-only, always — the stored per-tab view mode never applies to them.
  const showSource = !!active && !isPdf && !isImage && (activeView === 'edit' || activeView === 'split');
  const showPreview = !!active && (isPdf || isImage || activeView === 'preview' || activeView === 'split');

  // Memoized on exactly what each pane reads — its own note's source/eml entry — so a
  // keystroke re-renders markdown once for the pane being typed in, and unrelated state
  // changes (palette typing, drag hovers, the other pane's edits) re-render neither.
  const activeSource = (active && state.sources[active.id]) || '';
  const activeEmlEntry = active ? state.eml[active.id] : undefined;
  const primaryDoc = useMemo(
    () => deriveDoc(active, activeSource, activeEmlEntry, state.wiki, ''),
    [active, activeSource, activeEmlEntry, state.wiki],
  );
  const {
    sourceValue, outline, words, activeTags, frontMatter, emlData, mdHtml,
  } = primaryDoc;
  codeBlocksRef.current = primaryDoc.codeBlocks;
  mermaidBlocksRef.current = primaryDoc.mermaidBlocks;

  const secondaryFile = fileOf(state.secondaryId);
  const secondarySource = (secondaryFile && state.sources[secondaryFile.id]) || '';
  const secondaryEmlEntry = secondaryFile ? state.eml[secondaryFile.id] : undefined;
  const secondaryDoc = useMemo(
    () => deriveDoc(secondaryFile, secondarySource, secondaryEmlEntry, state.wiki, 'sec-'),
    [secondaryFile, secondarySource, secondaryEmlEntry, state.wiki],
  );
  codeBlocksRef2.current = secondaryDoc.codeBlocks;
  mermaidBlocksRef2.current = secondaryDoc.mermaidBlocks;
  // The edit/split/preview toggle follows whichever pane currently has focus — the unfocused
  // pane always falls back to plain read-only preview regardless of view mode (App.tsx picks
  // between these and the primary showSource/showPreview above based on state.secondaryFocused).
  const secondaryView = viewOf(state.secondaryId);
  const secondaryIsPdf = secondaryFile?.type === 'pdf';
  const secondaryIsImage = secondaryFile?.type === 'image';
  const secondaryShowSource = !!secondaryFile && !secondaryIsPdf && !secondaryIsImage && (secondaryView === 'edit' || secondaryView === 'split');
  const secondaryShowPreview = !!secondaryFile && (secondaryIsPdf || secondaryIsImage || secondaryView === 'preview' || secondaryView === 'split');

  // The document actually in focus (the secondary pane when it's the one last interacted with,
  // otherwise the primary) — same resolution used by focusedNoteId() for editing, and by
  // currentView below so the Toolbar's edit/split/preview buttons act on the right tab.
  const focusedId = (state.secondaryFocused && state.secondaryId) ? state.secondaryId : state.activeId;
  const currentView = viewOf(focusedId);

  // katex/mermaid hydration after markdown preview paints
  useEffect(() => {
    const root = previewElRef.current;
    if (!root || !isMd) return;
    root.querySelectorAll('[data-tex]:not([data-done])').forEach((el) => {
      el.setAttribute('data-done', '1');
      try { katex.render(el.getAttribute('data-tex') || '', el as HTMLElement, { throwOnError: false }); } catch { /* ignore */ }
    });
    if (!mermaidInit) {
      try { mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral' }); } catch { /* ignore */ }
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
      try { mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral' }); } catch { /* ignore */ }
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

  // backlinks — computed from real [[wiki]] links in note bodies (the old static
  // backlinkMap only covered the seed/demo notes, so vault notes never showed any).
  const backlinksFor = useCallback((target: NoteFile | undefined) => {
    const out: { id: string; title: string; snippet: string }[] = [];
    if (!target) return out;
    const needle = '[[' + target.title.toLowerCase();
    all.forEach((f) => {
      if (f.id === target.id) return;
      const flat = bodyOf(f).replace(/<[^>]+>/g, ' ');
      const idx = flat.toLowerCase().indexOf(needle);
      if (idx === -1) return;
      const snip = flat.slice(Math.max(0, idx - 24), idx + needle.length + 26).replace(/\s+/g, ' ').trim();
      out.push({ id: f.id, title: f.title, snippet: '…' + snip + '…' });
    });
    return out;
  }, [all, bodyOf]);
  const backlinks = useMemo(() => backlinksFor(active), [backlinksFor, active, state.sources, state.eml]);
  const secondaryBacklinks = useMemo(
    () => backlinksFor(secondaryFile),
    [backlinksFor, secondaryFile, state.sources, state.eml],
  );

  // unlinked mentions — a full-vault text scan, so only computed while the context rail
  // (its sole consumer) is actually visible.
  const railVisible = showRightSidebar && !state.railHidden;
  const unlinked = useMemo(() => {
    const out: { id: string; title: string; snippet: string }[] = [];
    if (active && railVisible) {
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
  }, [active, all, bodyOf, railVisible, state.sources, state.eml]);

  // graph — scans every note body for wiki links, so only computed while the modal is open
  const graph = useMemo(() => {
    if (!state.graphOpen) return { nodes: [], edges: [] };
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
  }, [all, bodyOf, state.activeId, state.graphOpen, state.sources, state.eml]);

  // command palette results — full-text search across the vault, only while it's open
  const paletteResults = useMemo(() => {
    if (!state.paletteOpen) return [];
    const trimmed = state.paletteQuery.trim();
    // A `@daily` prefix scopes both the title and text search to notes in the daily folder
    // only — stripped before matching, so the rest of the query behaves identically.
    const dailyOnly = /^@daily\b/i.test(trimmed);
    const q = (dailyOnly ? trimmed.replace(/^@daily\s*/i, '') : trimmed).toLowerCase();
    const scope = dailyOnly ? all.filter((f) => f.folder === (stateRef.current.dailyFolder || 'Daily')) : all;
    const titleHits = scope.filter((f) => !q || f.title.toLowerCase().includes(q) || f.file.toLowerCase().includes(q));
    const fileResults = titleHits.map((f) => ({
      kind: 'file' as const, id: f.id, title: f.title, hint: f.folder, icon: f.type.toUpperCase(),
    }));
    const textResults: { kind: 'text'; id: string; title: string; hint: string; icon: string }[] = [];
    if (q) {
      const titleIds = new Set(titleHits.map((f) => f.id));
      scope.forEach((f) => {
        if (titleIds.has(f.id)) return;
        const body = bodyOf(f).replace(/<[^>]+>/g, ' ');
        const idx = body.toLowerCase().indexOf(q);
        if (idx < 0) return;
        const snip = body.slice(Math.max(0, idx - 22), idx + 32).replace(/\s+/g, ' ').trim();
        textResults.push({ kind: 'text', id: f.id, title: f.title, hint: '…' + snip + '…', icon: '⌕' });
      });
    }
    // Skip commands while in the @daily scoped-search flow — the user is clearly searching,
    // not looking to run a command.
    const cmds = dailyOnly ? [] : [
      { title: 'New Markdown Note', run: 'newNote' },
      { title: "Open Today's Daily Note", run: 'openDaily' },
      { title: 'Search Daily Notes', run: 'searchDaily' },
      { title: 'Generate Weekly Review', run: 'weeklyReview' },
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
  }, [all, bodyOf, state.paletteOpen, state.paletteQuery, state.sources, state.eml]);

  const runPaletteResult = useCallback((r: { kind: string; id: string }) => {
    if (r.kind === 'file' || r.kind === 'text') { setState({ paletteOpen: false }); open(r.id); return; }
    // Unlike the other commands, this one keeps the palette open — it's priming a scoped
    // search, not finishing an action — and refocuses the input so typing resumes seamlessly.
    if (r.id === 'searchDaily') {
      setState({ paletteQuery: '@daily ', paletteIdx: 0 });
      setTimeout(() => { try { paletteInputRef.current?.focus(); } catch { /* ignore */ } }, 20);
      return;
    }
    setState({ paletteOpen: false });
    switch (r.id) {
      case 'newNote': openOrCreate('Untitled ' + (stateRef.current.dynamicFiles.length + 1)); break;
      case 'openDaily': openDaily(); break;
      case 'weeklyReview': generateWeeklyReview(); break;
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
  }, [generateWeeklyReview, open, openAddTask, openDaily, openOrCreate, openTaskManager, setState]);

  // find & replace — targets whichever pane is focused (same as onSourceInput), not always
  // the primary file, since findNextFn below already implicitly follows focus via sourceElRef.
  const editingFile = fileOf(focusedId);
  let findCount = '';
  if (state.findQuery && editingFile && (editingFile.type === 'md' || editingFile.type === 'html')) {
    try {
      const re = state.findRegex ? new RegExp(state.findQuery, 'g') : new RegExp(escapeRegExp(state.findQuery), 'g');
      const m = (state.sources[editingFile.id] || '').match(re);
      findCount = (m ? m.length : 0) + ' found';
    } catch { findCount = 'bad regex'; }
  }
  const replaceAllFn = useCallback(() => {
    const a = fileOf(focusedNoteId());
    if (!a || !stateRef.current.findQuery) return;
    try {
      const re = stateRef.current.findRegex ? new RegExp(stateRef.current.findQuery, 'g') : new RegExp(escapeRegExp(stateRef.current.findQuery), 'g');
      setSource(a.id, (stateRef.current.sources[a.id] || '').replace(re, stateRef.current.replaceQuery));
    } catch { /* ignore */ }
  }, [fileOf, focusedNoteId, setSource]);
  const findNextFn = useCallback(() => {
    const s = stateRef.current;
    // Same focus resolution as findCount/replaceAllFn above — find-next must act on the
    // pane being searched, not always the primary one, and honor the regex toggle.
    const el = (s.secondaryFocused && s.secondaryId) ? sourceElRef2.current : sourceElRef.current;
    if (!el || !s.findQuery) return;
    let re: RegExp;
    try {
      re = s.findRegex ? new RegExp(s.findQuery, 'g') : new RegExp(escapeRegExp(s.findQuery), 'g');
    } catch { return; }
    const txt = el.value;
    re.lastIndex = el.selectionEnd || 0;
    let m = re.exec(txt);
    if (!m || !m[0].length) { re.lastIndex = 0; m = re.exec(txt); }
    if (m && m[0].length) { el.focus(); el.setSelectionRange(m.index, m.index + m[0].length); }
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
  // canHistory drives the primary breadcrumb's History button; the modal itself keys off
  // historyTargetId (falling back to the active file) so the split pane's breadcrumb can
  // open history for the secondary file.
  const canHistory = !!active && (isMd || isHtml);
  const secondaryCanHistory = !!secondaryFile && (secondaryDoc.isMd || secondaryDoc.isHtml);
  const historyFile = fileOf(state.historyTargetId ?? state.activeId);
  const hid = historyFile ? historyFile.id : null;
  const canShowHistory = !!historyFile && (historyFile.type === 'md' || historyFile.type === 'html');
  const hist = (hid && state.history[hid]) || [];
  const curText = canShowHistory && hid ? (state.sources[hid] || '') : '';
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

  // distinct frontmatter `type` values and `extra` key names seen across the vault —
  // used only to populate smart-filter datalist suggestions, same role tagCount plays for tags.
  const conceptTypeOptions = useMemo(() => {
    const s = new Set<string>();
    all.forEach((f) => { const t = fileFrontMatter(f.id).type; if (t) s.add(t); });
    return [...s].sort();
  }, [all, fileFrontMatter]);
  const frontmatterKeyOptions = useMemo(() => {
    const s = new Set<string>();
    all.forEach((f) => Object.keys(fileFrontMatter(f.id).extra).forEach((k) => s.add(k)));
    return [...s].sort();
  }, [all, fileFrontMatter]);

  // folders + note ordering
  const orderIndex = useMemo(() => {
    const m = new Map<string, number>();
    state.noteOrder.forEach((id, i) => m.set(id, i));
    return m;
  }, [state.noteOrder]);
  const orderIdx = useCallback((id: string) => orderIndex.get(id) ?? Number.MAX_SAFE_INTEGER, [orderIndex]);

  // Grouped once per files/order change instead of filtering `all` on every childrenOf
  // call — the sidebar calls it per visible row, which was O(rows × files) per render.
  const childrenByParent = useMemo(() => {
    const m = new Map<string, NoteFile[]>();
    all.forEach((f) => {
      if (!f.parent) return;
      const list = m.get(f.parent) || [];
      list.push(f);
      m.set(f.parent, list);
    });
    m.forEach((list) => list.sort((a, b) => orderIdx(a.id) - orderIdx(b.id)));
    return m;
  }, [all, orderIdx]);

  const childrenOf = useCallback(
    (pid: string) => childrenByParent.get(pid) || [],
    [childrenByParent],
  );

  // Set-lookup companion to state.dynamicFiles for per-row checks in the sidebar.
  const dynamicIds = useMemo(() => new Set(state.dynamicFiles.map((f) => f.id)), [state.dynamicFiles]);

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
    const fDot = f.file.lastIndexOf('.');
    const file = slug(title) + (fDot === -1 ? '' : f.file.slice(fDot));
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
      case 'conceptType': return (fileFrontMatter(f.id).type || '').toLowerCase() === rule.value.toLowerCase();
      case 'frontmatterTitle': return (fileFrontMatter(f.id).title || '').toLowerCase().includes(rule.value.toLowerCase());
      case 'description': return (fileFrontMatter(f.id).description || '').toLowerCase().includes(rule.value.toLowerCase());
      case 'resource': return (fileFrontMatter(f.id).resource || '').toLowerCase().includes(rule.value.toLowerCase());
      case 'timestampAfter': return Date.parse(fileFrontMatter(f.id).timestamp || '') >= Date.parse(rule.value);
      case 'timestampBefore': return Date.parse(fileFrontMatter(f.id).timestamp || '') <= Date.parse(rule.value);
      case 'frontmatterKey': {
        const sep = rule.value.indexOf(':');
        const key = (sep === -1 ? rule.value : rule.value.slice(0, sep)).trim();
        const needle = (sep === -1 ? '' : rule.value.slice(sep + 1)).trim().toLowerCase();
        const extraValue = fileFrontMatter(f.id).extra[key];
        if (extraValue === undefined) return false;
        return needle === '' || extraValue.toLowerCase().includes(needle);
      }
      default: return true;
    }
  }, [bodyOf, fileTags, fileFrontMatter]);

  // Takes customFilters explicitly (rather than closing over state.customFilters) so callers
  // that just created a custom filter in the same tick (applyFilter, below) can pass the fresh
  // list threaded through their own setState updater instead of last render's stale one.
  const matchesFilterKeyIn = useCallback((f: NoteFile, k: string, customFilters: CustomFilter[]): boolean => {
    if (k === 'all') return true;
    if (k === 'pinned') return f.pinned;
    if (k === 'markdown') return f.type === 'md';
    if (k === 'html') return f.type === 'html';
    if (k === 'email') return f.type === 'eml';
    if (k.startsWith('tag:')) return fileTags(f.id).includes(k.slice(4));
    if (k.startsWith('custom:')) {
      const cf = customFilters.find((c) => c.id === k.slice(7));
      if (!cf || !cf.rules.length) return true;
      return cf.match === 'all' ? cf.rules.every((r) => matchesRule(f, r)) : cf.rules.some((r) => matchesRule(f, r));
    }
    return true;
  }, [fileTags, matchesRule]);

  const pred = useCallback((f: NoteFile) => matchesFilterKeyIn(f, state.filter, state.customFilters), [matchesFilterKeyIn, state.filter, state.customFilters]);

  // Applying a filter should immediately reveal its matches — force-expand every folder
  // (and, for nested docs, every ancestor note) that contains at least one matching file,
  // instead of leaving a previously-collapsed folder/doc hiding the only visible result.
  const applyFilter = useCallback((key: string, extra?: Partial<FullState>) => {
    setState((s) => {
      const nextExpanded = { ...s.expandedDocs };
      if (key !== 'all') {
        all.forEach((f) => {
          if (!matchesFilterKeyIn(f, key, s.customFilters)) return;
          let p: string | undefined = f.folder;
          while (p) { nextExpanded['folder:' + p] = true; p = folderParentPath(p); }
          let pid = f.parent;
          while (pid) {
            const pf = fileOf(pid);
            if (!pf) break;
            nextExpanded[pid] = true;
            pid = pf.parent;
          }
        });
      }
      return { filter: key, expandedDocs: nextExpanded, ...extra };
    });
  }, [all, matchesFilterKeyIn, fileOf, setState]);

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
    // Group visible root notes by folder up front — filtering `all` once instead of once
    // per folder node.
    const rootsByFolder = new Map<string, NoteFile[]>();
    all.forEach((f) => {
      if (f.parent || !pred(f)) return;
      const list = rootsByFolder.get(f.folder) || [];
      list.push(f);
      rootsByFolder.set(f.folder, list);
    });
    rootsByFolder.forEach((list) => list.sort((a, b) => orderIdx(a.id) - orderIdx(b.id)));
    const build = (parent: string | undefined): FolderNode[] => (byParent.get(parent) || []).map((path) => ({
      path,
      name: folderLeafName(path),
      roots: rootsByFolder.get(path) || [],
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
    const segs: { label: string; title: string; id?: string; path?: string; current: boolean }[] = [];
    const folderParts = active.folder.split('/');
    folderParts.forEach((part, i) => {
      const prefixPath = folderParts.slice(0, i + 1).join('/');
      segs.push({ label: part, title: 'Folder · ' + prefixPath, path: prefixPath, current: false });
    });
    ancestors.forEach((a) => segs.push({ label: a.title, title: a.file, id: a.id, current: false }));
    segs.push({ label: active.file, title: active.file, current: true });
    return segs;
  }, [active, fileOf]);

  // breadcrumb for the split (secondary) pane — mirrors pathSegments but for secondaryFile,
  // so the preview column can render its own breadcrumb row (matching the design handoff).
  const secondaryPathSegments = useMemo(() => {
    if (!secondaryFile) return [];
    const ancestors: NoteFile[] = [];
    let p = secondaryFile.parent;
    while (p) { const pf = fileOf(p); if (!pf) break; ancestors.unshift(pf); p = pf.parent; }
    const segs: { label: string; title: string; id?: string; path?: string; current: boolean }[] = [];
    const folderParts = secondaryFile.folder.split('/');
    folderParts.forEach((part, i) => {
      const prefixPath = folderParts.slice(0, i + 1).join('/');
      segs.push({ label: part, title: 'Folder · ' + prefixPath, path: prefixPath, current: false });
    });
    ancestors.forEach((a) => segs.push({ label: a.title, title: a.file, id: a.id, current: false }));
    segs.push({ label: secondaryFile.file, title: secondaryFile.file, current: true });
    return segs;
  }, [secondaryFile, fileOf]);

  const secondaryActiveTags = secondaryDoc.activeTags;

  // secondary (split) pane — the linked partner is always shown read-only (preview), so this
  // only carries what PreviewPane/PathBar/StatusBar need, not an editable source.
  const secondary = {
    id: state.secondaryId,
    file: secondaryFile,
    isMd: secondaryDoc.isMd,
    isHtml: secondaryDoc.isHtml,
    isEml: secondaryDoc.isEml,
    isPdf: secondaryDoc.isPdf,
    isImage: secondaryDoc.isImage,
    sourceValue: secondaryDoc.sourceValue,
    mdHtml: secondaryDoc.mdHtml,
    emlData: secondaryDoc.emlData,
    words: secondaryDoc.words,
    frontMatter: secondaryDoc.frontMatter,
    backlinks: secondaryBacklinks,
    previewElRef: previewElRef2,
    onPreviewClick: onPreviewClickSecondary,
    sourceElRef: sourceElRef2,
    onSourceInput: onSourceInputSecondary,
    showSource: secondaryShowSource,
    showPreview: secondaryShowPreview,
  };

  return {
    state, setState, stateRef,
    all, fileOf, fileTags, allFiles: all,
    badgeColors, typeLabels,
    active, isMd, isHtml, isEml, isPdf, isImage, showSource, showPreview, currentView, setView,
    sourceValue, mdHtml, outline, words, activeTags, frontMatter, emlData,
    backlinks, backlinkCount: backlinks.length, unlinked, graph, paletteResults, runPaletteResult,
    findCount, replaceAllFn, findNextFn,
    suggestItems, suggestTitle, pickSuggest,
    canHistory, historyFile, historyList: hist, snap, diffRows, saveSnapshot, restore,
    recentDocs, recentlyCreated, tagCount, fileFrontMatter, conceptTypeOptions, frontmatterKeyOptions, folderTree, pathSegments,
    secondaryPathSegments, secondaryActiveTags, secondaryCanHistory,
    pinnedFiles, pinnedFolderPaths,
    accent: ACCENT, accentSoft: ACCENT_SOFT,
    showRightSidebar,
    // refs
    sourceElRef, previewElRef, paletteInputRef, addTaskInputRef, dailyCaptureInputRef,
    // split pane
    secondary, openSplit, closeSplitPane, pairTabs, reorderTab,
    // actions
    open, closeTab, closeAllTabs, closeOtherTabs, touch, setSource, setEml, aiGenerate, toggleTask, openOrCreate,
    tasks, taskCounts,
    openAddTask, closeAddTask, saveAddTask, addTaskLine, openTaskManager, openFolder, ensureDaily, openDaily, dailyNoteId,
    openDailyCapture, closeDailyCapture, appendDaily, saveDailyCapture, openDailyFor, undoLastCapture, dismissToast,
    generateWeeklyReview,
    currentExportHtml, exportPrint, exportDownload, exportDoc, exportCopyHtml,
    onPreviewClick, onSourceInput, scrollTo, selectPreviewTextInSource,
    openInBrowser,
    agoLabel,
    childrenOf, dynamicIds, newFile, duplicateFile, moveFileTo, deleteFile, toggleExpand, pickVaultRoot, refreshVault,
    reorderNote, reorderFolder, depthOf, renameFile, collapseAllFolders, createFolder,
    createCustomFilter, updateCustomFilter, deleteCustomFilter, openSmartFilterCreator, closeSmartFilterModal, applyFilter,
    customFilterCounts, togglePinFile, togglePinFolder, revealFile, revealFolder,
    allFolderNames: state.folderOrder,
    maxFolderDepth: MAX_FOLDER_DEPTH,
    isTauri: isTauri(),
    htmlToMd,
  };
}

export type NotesAppVM = ReturnType<typeof useNotesApp>;
export type { ViewMode, HtmlWidth };
