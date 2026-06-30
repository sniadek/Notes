import { useState } from 'react';
import type { NotesAppVM } from '../hooks/useNotesApp';
import type { ViewMode } from '../types';

const VIEWS: { k: ViewMode; label: string }[] = [
  { k: 'edit', label: 'edit' },
  { k: 'split', label: 'split' },
  { k: 'preview', label: 'preview' },
];

function toggle(on: boolean) {
  return {
    track: {
      width: 38, height: 22, borderRadius: 11, flex: 'none', padding: 2, display: 'flex', transition: '.15s',
      background: on ? 'oklch(0.5 0.12 264)' : '#d8d4cc', justifyContent: on ? 'flex-end' : 'flex-start',
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
      <div onClick={(e) => e.stopPropagation()} style={{ width: 600, maxWidth: '92vw', background: '#fffefb', borderRadius: 14, boxShadow: '0 30px 80px -16px rgba(0,0,0,.45)', border: '1px solid rgba(0,0,0,.08)', overflow: 'hidden', animation: 'pop .14s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid rgba(0,0,0,.07)' }}>
          <div style={{ font: '600 16px -apple-system,system-ui', color: '#26241f' }}>Settings</div>
          <div
            onClick={close}
            onMouseEnter={() => setCloseHover(true)}
            onMouseLeave={() => setCloseHover(false)}
            style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, color: '#8a8a8f', fontSize: 16, cursor: 'pointer', background: closeHover ? '#f0eee9' : 'transparent' }}
          >
            ×
          </div>
        </div>
        <div className="sc" style={{ padding: '8px 22px 22px', maxHeight: '62vh', overflow: 'auto' }}>
          <div style={{ font: '600 10.5px ui-monospace,Menlo,monospace', color: '#b5b0a6', letterSpacing: '.05em', padding: '18px 0 10px' }}>APPEARANCE</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
            <span style={{ font: '14px -apple-system,system-ui', color: '#403d37' }}>Theme</span>
            <div style={{ display: 'flex', background: '#f0eee9', borderRadius: 8, padding: 2, font: '500 12px -apple-system,system-ui' }}>
              <span style={{ padding: '5px 13px', borderRadius: 6, background: '#fffefb', color: '#26241f', boxShadow: '0 1px 2px rgba(0,0,0,.1)' }}>Light</span>
              <span style={{ padding: '5px 13px', borderRadius: 6, color: '#8a8a8f' }}>Dark</span>
              <span style={{ padding: '5px 13px', borderRadius: 6, color: '#8a8a8f' }}>Auto</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid rgba(0,0,0,.05)' }}>
            <span style={{ font: '14px -apple-system,system-ui', color: '#403d37' }}>Accent color</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'oklch(0.55 0.13 264)', outline: '2px solid oklch(0.7 0.1 264)', outlineOffset: 2 }} />
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'oklch(0.6 0.12 150)' }} />
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'oklch(0.62 0.13 30)' }} />
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#8a8a8f' }} />
            </div>
          </div>
          <div style={{ font: '600 10.5px ui-monospace,Menlo,monospace', color: '#b5b0a6', letterSpacing: '.05em', padding: '20px 0 10px' }}>EDITOR</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
            <span style={{ font: '14px -apple-system,system-ui', color: '#403d37' }}>Default view</span>
            <div style={{ display: 'flex', background: '#f0eee9', borderRadius: 8, padding: 2, font: '500 12px ui-monospace,Menlo,monospace' }}>
              {VIEWS.map((v) => (
                <span
                  key={v.k}
                  onClick={() => setState({ view: v.k })}
                  style={{
                    padding: '5px 13px', borderRadius: 6, cursor: 'pointer',
                    background: state.view === v.k ? '#fffefb' : 'transparent',
                    color: state.view === v.k ? '#26241f' : '#8a8a8f',
                    boxShadow: state.view === v.k ? '0 1px 2px rgba(0,0,0,.1)' : 'none',
                  }}
                >
                  {v.label}
                </span>
              ))}
            </div>
          </div>
          <div onClick={() => setState((s) => ({ wiki: !s.wiki }))} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid rgba(0,0,0,.05)', cursor: 'pointer' }}>
            <span style={{ font: '14px -apple-system,system-ui', color: '#403d37' }}>Render <span style={{ color: 'oklch(0.5 0.12 264)' }}>[[wiki-links]]</span> in preview</span>
            <div style={wt.track}><div style={wt.knob} /></div>
          </div>
          <div onClick={() => setState((s) => ({ autosave: !s.autosave }))} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid rgba(0,0,0,.05)', cursor: 'pointer' }}>
            <span style={{ font: '14px -apple-system,system-ui', color: '#403d37' }}>Autosave on edit</span>
            <div style={at.track}><div style={at.knob} /></div>
          </div>
          <div style={{ font: '600 10.5px ui-monospace,Menlo,monospace', color: '#b5b0a6', letterSpacing: '.05em', padding: '20px 0 10px' }}>FILES</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
            <span style={{ font: '14px -apple-system,system-ui', color: '#403d37' }}>New note format</span>
            <span style={{ font: '13px ui-monospace,Menlo,monospace', color: '#8a8a8f', background: '#f0eee9', padding: '6px 12px', borderRadius: 8 }}>Markdown · .md ▾</span>
          </div>
        </div>
      </div>
    </div>
  );
}
