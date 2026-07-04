import { useNotesApp } from './hooks/useNotesApp';
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
import ResizeHandles from './components/ResizeHandles';
import { TASK_MANAGER_ID } from './lib/tasks';

export default function App() {
  const vm = useNotesApp(true);
  const railVisible = !vm.state.railHidden && vm.showRightSidebar && !!vm.active;
  const cowork = vm.state.design === 'cowork' || vm.state.design === 'cowork-plus';
  const hasSplit = !!vm.secondary.file;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}>
      <ResizeHandles />
      <Toolbar vm={vm} />

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Sidebar vm={vm} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg-surface)', position: 'relative' }}>
          {/* Single tab bar shared across the editor + split (preview) columns. */}
          <TabBar vm={vm} />

          {vm.state.activeId === TASK_MANAGER_ID
            ? <TaskManagerPane vm={vm} />
            : vm.active
              ? (() => {
                // Focus (secondaryFocused) no longer gates which pane can show editable source —
                // each pane renders purely from its own stored view mode (showSource/showPreview,
                // both already per-tab), so both can be independently in edit/split/preview at
                // once. Focus still decides which tab is bold in the tab bar and which one the
                // Toolbar's edit/split/preview buttons, Cmd+E, and Find & Replace act on.
                const secondaryFocused = hasSplit && vm.state.secondaryFocused;
                return (
                <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                  {/* Primary column — its own breadcrumb + panes + status bar. Interacting here
                      (while paired) moves the tab bar's highlight back to the primary tab. */}
                  <div
                    onMouseDown={() => { if (secondaryFocused) vm.setState({ secondaryFocused: false }); }}
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}
                  >
                    <PathBar vm={vm} />
                    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                      {vm.showSource && <EditorPane vm={vm} />}
                      {vm.showPreview && <PreviewPane vm={vm} />}
                    </div>
                    <StatusBar vm={vm} />
                  </div>

                  {/* Split (secondary) column — the linked partner file, permanently pinned to
                      the right, independently editable per its own mode. Interacting here moves
                      the tab bar's highlight (and Toolbar/Cmd+E/Find & Replace target) to it. */}
                  {hasSplit && (
                    <>
                      <div style={{ width: 1, background: 'var(--border)', flex: 'none' }} />
                      <div
                        onMouseDown={() => { if (!secondaryFocused) vm.setState({ secondaryFocused: true }); }}
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}
                      >
                        <PathBar vm={vm} pane="secondary" />
                        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                          {vm.secondary.showSource && <EditorPane vm={vm} pane="secondary" />}
                          {vm.secondary.showPreview && <PreviewPane vm={vm} pane="secondary" />}
                        </div>
                        <StatusBar vm={vm} pane="secondary" />
                      </div>
                    </>
                  )}
                </div>
                );
              })()
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
