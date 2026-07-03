import { useState, type CSSProperties } from 'react';
import type { NotesAppVM } from '../hooks/useNotesApp';
import type { FilterField, FilterRule } from '../types';

const FIELD_OPTIONS: { value: FilterField; label: string }[] = [
  { value: 'type', label: 'Type' },
  { value: 'tag', label: 'Tag' },
  { value: 'folder', label: 'Folder' },
  { value: 'pinned', label: 'Pinned' },
  { value: 'text', label: 'Text contains' },
  { value: 'filename', label: 'Filename contains' },
  { value: 'createdAfter', label: 'Created after' },
  { value: 'createdBefore', label: 'Created before' },
];

const COLORS = ['#8a8a93', '#6c7686', '#b5651d', '#3a6ea5', '#4a8f5c', '#a3466b'];

const selectStyle: CSSProperties = {
  font: '12.5px -apple-system,system-ui', color: 'var(--text-primary)', border: '1px solid var(--border)',
  borderRadius: 6, padding: '6px 6px', background: 'var(--bg-surface)', minWidth: 0,
};
const inputStyle: CSSProperties = { ...selectStyle, flex: 1 };

function defaultValueFor(field: FilterField): string {
  switch (field) {
    case 'type': return 'md';
    case 'pinned': return 'true';
    default: return '';
  }
}

export default function SmartFilterModal({ vm }: { vm: NotesAppVM }) {
  const { state, tagCount, allFolderNames } = vm;
  const editing = state.editingFilterId ? state.customFilters.find((c) => c.id === state.editingFilterId) : undefined;

  const [label, setLabel] = useState(editing?.label || '');
  const [color, setColor] = useState(editing?.color || COLORS[0]);
  const [match, setMatch] = useState<'all' | 'any'>(editing?.match || 'all');
  const [rules, setRules] = useState<FilterRule[]>(editing?.rules?.length ? editing.rules : [{ field: 'type', value: 'md' }]);

  if (!state.smartFilterModalOpen) return null;

  const close = () => vm.closeSmartFilterModal();

  const updateRule = (i: number, patch: Partial<FilterRule>) => {
    setRules((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };
  const removeRule = (i: number) => setRules((rs) => rs.filter((_, idx) => idx !== i));
  const addRule = () => setRules((rs) => [...rs, { field: 'type', value: 'md' }]);

  const canSave = label.trim().length > 0 && rules.length > 0;

  const save = () => {
    if (!canSave) return;
    const payload = { label: label.trim(), color, match, rules };
    if (editing) {
      vm.updateCustomFilter(editing.id, payload);
    } else {
      const id = vm.createCustomFilter(payload);
      vm.setState({ filter: 'custom:' + id });
    }
    close();
  };

  const tagNames = Object.keys(tagCount).sort();

  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(30,28,24,.28)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '10vh', zIndex: 52, animation: 'fade .12s ease' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 480, maxWidth: '92vw', background: 'var(--bg-surface)', borderRadius: 14, boxShadow: 'var(--shadow-modal)', border: '1px solid rgba(0,0,0,.08)', overflow: 'hidden', animation: 'pop .14s ease', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ font: '600 14.5px -apple-system,system-ui', color: 'var(--text-primary)' }}>{editing ? 'Edit smart filter' : 'New smart filter'}</span>
          <span onClick={close} style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer' }}>×</span>
        </div>

        <div className="sc" style={{ padding: '16px 18px', overflow: 'auto', flex: 1 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Filter name"
              style={{ flex: 1, font: '14px -apple-system,system-ui', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', background: 'var(--bg-surface)' }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              {COLORS.map((c) => (
                <span
                  key={c}
                  onClick={() => setColor(c)}
                  style={{
                    width: 20, height: 20, borderRadius: '50%', background: c, cursor: 'pointer', display: 'block',
                    outline: color === c ? '2px solid var(--accent)' : 'none', outlineOffset: 2,
                  }}
                />
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ font: '13px -apple-system,system-ui', color: 'var(--text-secondary)' }}>Match</span>
            <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderRadius: 8, padding: 2, font: '500 12px -apple-system,system-ui' }}>
              {(['all', 'any'] as const).map((m) => (
                <span
                  key={m}
                  onClick={() => setMatch(m)}
                  style={{
                    padding: '5px 13px', borderRadius: 6, cursor: 'pointer',
                    background: match === m ? 'var(--bg-surface)' : 'transparent',
                    color: match === m ? 'var(--text-primary)' : 'var(--text-muted)',
                    boxShadow: match === m ? '0 1px 2px rgba(0,0,0,.1)' : 'none',
                  }}
                >
                  {m === 'all' ? 'All conditions' : 'Any condition'}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rules.map((rule, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <select
                  value={rule.field}
                  onChange={(e) => updateRule(i, { field: e.target.value as FilterField, value: defaultValueFor(e.target.value as FilterField) })}
                  style={selectStyle}
                >
                  {FIELD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>

                {rule.field === 'type' && (
                  <select value={rule.value} onChange={(e) => updateRule(i, { value: e.target.value })} style={inputStyle}>
                    <option value="md">Markdown</option>
                    <option value="html">HTML</option>
                    <option value="eml">Email</option>
                  </select>
                )}
                {rule.field === 'pinned' && (
                  <select value={rule.value} onChange={(e) => updateRule(i, { value: e.target.value })} style={inputStyle}>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                )}
                {rule.field === 'folder' && (
                  <select value={rule.value} onChange={(e) => updateRule(i, { value: e.target.value })} style={inputStyle}>
                    <option value="">Choose…</option>
                    {allFolderNames.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                )}
                {rule.field === 'tag' && (
                  <input
                    list="filter-tag-options"
                    value={rule.value}
                    onChange={(e) => updateRule(i, { value: e.target.value })}
                    placeholder="tag"
                    style={inputStyle}
                  />
                )}
                {(rule.field === 'text' || rule.field === 'filename') && (
                  <input value={rule.value} onChange={(e) => updateRule(i, { value: e.target.value })} placeholder="value" style={inputStyle} />
                )}
                {(rule.field === 'createdAfter' || rule.field === 'createdBefore') && (
                  <input type="date" value={rule.value} onChange={(e) => updateRule(i, { value: e.target.value })} style={inputStyle} />
                )}

                <span onClick={() => removeRule(i)} style={{ marginLeft: 'auto', color: 'var(--text-faintest)', fontSize: 14, cursor: 'pointer', padding: '0 4px', flex: 'none' }}>×</span>
              </div>
            ))}
          </div>
          <datalist id="filter-tag-options">
            {tagNames.map((t) => <option key={t} value={t} />)}
          </datalist>

          <div onClick={addRule} style={{ marginTop: 10, font: '500 12.5px -apple-system,system-ui', color: 'var(--accent)', cursor: 'pointer' }}>
            + Add condition
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 9, padding: '11px 16px', borderTop: '1px solid var(--border)' }}>
          <span onClick={close} style={{ font: '500 12.5px -apple-system,system-ui', color: 'var(--text-muted)', padding: '7px 13px', borderRadius: 8, cursor: 'pointer' }}>Cancel</span>
          <span
            onClick={save}
            style={{
              font: '500 12.5px -apple-system,system-ui', color: '#fff', padding: '7px 15px', borderRadius: 8, cursor: canSave ? 'pointer' : 'default',
              background: canSave ? 'var(--accent)' : 'var(--text-faintest)',
            }}
          >
            Save
          </span>
        </div>
      </div>
    </div>
  );
}
