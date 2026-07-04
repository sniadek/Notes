import {
  eml as seedEml, files as seedFiles, folderOrder as seedFolderOrder, history as seedHistory, seedEditedAt, sources as seedSources,
} from '../seedData';
import type { CustomFilter, DocFontSize, DocWidth, EmlData, HistorySnapshot, NoteFile, ViewMode, HtmlWidth } from '../types';

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
  };
}

export function loadPersistedState(): PersistedState {
  const fallback = defaultPersistedState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

export function savePersistedState(state: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota errors */
  }
}
