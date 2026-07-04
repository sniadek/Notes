import type { DocFontSize } from '../types';

export const FONT_SCALES: Record<DocFontSize, number> = {
  small: 0.9, medium: 1, large: 1.15, xlarge: 1.3,
};

export function agoLabel(ts: number | undefined): string {
  if (!ts) return '';
  const d = Date.now() - ts;
  const m = Math.round(d / 60000);
  if (m < 1) return 'now';
  if (m < 60) return m + 'm';
  const h = Math.round(m / 60);
  if (h < 24) return h + 'h';
  const dd = Math.round(h / 24);
  if (dd < 7) return dd + 'd';
  return Math.round(dd / 7) + 'w';
}

export function nowStamp(): string {
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = new Date();
  return M[d.getMonth()] + ' ' + d.getDate() + ', ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function download(name: string, text: string, type?: string) {
  try {
    const b = new Blob([text], { type: type || 'text/plain' });
    const u = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = u;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  } catch {
    /* ignore */
  }
}

export function openInBrowser(html: string) {
  try {
    const w = window.open('', '_blank');
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
    }
  } catch {
    /* ignore */
  }
}

export function dailyTitle(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
