import {
  eml as seedEml, files as seedFiles, folderOrder as seedFolderOrder, history as seedHistory, seedEditedAt, sources as seedSources,
} from '../seedData';
import type { CustomFilter, DocFontSize, DocWidth, EmlData, HistorySnapshot, NoteFile, ViewMode, HtmlWidth } from '../types';
import { DEFAULT_DAILY_TEMPLATE } from './utils';

const STORAGE_KEY = 'notes-app:v1';

// Seeded into a fresh vault's customFilters so the built-in "All Notes / Markdown / HTML /
// Email Templates" views are ordinary smart filters — editable, deletable, reorderable like
// any user-created one — instead of a separate hardcoded list. Fixed ids so code that needs
// to recognize them (e.g. the "always show empty folders" case below) can do so reliably.
export const DEFAULT_SMART_FILTERS: CustomFilter[] = [
  { id: 'default-all', label: 'All Notes', color: '#8a8a93', match: 'all', rules: [] },
  { id: 'default-markdown', label: 'Markdown', color: '#6c7686', match: 'all', rules: [{ field: 'type', value: 'md' }] },
  { id: 'default-html', label: 'HTML', color: '#b5651d', match: 'all', rules: [{ field: 'type', value: 'html' }] },
  { id: 'default-email', label: 'Email Templates', color: '#3a6ea5', match: 'all', rules: [{ field: 'type', value: 'eml' }] },
];

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
  // One-time migration marker: true once DEFAULT_SMART_FILTERS has been merged into an
  // existing vault's customFilters (see loadPersistedState). Without this, a vault saved
  // before the built-ins became ordinary CustomFilter records would load with an empty (or
  // built-in-less) customFilters array and silently lose the "All Notes / Markdown / HTML /
  // Email Templates" filters that used to be hardcoded. Gating on this flag makes the merge
  // run exactly once, so intentionally deleting a built-in filter later doesn't un-delete it
  // on the next load.
  builtinFiltersSeeded: boolean;
}

export function defaultPersistedState(): PersistedState {
  return {
    collapsed: false,
    railHidden: false,
    defaultView: 'preview',
    viewByNote: {},
    activeId: 'api',
    secondaryId: null,
    openTabs: ['api', 'landing', 'q2'],
    filter: 'custom:default-all',
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
    customFilters: [...DEFAULT_SMART_FILTERS],
    pinnedFolders: [],
    dailyFolder: 'Daily',
    dailyTemplate: DEFAULT_DAILY_TEMPLATE,
    dailyPrompts: [],
    dailyCarryOverTasks: false,
    dailyGlobalShortcut: 'CommandOrControl+Shift+J',
    builtinFiltersSeeded: true,
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
    const merged = { ...fallback, ...parsed };
    // Existing vault saved before the built-in filters became CustomFilter records: merge
    // in whichever defaults aren't already present (by id), once. See builtinFiltersSeeded.
    // Checked on the raw `parsed` blob, not `merged` — a blob that predates this field
    // entirely is missing the key, and spreading `...parsed` over `fallback` (whose default
    // is `true`) would silently leave `merged.builtinFiltersSeeded` true and skip this.
    if (!parsed.builtinFiltersSeeded) {
      const present = new Set(merged.customFilters.map((c) => c.id));
      const missing = DEFAULT_SMART_FILTERS.filter((d) => !present.has(d.id));
      merged.customFilters = [...missing, ...merged.customFilters];
      merged.builtinFiltersSeeded = true;
    }
    return merged;
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
