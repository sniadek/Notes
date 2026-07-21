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

const EDGE = 8;
// The top corners sit next to the traffic-light buttons and header icons (which start
// 16px from the edge), so they can't grow much without stealing clicks from those. The
// bottom corners sit next to the status bar, which is plain text with no click handlers,
// so there's nothing to protect there — make them much bigger, since a maximized window's
// corners land flush against the physical screen edge and are otherwise very hard to grab.
const CORNER_TOP = 16;
const CORNER_BOTTOM = 26;

const EDGES: { direction: ResizeDirection; cursor: string; style: CSSProperties }[] = [
  { direction: 'North', cursor: 'ns-resize', style: { top: 0, left: CORNER_TOP, right: CORNER_TOP, height: EDGE } },
  { direction: 'South', cursor: 'ns-resize', style: { bottom: 0, left: CORNER_BOTTOM, right: CORNER_BOTTOM, height: EDGE } },
  { direction: 'West', cursor: 'ew-resize', style: { left: 0, top: CORNER_TOP, bottom: CORNER_BOTTOM, width: EDGE } },
  { direction: 'East', cursor: 'ew-resize', style: { right: 0, top: CORNER_TOP, bottom: CORNER_BOTTOM, width: EDGE } },
];

const CORNERS: { direction: ResizeDirection; cursor: string; size: number; style: CSSProperties }[] = [
  { direction: 'NorthWest', cursor: 'nwse-resize', size: CORNER_TOP, style: { top: 0, left: 0 } },
  { direction: 'NorthEast', cursor: 'nesw-resize', size: CORNER_TOP, style: { top: 0, right: 0 } },
  { direction: 'SouthWest', cursor: 'nesw-resize', size: CORNER_BOTTOM, style: { bottom: 0, left: 0 } },
  { direction: 'SouthEast', cursor: 'nwse-resize', size: CORNER_BOTTOM, style: { bottom: 0, right: 0 } },
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
            position: 'fixed', zIndex: 9999, cursor: c.cursor, width: c.size, height: c.size, ...c.style,
          }}
        />
      ))}
    </>
  );
}
