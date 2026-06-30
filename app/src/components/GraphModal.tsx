import { useState } from 'react';
import type { NotesAppVM } from '../hooks/useNotesApp';

export default function GraphModal({ vm }: { vm: NotesAppVM }) {
  const { state, setState, graph, open } = vm;
  const [closeHover, setCloseHover] = useState(false);

  if (!state.graphOpen) return null;

  const close = () => setState({ graphOpen: false });

  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(30,28,24,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, animation: 'fade .12s ease' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 740, maxWidth: '94vw', height: 520, maxHeight: '88vh', background: '#fffefb', borderRadius: 14, boxShadow: '0 30px 80px -16px rgba(0,0,0,.45)', border: '1px solid rgba(0,0,0,.08)', overflow: 'hidden', animation: 'pop .14s ease', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,.07)' }}>
          <div style={{ font: '600 15px -apple-system,system-ui', color: '#26241f' }}>
            Graph view <span style={{ color: '#bdb8af', fontWeight: 400 }}>· notes linked by [[wiki-links]]</span>
          </div>
          <span
            onClick={close}
            onMouseEnter={() => setCloseHover(true)}
            onMouseLeave={() => setCloseHover(false)}
            style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, color: '#8a8a8f', fontSize: 16, cursor: 'pointer', background: closeHover ? '#f0eee9' : 'transparent' }}
          >
            ×
          </span>
        </div>
        <div style={{ flex: 1, minHeight: 0, background: '#faf9f6' }}>
          <svg viewBox="0 0 720 420" style={{ width: '100%', height: '100%' }}>
            {graph.edges.map((e, i) => (
              <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke="oklch(0.8 0.05 264)" strokeWidth={1.5} />
            ))}
            {graph.nodes.map((n) => (
              <g key={n.id}>
                <circle cx={n.x} cy={n.y} r={n.r} fill={n.fill} stroke={n.stroke} strokeWidth={2} onClick={() => { close(); open(n.id); }} style={{ cursor: 'pointer' }} />
                <text x={n.x} y={n.ty} textAnchor="middle" style={{ font: '600 11px -apple-system,system-ui', fill: '#403d37', pointerEvents: 'none' }}>{n.label}</text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}
