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
import CaptureModal from './components/CaptureModal';
import ShortcutsModal from './components/ShortcutsModal';
import SettingsModal from './components/SettingsModal';

export default function App() {
  const vm = useNotesApp(true);
  const railVisible = !vm.state.railHidden && vm.showRightSidebar && !!vm.active;
  const cowork = vm.state.design === 'cowork' || vm.state.design === 'cowork-plus';

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}>
      <Toolbar vm={vm} />

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Sidebar vm={vm} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg-surface)', position: 'relative' }}>
          <TabBar vm={vm} />

          {vm.active
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

        {railVisible && <ContextRail vm={vm} />}
      </div>

      <CommandPalette vm={vm} />
      <HistoryModal vm={vm} />
      <GraphModal vm={vm} />
      <CaptureModal vm={vm} />
      <ShortcutsModal vm={vm} />
      <SettingsModal vm={vm} />
    </div>
  );
}
