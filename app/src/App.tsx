import { useNotesApp } from './hooks/useNotesApp';
import type { NotesAppVM } from './hooks/useNotesApp';
import type { ViewMode } from './types';
import Toolbar from './components/Toolbar';
import Sidebar from './components/Sidebar';
import TabBar from './components/TabBar';
import PathBar from './components/PathBar';
import EditorPane from './components/EditorPane';
import PreviewPane from './components/PreviewPane';
import StatusBar from './components/StatusBar';
import ContextRail from './components/ContextRail';
import FindReplace from './components/FindReplace';
import SuggestPopup from './components/SuggestPopup';
import CommandPalette from './components/CommandPalette';
import HistoryModal from './components/HistoryModal';
import GraphModal from './components/GraphModal';
import AddTaskModal from './components/AddTaskModal';
import ShortcutsModal from './components/ShortcutsModal';
import SettingsModal from './components/SettingsModal';
import SmartFilterModal from './components/SmartFilterModal';
import TaskManagerPane from './components/TaskManagerPane';
import { TASK_MANAGER_ID } from './lib/tasks';

const SPLIT_VIEWS: { k: ViewMode; label: string }[] = [
  { k: 'edit', label: 'edit' },
  { k: 'split', label: 'split' },
  { k: 'preview', label: 'preview' },
];

function SplitPaneHeader({ vm }: { vm: NotesAppVM }) {
  const { secondary, badgeColors, setState, closeSplitPane } = vm;
  if (!secondary.file) return null;
  const bc = badgeColors[secondary.file.type];
  return (
    <div style={{ display: 'flex', alignItems: 'center', height: 40, padding: '0 12px', gap: 10, borderBottom: '1px solid var(--border)', background: '#faf9f7', flex: 'none' }}>
      <span style={{ font: '600 8px ui-monospace,Menlo,monospace', padding: '1px 3px', borderRadius: 3, color: bc.c, background: bc.b, flex: 'none' }}>{secondary.file.type.toUpperCase()}</span>
      <span style={{ font: '12px/1 ui-monospace,Menlo,monospace', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{secondary.file.file}</span>
      <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderRadius: 8, padding: 2, font: '500 10.5px ui-monospace,Menlo,monospace', marginLeft: 'auto', flex: 'none' }}>
        {SPLIT_VIEWS.map((v) => (
          <span
            key={v.k}
            onClick={() => setState({ secondaryView: v.k })}
            style={{
              padding: '3px 9px', borderRadius: 6, cursor: 'pointer',
              ...(secondary.view === v.k ? { background: 'var(--bg-surface)', color: 'var(--text-primary)' } : { color: 'var(--text-muted)' }),
            }}
          >
            {v.label}
          </span>
        ))}
      </div>
      <span
        onClick={closeSplitPane}
        title="Close split pane"
        style={{ color: 'var(--text-faint)', fontSize: 13, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, cursor: 'pointer', flex: 'none' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,.08)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-faint)'; }}
      >
        ×
      </span>
    </div>
  );
}

export default function App() {
  const vm = useNotesApp(true);
  const railVisible = !vm.state.railHidden && vm.showRightSidebar && !!vm.active;
  const cowork = vm.state.design === 'cowork' || vm.state.design === 'cowork-plus';
  const secondaryShowSource = !!vm.secondary.file && (vm.secondary.view === 'edit' || vm.secondary.view === 'split');
  const secondaryShowPreview = !!vm.secondary.file && (vm.secondary.view === 'preview' || vm.secondary.view === 'split');

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}>
      <Toolbar vm={vm} />

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Sidebar vm={vm} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg-surface)', position: 'relative' }}>
          <TabBar vm={vm} />

          {vm.state.activeId === TASK_MANAGER_ID
            ? <TaskManagerPane vm={vm} />
            : vm.active
              ? (
                <>
                  <PathBar vm={vm} />
                  <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                    {vm.showSource && <EditorPane vm={vm} />}
                    {vm.showPreview && <PreviewPane vm={vm} />}
                  </div>
                  <StatusBar vm={vm} />
                </>
              )
              : (
                <div
                  style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: 'var(--text-faintest)',
                    ...(cowork ? { backgroundImage: 'var(--dot-grid)', backgroundSize: '22px 22px' } : {}),
                  }}
                >
                  <div style={{ fontSize: 34, color: cowork ? 'var(--accent)' : undefined }}>⌘</div>
                  <div style={{ font: cowork ? '400 22px var(--font-serif)' : '400 14px -apple-system,system-ui', color: cowork ? 'var(--text-primary)' : undefined }}>No note open</div>
                  <div
                    onClick={() => vm.setState({ paletteOpen: true, paletteQuery: '', paletteIdx: 0 })}
                    style={cowork
                      ? {
                          font: '500 12.5px -apple-system,system-ui', color: 'var(--text-secondary)', cursor: 'pointer',
                          background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)',
                          padding: '10px 22px', boxShadow: 'var(--shadow-modal)',
                        }
                      : { font: '500 12.5px -apple-system,system-ui', color: 'var(--accent)', cursor: 'pointer' }}
                  >
                    Press ⌘K to open a file
                  </div>
                </div>
              )}

          <FindReplace vm={vm} />
          <SuggestPopup vm={vm} />
        </div>

        {vm.secondary.file && (
          <>
            <div style={{ width: 1, background: 'var(--border)', flex: 'none' }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg-surface)' }}>
              <SplitPaneHeader vm={vm} />
              <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                {secondaryShowSource && <EditorPane vm={vm} pane="secondary" />}
                {secondaryShowPreview && <PreviewPane vm={vm} pane="secondary" />}
              </div>
            </div>
          </>
        )}

        {railVisible && <ContextRail vm={vm} />}
      </div>

      <CommandPalette vm={vm} />
      <HistoryModal vm={vm} />
      <GraphModal vm={vm} />
      <AddTaskModal vm={vm} />
      <ShortcutsModal vm={vm} />
      <SettingsModal vm={vm} />
      <SmartFilterModal vm={vm} />
    </div>
  );
}
