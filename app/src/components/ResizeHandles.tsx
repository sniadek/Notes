import type { CSSProperties } from 'react';

function isTauri(): boolean {
  return '__TAURI_INTERNALS__' in window;
}

type ResizeDirection = 'East' | 'North' | 'NorthEast' | 'NorthWest' | 'South' | 'SouthEast' | 'SouthWest' | 'West';

async function startResize(direction: ResizeDirection) {
  if (!isTauri()) return;
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  await getCurrentWindow().startResizeDragging(direction);
}

const EDGE = 6;
const CORNER = 14;

const EDGES: { direction: ResizeDirection; cursor: string; style: CSSProperties }[] = [
  { direction: 'North', cursor: 'ns-resize', style: { top: 0, left: CORNER, right: CORNER, height: EDGE } },
  { direction: 'South', cursor: 'ns-resize', style: { bottom: 0, left: CORNER, right: CORNER, height: EDGE } },
  { direction: 'West', cursor: 'ew-resize', style: { left: 0, top: CORNER, bottom: CORNER, width: EDGE } },
  { direction: 'East', cursor: 'ew-resize', style: { right: 0, top: CORNER, bottom: CORNER, width: EDGE } },
];

const CORNERS: { direction: ResizeDirection; cursor: string; style: CSSProperties }[] = [
  { direction: 'NorthWest', cursor: 'nwse-resize', style: { top: 0, left: 0 } },
  { direction: 'NorthEast', cursor: 'nesw-resize', style: { top: 0, right: 0 } },
  { direction: 'SouthWest', cursor: 'nesw-resize', style: { bottom: 0, left: 0 } },
  { direction: 'SouthEast', cursor: 'nwse-resize', style: { bottom: 0, right: 0 } },
];

// Frameless windows (`decorations: false` in tauri.conf.json) lose the OS's native
// edge/corner resize hit-testing, which normally comes from the window chrome — the
// remaining hit target is only a couple of pixels, worst at corners where two thin
// edges would otherwise have to overlap. These explicit regions give resizing a real,
// grabbable hit area again, corners included.
export default function ResizeHandles() {
  if (!isTauri()) return null;
  return (
    <>
      {EDGES.map((e) => (
        <div
          key={e.direction}
          onMouseDown={() => startResize(e.direction)}
          style={{
            position: 'fixed', zIndex: 9999, cursor: e.cursor, ...e.style,
          }}
        />
      ))}
      {CORNERS.map((c) => (
        <div
          key={c.direction}
          onMouseDown={() => startResize(c.direction)}
          style={{
            position: 'fixed', zIndex: 9999, cursor: c.cursor, width: CORNER, height: CORNER, ...c.style,
          }}
        />
      ))}
    </>
  );
}
