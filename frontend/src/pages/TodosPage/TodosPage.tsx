import { useState, useCallback } from 'react'
import { FolderOpen, Trash2, CheckCircle2, Circle, ChevronDown, ChevronRight, ListTodo, RefreshCw, Search } from 'lucide-react'
import PageHeader from '../../components/common/PageHeader'
import { todosApi, type TodoList } from '../../api/todos'

export default function TodosPage() {
  const [projectDir, setProjectDir] = useState('')
  const [activeDir, setActiveDir] = useState('')
  const [todos, setTodos] = useState<TodoList[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)

  const refresh = useCallback((dir: string) => {
    if (!dir.trim()) return
    setLoading(true); setError(null)
    todosApi.list(dir)
      .then((data) => { setTodos(data); setActiveDir(dir) })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  function handleLoad() {
    const dir = projectDir.trim()
    if (!dir) return
    refresh(dir)
  }

  function toggleExpand(id: string) {
    setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this TODO list?')) return
    setBusy(id)
    try { await todosApi.delete(id, activeDir); refresh(activeDir) }
    catch (e) { setError(e instanceof Error ? e.message : 'Delete failed') }
    finally { setBusy(null) }
  }

  async function handleClearFinished() {
    if (!confirm('Remove all completed TODO lists?')) return
    setBusy('clear')
    try { await todosApi.deleteAll(activeDir, true); refresh(activeDir) }
    catch (e) { setError(e instanceof Error ? e.message : 'Clear failed') }
    finally { setBusy(null) }
  }

  async function handleDeleteAll() {
    if (!confirm('Delete ALL TODO lists? This cannot be undone.')) return
    setBusy('deleteAll')
    try { await todosApi.deleteAll(activeDir); refresh(activeDir) }
    catch (e) { setError(e instanceof Error ? e.message : 'Delete failed') }
    finally { setBusy(null) }
  }

  const finishedCount = todos.filter((t) => t.finished).length
  const inProgressCount = todos.length - finishedCount

  return (
    <div>
      <PageHeader title="TODO Lists" description="View and manage Kiro TODO lists from your projects" />

      <div style={{ padding: '20px 24px', maxWidth: 800 }}>
        {/* Project selector */}
        <div style={{
          padding: 16, borderRadius: 10, border: '1px solid var(--border-subtle)',
          background: 'var(--surface-raised)', marginBottom: 20,
        }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
            <FolderOpen size={12} style={{ marginRight: 4, verticalAlign: -1 }} />
            Project directory
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="field-input"
              value={projectDir}
              onChange={(e) => setProjectDir(e.target.value)}
              placeholder="/home/user/my-project"
              style={{ flex: 1, fontSize: 13 }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleLoad() }}
            />
            <button className="btn btn-primary" onClick={handleLoad} disabled={!projectDir.trim() || loading}
              style={{ fontSize: 12, padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Search size={13} />
              {loading ? 'Loading...' : 'Load'}
            </button>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, display: 'block' }}>
            Points to the project where Kiro stores TODO lists in <code>.kiro/cli-todo-lists/</code>
          </span>
        </div>

        {error && (
          <div style={{ fontSize: 12, color: 'var(--error)', padding: '8px 12px', marginBottom: 16, background: 'rgba(243,139,168,0.08)', borderRadius: 8 }}>
            {error}
          </div>
        )}

        {/* Content */}
        {activeDir && (
          <>
            {/* Stats + actions bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {todos.length} list{todos.length !== 1 ? 's' : ''}
                </span>
                {inProgressCount > 0 && (
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: 'rgba(249,226,175,0.1)', color: '#f9e2af' }}>
                    {inProgressCount} in progress
                  </span>
                )}
                {finishedCount > 0 && (
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: 'rgba(166,227,161,0.1)', color: '#a6e3a1' }}>
                    {finishedCount} completed
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-ghost" onClick={() => refresh(activeDir)} style={{ fontSize: 11, padding: '4px 8px' }}>
                  <RefreshCw size={11} />
                </button>
                {finishedCount > 0 && (
                  <button className="btn btn-secondary" onClick={handleClearFinished} disabled={busy === 'clear'}
                    style={{ fontSize: 11, padding: '4px 10px' }}>
                    Clear finished
                  </button>
                )}
                {todos.length > 0 && (
                  <button className="btn btn-ghost" onClick={handleDeleteAll} disabled={busy === 'deleteAll'}
                    style={{ fontSize: 11, padding: '4px 10px', color: 'var(--error)' }}>
                    Delete all
                  </button>
                )}
              </div>
            </div>

            {/* Todo lists */}
            {todos.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                <ListTodo size={28} style={{ marginBottom: 8, opacity: 0.3 }} />
                <div style={{ fontSize: 13 }}>No TODO lists found</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  TODO lists are created automatically when you ask Kiro to break down complex tasks
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {todos.map((todo) => {
                  const isExpanded = expanded.has(todo.id)
                  const pct = todo.totalTasks > 0 ? Math.round((todo.completedTasks / todo.totalTasks) * 100) : 0
                  return (
                    <div key={todo.id} style={{
                      borderRadius: 10, border: '1px solid var(--border-subtle)',
                      background: 'var(--surface-raised)', overflow: 'hidden',
                    }}>
                      {/* Header */}
                      <div
                        style={{
                          padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
                          cursor: 'pointer',
                        }}
                        onClick={() => toggleExpand(todo.id)}
                      >
                        {isExpanded ? <ChevronDown size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} /> : <ChevronRight size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />}
                        {todo.finished
                          ? <CheckCircle2 size={15} style={{ color: '#a6e3a1', flexShrink: 0 }} />
                          : <Circle size={15} style={{ color: '#f9e2af', flexShrink: 0 }} />
                        }
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {todo.description}
                          </div>
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                          {todo.completedTasks}/{todo.totalTasks}
                        </span>
                        {/* Progress bar */}
                        <div style={{ width: 60, height: 4, borderRadius: 2, background: 'var(--border-subtle)', flexShrink: 0, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: todo.finished ? '#a6e3a1' : '#f9e2af', transition: 'width 0.3s' }} />
                        </div>
                        <button className="btn btn-ghost" onClick={(e) => { e.stopPropagation(); handleDelete(todo.id) }}
                          disabled={busy === todo.id} style={{ padding: 4, color: 'var(--error)' }}>
                          <Trash2 size={12} />
                        </button>
                      </div>

                      {/* Expanded tasks */}
                      {isExpanded && todo.tasks.length > 0 && (
                        <div style={{ padding: '0 14px 12px 42px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {todo.tasks.map((task, i) => {
                            const done = task.completed || task.done
                            const label = task.description || task.title || `Task ${i + 1}`
                            return (
                              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12 }}>
                                {done
                                  ? <CheckCircle2 size={13} style={{ color: '#a6e3a1', flexShrink: 0, marginTop: 1 }} />
                                  : <Circle size={13} style={{ color: 'var(--text-disabled)', flexShrink: 0, marginTop: 1 }} />
                                }
                                <span style={{ color: done ? 'var(--text-tertiary)' : 'var(--text-primary)', textDecoration: done ? 'line-through' : 'none' }}>
                                  {label}
                                </span>
                              </div>
                            )
                          })}
                          {todo.modifiedFiles.length > 0 && (
                            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-tertiary)' }}>
                              Modified: {todo.modifiedFiles.slice(0, 5).join(', ')}{todo.modifiedFiles.length > 5 ? ` +${todo.modifiedFiles.length - 5} more` : ''}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
