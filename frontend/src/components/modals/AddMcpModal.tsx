import { useRef, useState } from 'react'
import { Server, Upload, X, Plus, Minus } from 'lucide-react'
import type { McpServer } from '../../types'
import { mcpApi } from '../../api/mcp'
import client from '../../api/client'

interface Props {
  isOpen: boolean
  onClose: () => void
  onAdded: (servers: McpServer[]) => void
}

type Tab = 'manual' | 'upload'
type Transport = 'stdio' | 'sse'

export default function AddMcpModal({ isOpen, onClose, onAdded }: Props) {
  const [tab, setTab] = useState<Tab>('manual')
  const [transport, setTransport] = useState<Transport>('stdio')
  const [name, setName] = useState('')
  const [command, setCommand] = useState('')
  const [url, setUrl] = useState('')
  const [argsStr, setArgsStr] = useState('')
  const [envPairs, setEnvPairs] = useState<Array<{ key: string; value: string }>>([])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  function resetForm() {
    setName('')
    setCommand('')
    setUrl('')
    setArgsStr('')
    setEnvPairs([])
    setError(null)
    setTransport('stdio')
    setTab('manual')
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  function addEnvPair() {
    setEnvPairs((p) => [...p, { key: '', value: '' }])
  }

  function removeEnvPair(i: number) {
    setEnvPairs((p) => p.filter((_, idx) => idx !== i))
  }

  function updateEnvPair(i: number, field: 'key' | 'value', val: string) {
    setEnvPairs((p) => p.map((pair, idx) => (idx === i ? { ...pair, [field]: val } : pair)))
  }

  async function handleManualSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    if (transport === 'stdio' && !command.trim()) { setError('Command is required for stdio transport'); return }
    if (transport === 'sse' && !url.trim()) { setError('URL is required for SSE transport'); return }

    setSaving(true)
    setError(null)
    try {
      const env: Record<string, string> = {}
      for (const { key, value } of envPairs) {
        if (key.trim()) env[key.trim()] = value
      }
      const server: McpServer = {
        name: name.trim(),
        command: transport === 'stdio' ? command.trim() : url.trim(),
        args: argsStr.split(' ').map((s) => s.trim()).filter(Boolean),
        env,
        enabled: true,
      }
      const added = await mcpApi.add(server)
      onAdded([added])
      handleClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add server')
    } finally {
      setSaving(false)
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      // detect format: { mcpServers: { name: { command, args, env } } }
      const mcpServers = json.mcpServers ?? json
      if (typeof mcpServers !== 'object') throw new Error('Invalid config format')

      const formData = new FormData()
      formData.append('file', file)
      const res = await client.post<{ imported: number; servers: McpServer[] }>('/api/mcp/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      onAdded(res.data.servers)
      handleClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse config file')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div
        className="bg-card"
        style={{ width: '100%', maxWidth: 560, borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Server size={15} style={{ color: 'var(--accent)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Add MCP Server</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Add a Model Context Protocol server to extend Kiro's capabilities</div>
          </div>
          <button className="btn btn-ghost" style={{ padding: '4px 6px' }} onClick={handleClose}>
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', padding: '0 20px' }}>
          {(['manual', 'upload'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(null) }}
              style={{
                padding: '10px 14px', fontSize: 12, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer',
                color: tab === t ? 'var(--accent)' : 'var(--text-secondary)',
                borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {t === 'manual' ? 'Manual' : 'Upload Config'}
            </button>
          ))}
        </div>

        <div style={{ padding: 20 }}>
          {error && (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', fontSize: 12, color: 'var(--error)', marginBottom: 16 }}>
              {error}
            </div>
          )}

          {tab === 'upload' ? (
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Upload a JSON file with an <code style={{ fontSize: 12, background: 'var(--surface-raised)', padding: '1px 5px', borderRadius: 4 }}>mcpServers</code> object to import MCP servers.
              </p>
              <label
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 10, padding: 32, border: '2px dashed var(--border-subtle)', borderRadius: 12,
                  cursor: 'pointer', transition: 'border-color 0.15s',
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const file = e.dataTransfer.files[0]
                  if (file && fileRef.current) {
                    const dt = new DataTransfer()
                    dt.items.add(file)
                    fileRef.current.files = dt.files
                    handleFileUpload({ target: fileRef.current } as React.ChangeEvent<HTMLInputElement>)
                  }
                }}
              >
                <Upload size={22} style={{ color: 'var(--text-tertiary)' }} />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {uploading ? 'Importing...' : 'Drop JSON file here or click to browse'}
                </span>
                <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileUpload} disabled={uploading} />
              </label>
            </div>
          ) : (
            <form onSubmit={handleManualSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Transport toggle */}
              <div style={{ display: 'flex', gap: 0, background: 'var(--surface-raised)', borderRadius: 8, padding: 3, alignSelf: 'flex-start' }}>
                {(['stdio', 'sse'] as Transport[]).map((t) => (
                  <button
                    key={t} type="button"
                    onClick={() => setTransport(t)}
                    style={{
                      padding: '5px 14px', fontSize: 12, fontWeight: 500, borderRadius: 6, border: 'none', cursor: 'pointer',
                      background: transport === t ? 'var(--accent)' : 'transparent',
                      color: transport === t ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>Name *</label>
                  <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="my-mcp-server" required />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {transport === 'stdio' ? 'Command *' : 'URL *'}
                  </label>
                  {transport === 'stdio' ? (
                    <input className="field-input" value={command} onChange={(e) => setCommand(e.target.value)} placeholder="npx, python, node..." required />
                  ) : (
                    <input className="field-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://localhost:3001/sse" required />
                  )}
                </div>
              </div>

              {transport === 'stdio' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
                    Arguments <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 400 }}>space-separated</span>
                  </label>
                  <input className="field-input" value={argsStr} onChange={(e) => setArgsStr(e.target.value)} placeholder="-y @modelcontextprotocol/server-filesystem /path" />
                </div>
              )}

              {/* Env vars */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>Environment Variables</label>
                  <button type="button" className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: 11 }} onClick={addEnvPair}>
                    <Plus size={11} /> Add
                  </button>
                </div>
                {envPairs.map((pair, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <input className="field-input" style={{ flex: 1 }} value={pair.key} onChange={(e) => updateEnvPair(i, 'key', e.target.value)} placeholder="KEY" />
                    <input className="field-input" style={{ flex: 2 }} value={pair.value} onChange={(e) => updateEnvPair(i, 'value', e.target.value)} placeholder="value" />
                    <button type="button" className="btn btn-ghost" style={{ padding: '4px 6px', color: 'var(--error)' }} onClick={() => removeEnvPair(i)}>
                      <Minus size={13} />
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
                <button type="button" className="btn btn-secondary" onClick={handleClose}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Adding...' : 'Add Server'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
