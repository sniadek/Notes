import {
  eml as seedEml, files as seedFiles, folderOrder as seedFolderOrder, history as seedHistory, seedEditedAt, sources as seedSources,
} from '../seedData';
import type { CustomFilter, DocFontSize, DocWidth, EmlData, HistorySnapshot, NoteFile, ViewMode, HtmlWidth } from '../types';
import { DEFAULT_DAILY_TEMPLATE } from './utils';

const STORAGE_KEY = 'notes-app:v1';

export type Design = 'default' | 'cowork' | 'cowork-plus' | 'midnight';

export interface PersistedState {
  collapsed: boolean;
  railHidden: boolean;
  // App-wide fallback for tabs that haven't been individually switched (Settings > Default
  // view). Per-tab overrides live in viewByNote, keyed by note id — view mode must be per-tab,
  // not global, so switching focus between two panes doesn't carry one's mode onto the other.
  defaultView: ViewMode;
  viewByNote: Record<string, ViewMode>;
  activeId: string | null;
  secondaryId: string | null;
  openTabs: string[];
  filter: string;
  expandedDocs: Record<string, boolean>;
  editedAt: Record<string, number>;
  dynamicFiles: NoteFile[];
  sources: Record<string, string>;
  eml: Record<string, EmlData>;
  history: Record<string, HistorySnapshot[]>;
  wiki: boolean;
  autosave: boolean;
  htmlWidth: HtmlWidth;
  docWidth: DocWidth;
  docFontSize: DocFontSize;
  vaultRoot: string | null;
  design: Design;
  folderOrder: string[];
  noteOrder: string[];
  fileMoves: Record<string, Partial<Pick<NoteFile, 'folder' | 'parent' | 'path' | 'title' | 'file' | 'pinned'>>>;
  createdAt: Record<string, number>;
  customFilters: CustomFilter[];
  pinnedFolders: string[];
  // Daily-note capture config. dailyFolder is the vault folder new daily notes land in;
  // dailyTemplate is the seed content for a freshly created day, with {{date}}/{{weekday}}/
  // {{time}} tokens expanded by renderDailyTemplate.
  dailyFolder: string;
  dailyTemplate: string;
  // Optional checklist prompts seeded into every newly created day (feature 5).
  dailyPrompts: string[];
  // When true, a new day's note pulls forward unchecked `- [ ]` Tasks lines from the
  // previous day's note, if one exists (feature 7) — never auto-creates the previous day.
  dailyCarryOverTasks: boolean;
  // OS-level accelerator string (Tauri format, e.g. "CommandOrControl+Shift+J") for the
  // global quick-capture popup (feature 9) — desktop-only, ignored in the browser preview.
  dailyGlobalShortcut: string;
}

export function defaultPersistedState(): PersistedState {
  return {
    collapsed: false,
    railHidden: false,
    defaultView: 'split',
    viewByNote: {},
    activeId: 'api',
    secondaryId: null,
    openTabs: ['api', 'landing', 'q2'],
    filter: 'all',
    expandedDocs: { api: true, roadmap: true },
    editedAt: seedEditedAt(),
    dynamicFiles: [],
    sources: { ...seedSources },
    eml: { ...seedEml },
    history: { ...seedHistory },
    wiki: true,
    autosave: true,
    htmlWidth: 'desktop',
    docWidth: 'full',
    docFontSize: 'medium',
    vaultRoot: null,
    design: 'default',
    folderOrder: [...seedFolderOrder],
    noteOrder: seedFiles.map((f) => f.id),
    fileMoves: {},
    createdAt: {},
    customFilters: [],
    pinnedFolders: [],
    dailyFolder: 'Daily',
    dailyTemplate: DEFAULT_DAILY_TEMPLATE,
    dailyPrompts: [],
    dailyCarryOverTasks: false,
    dailyGlobalShortcut: 'CommandOrControl+Shift+J',
  };
}

// Light shape check on the stored blob: a corrupt or ancient payload should fall back to
// defaults rather than flow malformed values straight into runtime state.
function looksValid(p: unknown): p is Partial<PersistedState> {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return false;
  const o = p as Record<string, unknown>;
  const okArray = (k: string) => o[k] === undefined || Array.isArray(o[k]);
  const okRecord = (k: string) => o[k] === undefined || (typeof o[k] === 'object' && o[k] !== null && !Array.isArray(o[k]));
  return okArray('openTabs') && okArray('dynamicFiles') && okArray('folderOrder') && okArray('noteOrder')
    && okArray('customFilters') && okArray('pinnedFolders') && okArray('dailyPrompts')
    && okRecord('sources') && okRecord('eml') && okRecord('history') && okRecord('fileMoves')
    && okRecord('editedAt') && okRecord('createdAt') && okRecord('expandedDocs') && okRecord('viewByNote');
}

export function loadPersistedState(): PersistedState {
  const fallback = defaultPersistedState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!looksValid(parsed)) return fallback;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

// Returns false on failure (typically QuotaExceededError) so callers can surface it —
// a silent persistence failure means edits that only live in localStorage evaporate on
// the next launch.
export function savePersistedState(state: PersistedState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
