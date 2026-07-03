export type FileType = 'md' | 'html' | 'eml';

export interface NoteFile {
  id: string;
  title: string;
  file: string;
  type: FileType;
  folder: string;
  pinned: boolean;
  parent?: string;
  path?: string;
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
export type DocWidth = 'comfortable' | 'full';
export type DocFontSize = 'small' | 'medium' | 'large' | 'xlarge';

export type FilterField = 'type' | 'tag' | 'folder' | 'pinned' | 'text' | 'filename' | 'createdAfter' | 'createdBefore';

export interface FilterRule {
  field: FilterField;
  value: string;
}

export interface CustomFilter {
  id: string;
  label: string;
  color: string;
  match: 'all' | 'any';
  rules: FilterRule[];
}

export interface AppState {
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
  design: 'default' | 'cowork' | 'cowork-plus' | 'midnight';
  folderOrder: string[];
  noteOrder: string[];
  fileMoves: Record<string, Partial<Pick<NoteFile, 'folder' | 'parent' | 'path' | 'title' | 'file' | 'pinned'>>>;
  createdAt: Record<string, number>;
  customFilters: CustomFilter[];
  pinnedFolders: string[];
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

export type TaskPriority = 'low' | 'medium' | 'high';

export interface ParsedTask {
  id: string;
  fileId: string;
  fileTitle: string;
  folder: string;
  line: number;
  done: boolean;
  text: string;
  due?: string;
  priority?: TaskPriority;
}
