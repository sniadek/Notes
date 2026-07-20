import { useState } from 'react';
import type { NotesAppVM } from '../hooks/useNotesApp';

export default function HistoryModal({ vm }: { vm: NotesAppVM }) {
  const { state, setState, historyFile, historyList, snap, diffRows, saveSnapshot, restore, accentSoft } = vm;
  const [saveHover, setSaveHover] = useState(false);
  const [closeHover, setCloseHover] = useState(false);

  if (!state.historyOpen) return null;

  const close = () => setState({ historyOpen: false, historyTargetId: null });

  const entries = [{ label: 'Current version', ts: 'now', idx: -1 }, ...historyList.map((h, i) => ({
    label: 'Version ' + (historyList.length - i), ts: h.ts, idx: i,
  }))];

  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(30,28,24,.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, animation: 'fade .12s ease' }}>
      <div role="dialog" aria-modal="true" aria-label="Version history" onClick={(e) => e.stopPropagation()} style={{ width: 760, maxWidth: '94vw', height: 560, maxHeight: '88vh', background: 'var(--bg-surface)', borderRadius: 14, boxShadow: 'var(--shadow-modal)', border: '1px solid var(--border)', overflow: 'hidden', animation: 'pop .14s ease', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ font: '600 15px -apple-system,system-ui', color: 'var(--text-primary)' }}>Version history · {historyFile ? historyFile.file : ''}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              onClick={saveSnapshot}
              onMouseEnter={() => setSaveHover(true)}
              onMouseLeave={() => setSaveHover(false)}
              style={{ font: '500 12px -apple-system,system-ui', color: 'var(--text-muted)', padding: '6px 11px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: saveHover ? 'var(--bg-subtle)' : 'transparent' }}
            >
              Save snapshot
            </span>
            <span
              onClick={close}
              onMouseEnter={() => setCloseHover(true)}
              onMouseLeave={() => setCloseHover(false)}
              style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer', background: closeHover ? 'var(--bg-subtle)' : 'transparent' }}
            >
              ×
            </span>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <div className="sc" tabIndex={0} style={{ width: 230, borderRight: '1px solid var(--border)', overflow: 'auto', padding: 9, flex: 'none' }}>
            {entries.map((h) => (
              <div
                key={h.idx}
                onClick={() => setState({ historyPick: h.idx })}
                style={{ padding: '9px 11px', borderRadius: 8, cursor: 'pointer', marginBottom: 2, background: h.idx === state.historyPick ? accentSoft : 'transparent' }}
              >
                <div style={{ font: '500 12.5px -apple-system,system-ui' }}>{h.label}</div>
                <div style={{ font: '11px ui-monospace,Menlo,monospace', color: 'var(--text-faintest)', marginTop: 2 }}>{h.ts}</div>
              </div>
            ))}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div className="sc" tabIndex={0} style={{ flex: 1, overflow: 'auto', padding: '14px 16px', font: '12.5px/1.65 ui-monospace,Menlo,monospace', background: 'var(--bg-subtle)' }}>
              {snap
                ? diffRows.map((d, i) => (
                  <div
                    key={i}
                    style={{
                      whiteSpace: 'pre-wrap', padding: '1px 6px', borderRadius: 3,
                      background: d.t === 'add' ? 'rgba(26,138,79,.12)' : d.t === 'del' ? 'rgba(192,57,43,.1)' : 'transparent',
                      color: d.t === 'add' ? 'var(--status-success)' : d.t === 'del' ? 'var(--status-danger)' : 'var(--text-muted)',
                    }}
                  >
                    {(d.t === 'add' ? '+ ' : d.t === 'del' ? '− ' : '  ') + d.v}
                  </div>
                ))
                : <div style={{ color: 'var(--text-faintest)', padding: 8 }}>This is the current version. Pick an older snapshot to compare.</div>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', borderTop: '1px solid var(--border)' }}>
              <span style={{ font: '11px -apple-system,system-ui', color: 'var(--text-tertiary)' }}>
                <span style={{ color: 'var(--status-success)' }}>+ added</span> · <span style={{ color: 'var(--status-danger)' }}>− removed</span> relative to current
              </span>
              <span
                onClick={snap ? restore : undefined}
                style={{
                  font: '500 12px -apple-system,system-ui', padding: '7px 14px', borderRadius: 8, cursor: snap ? 'pointer' : 'default',
                  background: snap ? 'oklch(0.5 0.12 var(--accent-hue))' : 'var(--bg-subtle)', color: snap ? '#fff' : 'var(--text-faintest)',
                  pointerEvents: snap ? 'auto' : 'none',
                }}
              >
                Restore this version
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
