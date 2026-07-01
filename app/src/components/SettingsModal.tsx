import { useState } from 'react';
import type { NotesAppVM } from '../hooks/useNotesApp';
import type { Design } from '../lib/persist';
import type { ViewMode } from '../types';

const VIEWS: { k: ViewMode; label: string }[] = [
  { k: 'edit', label: 'edit' },
  { k: 'split', label: 'split' },
  { k: 'preview', label: 'preview' },
];

const DESIGNS: { k: Design; label: string }[] = [
  { k: 'default', label: 'Default' },
  { k: 'cowork', label: 'Cowork' },
  { k: 'cowork-plus', label: 'Cowork+' },
];

function toggle(on: boolean) {
  return {
    track: {
      width: 38, height: 22, borderRadius: 11, flex: 'none', padding: 2, display: 'flex', transition: '.15s',
      background: on ? 'oklch(0.5 0.12 var(--accent-hue))' : '#d8d4cc', justifyContent: on ? 'flex-end' : 'flex-start',
    } as const,
    knob: { width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.2)' } as const,
  };
}

export default function SettingsModal({ vm }: { vm: NotesAppVM }) {
  const { state, setState } = vm;
  const [closeHover, setCloseHover] = useState(false);

  if (!state.settingsOpen) return null;

  const close = () => setState({ settingsOpen: false });
  const wt = toggle(state.wiki);
  const at = toggle(state.autosave);

  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(30,28,24,.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, animation: 'fade .12s ease' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 600, maxWidth: '92vw', background: 'var(--bg-surface)', borderRadius: 14, boxShadow: 'var(--shadow-modal)', border: '1px solid rgba(0,0,0,.08)', overflow: 'hidden', animation: 'pop .14s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ font: '600 16px -apple-system,system-ui', color: 'var(--text-primary)' }}>Settings</div>
          <div
            onClick={close}
            onMouseEnter={() => setCloseHover(true)}
            onMouseLeave={() => setCloseHover(false)}
            style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer', background: closeHover ? 'var(--bg-subtle)' : 'transparent' }}
          >
            ×
          </div>
        </div>
        <div className="sc" style={{ padding: '8px 22px 22px', maxHeight: '62vh', overflow: 'auto' }}>
          <div style={{ font: '600 10.5px ui-monospace,Menlo,monospace', color: 'var(--text-faint)', letterSpacing: '.05em', padding: '18px 0 10px' }}>APPEARANCE</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
            <span style={{ font: '14px -apple-system,system-ui', color: 'var(--text-secondary)' }}>Design</span>
            <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderRadius: 8, padding: 2, font: '500 12px -apple-system,system-ui' }}>
              {DESIGNS.map((d) => (
                <span
                  key={d.k}
                  onClick={() => setState({ design: d.k })}
                  style={{
                    padding: '5px 13px', borderRadius: 6, cursor: 'pointer',
                    background: state.design === d.k ? 'var(--bg-surface)' : 'transparent',
                    color: state.design === d.k ? 'var(--text-primary)' : 'var(--text-muted)',
                    boxShadow: state.design === d.k ? '0 1px 2px rgba(0,0,0,.1)' : 'none',
                  }}
                >
                  {d.label}
                </span>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border-soft)' }}>
            <span style={{ font: '14px -apple-system,system-ui', color: 'var(--text-secondary)' }}>Theme</span>
            <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderRadius: 8, padding: 2, font: '500 12px -apple-system,system-ui' }}>
              <span style={{ padding: '5px 13px', borderRadius: 6, background: 'var(--bg-surface)', color: 'var(--text-primary)', boxShadow: '0 1px 2px rgba(0,0,0,.1)' }}>Light</span>
              <span style={{ padding: '5px 13px', borderRadius: 6, color: 'var(--text-muted)' }}>Dark</span>
              <span style={{ padding: '5px 13px', borderRadius: 6, color: 'var(--text-muted)' }}>Auto</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border-soft)' }}>
            <span style={{ font: '14px -apple-system,system-ui', color: 'var(--text-secondary)' }}>Accent color</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'oklch(0.55 0.13 var(--accent-hue))', outline: '2px solid oklch(0.7 0.1 var(--accent-hue))', outlineOffset: 2 }} />
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'oklch(0.6 0.12 150)' }} />
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'oklch(0.62 0.13 30)' }} />
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--text-muted)' }} />
            </div>
          </div>
          <div style={{ font: '600 10.5px ui-monospace,Menlo,monospace', color: 'var(--text-faint)', letterSpacing: '.05em', padding: '20px 0 10px' }}>EDITOR</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
            <span style={{ font: '14px -apple-system,system-ui', color: 'var(--text-secondary)' }}>Default view</span>
            <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderRadius: 8, padding: 2, font: '500 12px ui-monospace,Menlo,monospace' }}>
              {VIEWS.map((v) => (
                <span
                  key={v.k}
                  onClick={() => setState({ view: v.k })}
                  style={{
                    padding: '5px 13px', borderRadius: 6, cursor: 'pointer',
                    background: state.view === v.k ? 'var(--bg-surface)' : 'transparent',
                    color: state.view === v.k ? 'var(--text-primary)' : 'var(--text-muted)',
                    boxShadow: state.view === v.k ? '0 1px 2px rgba(0,0,0,.1)' : 'none',
                  }}
                >
                  {v.label}
                </span>
              ))}
            </div>
          </div>
          <div onClick={() => setState((s) => ({ wiki: !s.wiki }))} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border-soft)', cursor: 'pointer' }}>
            <span style={{ font: '14px -apple-system,system-ui', color: 'var(--text-secondary)' }}>Render <span style={{ color: 'oklch(0.5 0.12 var(--accent-hue))' }}>[[wiki-links]]</span> in preview</span>
            <div style={wt.track}><div style={wt.knob} /></div>
          </div>
          <div onClick={() => setState((s) => ({ autosave: !s.autosave }))} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border-soft)', cursor: 'pointer' }}>
            <span style={{ font: '14px -apple-system,system-ui', color: 'var(--text-secondary)' }}>Autosave on edit</span>
            <div style={at.track}><div style={at.knob} /></div>
          </div>
          <div style={{ font: '600 10.5px ui-monospace,Menlo,monospace', color: 'var(--text-faint)', letterSpacing: '.05em', padding: '20px 0 10px' }}>FILES</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
            <span style={{ font: '14px -apple-system,system-ui', color: 'var(--text-secondary)' }}>New note format</span>
            <span style={{ font: '13px ui-monospace,Menlo,monospace', color: 'var(--text-muted)', background: 'var(--bg-subtle)', padding: '6px 12px', borderRadius: 8 }}>Markdown · .md ▾</span>
          </div>
          {vm.isTauri && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border-soft)' }}>
              <span style={{ font: '14px -apple-system,system-ui', color: 'var(--text-secondary)' }}>Vault folder</span>
              <div
                onClick={() => vm.pickVaultRoot()}
                style={{ font: '13px ui-monospace,Menlo,monospace', color: 'var(--text-muted)', background: 'var(--bg-subtle)', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {state.vaultRoot || 'Choose folder…'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
