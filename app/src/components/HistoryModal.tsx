import { useState } from 'react';
import type { NotesAppVM } from '../hooks/useNotesApp';

export default function HistoryModal({ vm }: { vm: NotesAppVM }) {
  const { state, setState, active, historyList, snap, diffRows, saveSnapshot, restore, accentSoft } = vm;
  const [saveHover, setSaveHover] = useState(false);
  const [closeHover, setCloseHover] = useState(false);

  if (!state.historyOpen) return null;

  const close = () => setState({ historyOpen: false });

  const entries = [{ label: 'Current version', ts: 'now', idx: -1 }, ...historyList.map((h, i) => ({
    label: 'Version ' + (historyList.length - i), ts: h.ts, idx: i,
  }))];

  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(30,28,24,.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, animation: 'fade .12s ease' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 760, maxWidth: '94vw', height: 560, maxHeight: '88vh', background: '#fffefb', borderRadius: 14, boxShadow: '0 30px 80px -16px rgba(0,0,0,.45)', border: '1px solid rgba(0,0,0,.08)', overflow: 'hidden', animation: 'pop .14s ease', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,.07)' }}>
          <div style={{ font: '600 15px -apple-system,system-ui', color: '#26241f' }}>Version history · {active ? active.file : ''}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              onClick={saveSnapshot}
              onMouseEnter={() => setSaveHover(true)}
              onMouseLeave={() => setSaveHover(false)}
              style={{ font: '500 12px -apple-system,system-ui', color: '#8a8a8f', padding: '6px 11px', borderRadius: 8, border: '1px solid rgba(0,0,0,.12)', cursor: 'pointer', background: saveHover ? '#f0eee9' : 'transparent' }}
            >
              Save snapshot
            </span>
            <span
              onClick={close}
              onMouseEnter={() => setCloseHover(true)}
              onMouseLeave={() => setCloseHover(false)}
              style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, color: '#8a8a8f', fontSize: 16, cursor: 'pointer', background: closeHover ? '#f0eee9' : 'transparent' }}
            >
              ×
            </span>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <div className="sc" style={{ width: 230, borderRight: '1px solid rgba(0,0,0,.07)', overflow: 'auto', padding: 9, flex: 'none' }}>
            {entries.map((h) => (
              <div
                key={h.idx}
                onClick={() => setState({ historyPick: h.idx })}
                style={{ padding: '9px 11px', borderRadius: 8, cursor: 'pointer', marginBottom: 2, background: h.idx === state.historyPick ? accentSoft : 'transparent' }}
              >
                <div style={{ font: '500 12.5px -apple-system,system-ui' }}>{h.label}</div>
                <div style={{ font: '11px ui-monospace,Menlo,monospace', color: '#bdb8af', marginTop: 2 }}>{h.ts}</div>
              </div>
            ))}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div className="sc" style={{ flex: 1, overflow: 'auto', padding: '14px 16px', font: '12.5px/1.65 ui-monospace,Menlo,monospace', background: '#fdfcf9' }}>
              {snap
                ? diffRows.map((d, i) => (
                  <div
                    key={i}
                    style={{
                      whiteSpace: 'pre-wrap', padding: '1px 6px', borderRadius: 3,
                      background: d.t === 'add' ? 'rgba(26,138,79,.12)' : d.t === 'del' ? 'rgba(192,57,43,.1)' : 'transparent',
                      color: d.t === 'add' ? '#157a44' : d.t === 'del' ? '#b0392b' : '#8a8a8f',
                    }}
                  >
                    {(d.t === 'add' ? '+ ' : d.t === 'del' ? '− ' : '  ') + d.v}
                  </div>
                ))
                : <div style={{ color: '#bdb8af', padding: 8 }}>This is the current version. Pick an older snapshot to compare.</div>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', borderTop: '1px solid rgba(0,0,0,.07)' }}>
              <span style={{ font: '11px -apple-system,system-ui', color: '#a8a29a' }}>
                <span style={{ color: '#1a8a4f' }}>+ added</span> · <span style={{ color: '#c0392b' }}>− removed</span> relative to current
              </span>
              <span
                onClick={snap ? restore : undefined}
                style={{
                  font: '500 12px -apple-system,system-ui', padding: '7px 14px', borderRadius: 8, cursor: snap ? 'pointer' : 'default',
                  background: snap ? 'oklch(0.5 0.12 264)' : '#ece9e2', color: snap ? '#fff' : '#bdb8af',
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
