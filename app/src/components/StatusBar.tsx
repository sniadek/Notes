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

export default function StatusBar({ vm }: { vm: NotesAppVM }) {
  const {
    active, typeLabels, words, backlinks, state, isTauri,
  } = vm;
  const showCountdown = isTauri && !!state.vaultRoot && !!state.lastSyncedAt;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, height: 26, flex: 'none', background: '#faf9f7', borderTop: '1px solid rgba(0,0,0,.06)', padding: '0 18px', font: '11px ui-monospace,Menlo,monospace', color: 'var(--text-tertiary)' }}>
      <span>{active ? typeLabels[active.type] : ''}</span>
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
