import type { NotesAppVM } from '../hooks/useNotesApp';
import type { HtmlWidth } from '../types';
import { WIDTHS } from './PreviewPane';

const sectionLabel = { font: '600 10.5px ui-monospace,Menlo,monospace', color: 'var(--text-faint)', letterSpacing: '.05em', marginBottom: 12 } as const;

export default function ContextRail({ vm }: { vm: NotesAppVM }) {
  const {
    outline, backlinks, unlinked, active, childrenOf, frontMatter, isHtml, sourceValue, state, setState,
  } = vm;
  const subPages = active ? childrenOf(active.id) : [];
  const extraEntries = Object.entries(frontMatter.extra);
  const hasFrontMatter = !!(frontMatter.type || frontMatter.description || frontMatter.resource || frontMatter.timestamp || frontMatter.tags.length || extraEntries.length);
  const isWebResource = !!frontMatter.resource && /^https?:\/\//.test(frontMatter.resource);
  const devBtn = (key: HtmlWidth, label: string) => (
    <span
      key={key}
      onClick={() => setState({ htmlWidth: key })}
      style={{
        flex: 1, textAlign: 'center', padding: '4px 8px', borderRadius: 6, cursor: 'pointer', font: '500 11.5px -apple-system,system-ui',
        color: state.htmlWidth === key ? 'var(--text-primary)' : 'var(--text-muted)',
        background: state.htmlWidth === key ? 'var(--bg-surface)' : 'transparent',
        boxShadow: state.htmlWidth === key ? '0 1px 2px rgba(0,0,0,.1)' : 'none',
      }}
    >
      {label}
    </span>
  );
  return (
    <div className="sc" style={{ width: 250, background: 'var(--bg-bar)', borderLeft: '1px solid var(--border)', overflow: 'auto', flex: 'none', padding: '22px 18px' }}>
      {isHtml && (
        <div style={{ marginBottom: 28 }}>
          <div style={sectionLabel}>PREVIEW</div>
          <div style={{ display: 'flex', gap: 2, background: 'var(--bg-subtle)', borderRadius: 8, padding: 2, marginBottom: 10 }}>
            {devBtn('desktop', 'Desktop')}
            {devBtn('tablet', 'Tablet')}
            {devBtn('mobile', 'Mobile')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ font: '11px ui-monospace,Menlo,monospace', color: 'var(--text-faintest)' }}>{WIDTHS[state.htmlWidth]}</span>
            <span
              onClick={() => vm.openInBrowser(sourceValue)}
              style={{ font: '500 11.5px -apple-system,system-ui', color: 'oklch(0.5 0.12 var(--accent-hue))', cursor: 'pointer' }}
            >
              ↗ Open in browser
            </span>
          </div>
        </div>
      )}
      <div style={sectionLabel}>FRONTMATTER</div>
      {hasFrontMatter
        ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 28 }}>
            {frontMatter.type && (
              <span
                style={{
                  alignSelf: 'flex-start', font: '600 10.5px ui-monospace,Menlo,monospace', color: 'var(--text-secondary)',
                  background: 'var(--bg-subtle)', border: '1px solid var(--border)', padding: '3px 8px', borderRadius: 6,
                }}
              >
                {frontMatter.type}
              </span>
            )}
            {frontMatter.description && (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>{frontMatter.description}</div>
            )}
            {frontMatter.resource && (
              isWebResource
                ? <a href={frontMatter.resource} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--accent)', wordBreak: 'break-all' }}>{frontMatter.resource}</a>
                : <div style={{ fontSize: 11, color: 'var(--text-faint)', wordBreak: 'break-all' }}>{frontMatter.resource}</div>
            )}
            {frontMatter.timestamp && (
              <div style={{ font: '10.5px ui-monospace,Menlo,monospace', color: 'var(--text-faintest)' }}>{frontMatter.timestamp}</div>
            )}
            {extraEntries.map(([k, v]) => (
              <div key={k} style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                <span style={{ color: 'var(--text-faintest)' }}>{k}:</span> {v}
              </div>
            ))}
          </div>
        )
        : <div style={{ font: '400 12px -apple-system,system-ui', color: '#c4c0b6', marginBottom: 28 }}>No frontmatter</div>}

      {subPages.length > 0 && (
        <>
          <div style={sectionLabel}>SUB-PAGES · {subPages.length}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 28 }}>
            {subPages.map((c) => (
              <div
                key={c.id}
                onClick={() => vm.open(c.id)}
                style={{ padding: '10px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 9, cursor: 'pointer' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'oklch(0.8 0.08 var(--accent-hue))'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{c.title}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={sectionLabel}>OUTLINE</div>
      {outline.length > 0
        ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 28 }}>
            {outline.map((o, i) => (
              <span
                key={i}
                onClick={() => vm.scrollTo(o.id)}
                style={{
                  cursor: 'pointer', fontSize: 12.5, padding: `3px 0 3px ${(o.level - 1) * 12}px`,
                  color: o.level === 1 ? 'var(--text-secondary)' : 'var(--text-muted)',
                  fontWeight: o.level === 1 ? 500 : 400,
                }}
              >
                {o.text}
              </span>
            ))}
          </div>
        )
        : <div style={{ font: '400 12px -apple-system,system-ui', color: '#c4c0b6', marginBottom: 28 }}>No headings</div>}

      <div style={sectionLabel}>BACKLINKS · {backlinks.length}</div>
      {backlinks.length > 0
        ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {backlinks.map((b) => (
              <div
                key={b.id}
                onClick={() => vm.open(b.id)}
                style={{ padding: '10px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 9, cursor: 'pointer' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'oklch(0.8 0.08 var(--accent-hue))'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{b.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3, lineHeight: 1.45 }}>{b.snippet}</div>
              </div>
            ))}
          </div>
        )
        : <div style={{ font: '400 12px -apple-system,system-ui', color: '#c4c0b6' }}>No backlinks yet</div>}

      {unlinked.length > 0 && (
        <>
          <div style={{ ...sectionLabel, margin: '26px 0 12px' }}>UNLINKED MENTIONS · {unlinked.length}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {unlinked.map((u) => (
              <div
                key={u.id}
                onClick={() => vm.open(u.id)}
                style={{ padding: '10px 12px', background: 'var(--bg-surface)', border: '1px dashed var(--border)', borderRadius: 9, cursor: 'pointer' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'oklch(0.78 0.09 var(--accent-hue))'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{u.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3, lineHeight: 1.45 }}>{u.snippet}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
