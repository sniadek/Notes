import {
  eml as seedEml, files as seedFiles, folderOrder as seedFolderOrder, history as seedHistory, seedEditedAt, sources as seedSources,
} from '../seedData';
import type { CustomFilter, EmlData, HistorySnapshot, NoteFile, ViewMode, HtmlWidth } from '../types';

const STORAGE_KEY = 'notes-app:v1';

export type Design = 'default' | 'cowork' | 'cowork-plus';

export interface PersistedState {
  collapsed: boolean;
  railHidden: boolean;
  view: ViewMode;
  activeId: string | null;
  secondaryId: string | null;
  secondaryView: ViewMode;
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
    view: 'split',
    activeId: 'api',
    secondaryId: null,
    secondaryView: 'preview',
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
