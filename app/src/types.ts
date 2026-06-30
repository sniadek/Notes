export type FileType = 'md' | 'html' | 'eml';

export interface NoteFile {
  id: string;
  title: string;
  file: string;
  type: FileType;
  folder: string;
  pinned: boolean;
  parent?: string;
}

export interface HistorySnapshot {
  ts: string;
  text: string;
}

export interface EmlData {
  from: string;
  to: string;
  subject: string;
  body: string;
}

export interface Backlink {
  id: string;
  title: string;
  snippet: string;
}

export type ViewMode = 'edit' | 'split' | 'preview';
export type HtmlWidth = 'desktop' | 'tablet' | 'mobile';

export interface AppState {
  collapsed: boolean;
  railHidden: boolean;
  view: ViewMode;
  activeId: string | null;
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
}

export interface DiffRow {
  t: 'same' | 'add' | 'del';
  v: string;
}

export interface OutlineItem {
  level: number;
  text: string;
  id: string;
}
