import { useEffect, useState } from 'react';
import { VAULT_POLL_MS, type NotesAppVM } from '../hooks/useNotesApp';

function SyncCountdown({ lastSyncedAt }: { lastSyncedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const remaining = Math.max(0, Math.ceil((lastSyncedAt + VAULT_POLL_MS - now) / 1000));
  return <span> · next check in {remaining}s</span>;
}

export default function StatusBar({ vm, pane = 'primary' }: { vm: NotesAppVM; pane?: 'primary' | 'secondary' }) {
  const { typeLabels, state, isTauri } = vm;
  const secondary = pane === 'secondary';
  const file = secondary ? vm.secondary.file : vm.active;
  const words = secondary ? vm.secondary.words : vm.words;
  const backlinks = secondary ? vm.secondary.backlinks : vm.backlinks;
  const showCountdown = isTauri && !!state.vaultRoot && !!state.lastSyncedAt;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, height: 26, flex: 'none', background: 'var(--bg-bar)', borderTop: '1px solid var(--border)', padding: '0 18px', font: '11px ui-monospace,Menlo,monospace', color: 'var(--text-tertiary)' }}>
      <span>{file ? typeLabels[file.type] : ''}</span>
      <span>UTF-8</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#1a8a4f' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#28b463' }} />
        Synced
        {showCountdown && <SyncCountdown lastSyncedAt={state.lastSyncedAt!} />}
      </span>
      <span style={{ marginLeft: 'auto' }}>{backlinks.length} backlinks</span>
      <span>{words} words</span>
    </div>
  );
}
