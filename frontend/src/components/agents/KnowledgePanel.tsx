import { useState, useEffect, useCallback } from 'react'
import { Database, Plus, Trash2, RefreshCw, ChevronDown, ChevronUp, FolderOpen, Zap, Search as SearchIcon } from 'lucide-react'
import { knowledgeApi, type KnowledgeEntry, type KnowledgeAddRequest } from '../../api/knowledge'

interface Props {
  agentSlug: string
}

export default function KnowledgePanel({ agentSlug }: Props) {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [addForm, setAddForm] = useState<KnowledgeAddRequest>({
    name: '', path: '', indexType: 'Fast', includePatterns: [], excludePatterns: [],
  })
  const [includeInput, setIncludeInput] = useState('')
  const [excludeInput, setExcludeInput] = useState('')

  const refresh = useCallback(() => {
    setLoading(true)
    knowledgeApi.list(agentSlug)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [agentSlug])

  useEffect(() => { refresh() }, [refresh])

  async function handleAdd() {
    if (!addForm.name.trim() || !addForm.path.trim()) return
    setBusy('add'); setError(null)
    try {
      await knowledgeApi.add(agentSlug, addForm)
      setAddForm({ name: '', path: '', indexType: 'Fast', includePatterns: [], excludePatterns: [] })
      setIncludeInput(''); setExcludeInput('')
      setShowAdd(false)
      refresh()
    } catch (e) { setError(e instanceof Error ? e.message : 'Add failed') }
    finally { setBusy(null) }
  }

  async function handleRemove(name: string) {
    if (!confirm(`Remove knowledge entry "${name}"?`)) return
    setBusy(name); setError(null)
    try { await knowledgeApi.remove(agentSlug, name); refresh() }
    catch (e) { setError(e instanceof Error ? e.message : 'Remove failed') }
    finally { setBusy(null) }
  }

  async function handleUpdate(name: string) {
    setBusy(name); setError(null)
    try { await knowledgeApi.update(agentSlug, name); refresh() }
    catch (e) { setError(e instanceof Error ? e.message : 'Update failed') }
    finally { setBusy(null) }
  }

  async function handleClear() {
    if (!confirm('Remove ALL knowledge entries? This cannot be undone.')) return
    setBusy('clear'); setError(null)
    try { await knowledgeApi.clear(agentSlug); refresh() }
    catch (e) { setError(e instanceof Error ? e.message : 'Clear failed') }
    finally { setBusy(null) }
  }

  function addPattern(type: 'include' | 'exclude') {
    const input = type === 'include' ? includeInput : excludeInput
    const val = input.trim()
    if (!val) return
    const key = type === 'include' ? 'includePatterns' : 'excludePatterns'
    setAddForm((f) => ({ ...f, [key]: [...f[key], val] }))
    if (type === 'include') setIncludeInput('')
    else setExcludeInput('')
  }

  function removePattern(type: 'include' | 'exclude', idx: number) {
    const key = type === 'include' ? 'includePatterns' : 'excludePatterns'
    setAddForm((f) => ({ ...f, [key]: f[key].filter((_, i) => i !== idx) }))
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Database size={14} style={{ color: 'var(--accent)' }} />
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Knowledge Base</h3>
          {entries.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'var(--surface-raised)', padding: '1px 6px', borderRadius: 8 }}>
              {entries.length}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {entries.length > 0 && (
            <button type="button" className="btn btn-ghost" onClick={handleClear} disabled={busy === 'clear'}
              style={{ fontSize: 11, padding: '3px 8px', color: 'var(--error)' }}>
              Clear all
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(!showAdd)}
            style={{ fontSize: 11, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
            {showAdd ? <ChevronUp size={11} /> : <Plus size={11} />}
            Add
          </button>
        </div>
      </div>

      {error && (
        <div style={{ fontSize: 11, color: 'var(--error)', padding: '6px 10px', marginBottom: 8, background: 'rgba(243,139,168,0.08)', borderRadius: 6 }}>
          {error}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div style={{ padding: 12, marginBottom: 12, border: '1px solid var(--border-subtle)', borderRadius: 8, background: 'var(--surface-raised)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Name *</label>
              <input className="field-input" value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. project-docs" style={{ fontSize: 12 }} />
            </div>
            <div style={{ flex: 2 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Path *</label>
              <input className="field-input" value={addForm.path} onChange={(e) => setAddForm((f) => ({ ...f, path: e.target.value }))}
                placeholder="/path/to/directory" style={{ fontSize: 12 }} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Index Type</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['Fast', 'Best'] as const).map((t) => (
                <button key={t} type="button" onClick={() => setAddForm((f) => ({ ...f, indexType: t }))}
                  style={{
                    padding: '4px 12px', fontSize: 11, fontWeight: 500, borderRadius: 6, cursor: 'pointer',
                    border: `1px solid ${addForm.indexType === t ? 'var(--accent)' : 'var(--border-subtle)'}`,
                    background: addForm.indexType === t ? 'var(--accent-muted)' : 'transparent',
                    color: addForm.indexType === t ? 'var(--accent)' : 'var(--text-secondary)',
                  }}>
                  {t === 'Fast' ? '⚡ Fast (BM25)' : '🧠 Best (Semantic)'}
                </button>
              ))}
            </div>
          </div>

          {/* Include patterns */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Include patterns</label>
            <div style={{ display: 'flex', gap: 4 }}>
              <input className="field-input" value={includeInput} onChange={(e) => setIncludeInput(e.target.value)}
                placeholder="e.g. **/*.py" style={{ fontSize: 12, flex: 1 }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPattern('include') } }} />
              <button type="button" className="btn btn-secondary" onClick={() => addPattern('include')} style={{ fontSize: 11, padding: '4px 8px' }}>+</button>
            </div>
            {addForm.includePatterns.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                {addForm.includePatterns.map((p, i) => (
                  <span key={i} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--accent-muted)', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 3 }}>
                    {p} <button type="button" onClick={() => removePattern('include', i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, fontSize: 10 }}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Exclude patterns */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Exclude patterns</label>
            <div style={{ display: 'flex', gap: 4 }}>
              <input className="field-input" value={excludeInput} onChange={(e) => setExcludeInput(e.target.value)}
                placeholder="e.g. node_modules/**" style={{ fontSize: 12, flex: 1 }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPattern('exclude') } }} />
              <button type="button" className="btn btn-secondary" onClick={() => addPattern('exclude')} style={{ fontSize: 11, padding: '4px 8px' }}>+</button>
            </div>
            {addForm.excludePatterns.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                {addForm.excludePatterns.map((p, i) => (
                  <span key={i} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(243,139,168,0.1)', color: 'var(--error)', display: 'flex', alignItems: 'center', gap: 3 }}>
                    {p} <button type="button" onClick={() => removePattern('exclude', i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, fontSize: 10 }}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)} style={{ fontSize: 11, padding: '5px 12px' }}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={handleAdd}
              disabled={!addForm.name.trim() || !addForm.path.trim() || busy === 'add'}
              style={{ fontSize: 11, padding: '5px 12px' }}>
              {busy === 'add' ? 'Adding...' : 'Add Knowledge'}
            </button>
          </div>
        </div>
      )}

      {/* Entries list */}
      {loading ? (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '16px 0', textAlign: 'center' }}>Loading...</div>
      ) : entries.length === 0 ? (
        <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-tertiary)' }}>
          <Database size={20} style={{ marginBottom: 6, opacity: 0.4 }} />
          <div style={{ fontSize: 12 }}>No knowledge entries yet</div>
          <div style={{ fontSize: 11, marginTop: 2 }}>Add files or directories to build this agent's knowledge base</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {entries.map((entry) => (
            <div key={entry.id} style={{
              padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)',
              background: 'var(--surface-raised)', display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <FolderOpen size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{entry.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.path}
                </div>
              </div>
              <span style={{
                fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 500,
                background: entry.indexType === 'Best' ? 'rgba(137,180,250,0.1)' : 'rgba(166,227,161,0.1)',
                color: entry.indexType === 'Best' ? '#89b4fa' : '#a6e3a1',
              }}>
                {entry.indexType === 'Best' ? '🧠 Semantic' : '⚡ BM25'}
              </span>
              {entry.fileCount > 0 && (
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{entry.fileCount} files</span>
              )}
              <button type="button" className="btn btn-ghost" onClick={() => handleUpdate(entry.name)}
                disabled={busy === entry.name} title="Re-index"
                style={{ padding: 4 }}>
                <RefreshCw size={12} style={busy === entry.name ? { animation: 'spin 1s linear infinite' } : undefined} />
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => handleRemove(entry.name)}
                disabled={busy === entry.name} title="Remove"
                style={{ padding: 4, color: 'var(--error)' }}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
