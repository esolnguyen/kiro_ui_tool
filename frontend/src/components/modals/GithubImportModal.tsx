import { useState } from 'react'
import { X, Search, Download, CheckCircle2, Loader2 } from 'lucide-react'
import client from '../../api/client'

interface ScannedItem {
  slug: string
  name: string
  description?: string
  category?: string
  conflict?: boolean
}

interface ScanResult {
  owner: string
  repo: string
  items: ScannedItem[]
  total: number
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onImported?: () => void
  type?: 'skills' | 'agents' | 'all'
}

export default function GithubImportModal({ isOpen, onClose, onImported, type = 'all' }: Props) {
  const [step, setStep] = useState<'url' | 'preview' | 'importing' | 'done'>('url')
  const [url, setUrl] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')

  if (!isOpen) return null

  async function doScan() {
    if (!url.trim()) return
    setError('')
    setScanning(true)
    try {
      const res = await client.post<ScanResult>('/github/scan', { url: url.trim(), type })
      setScanResult(res.data)
      setSelected(new Set(res.data.items.map((i) => i.slug)))
      setStep('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to scan repository')
    } finally {
      setScanning(false)
    }
  }

  async function doImport() {
    if (!scanResult || selected.size === 0) return
    setStep('importing')
    try {
      await client.post('/github/import', {
        url: url.trim(),
        owner: scanResult.owner,
        repo: scanResult.repo,
        selectedItems: [...selected],
        type,
      })
      setStep('done')
      onImported?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
      setStep('preview')
    }
  }

  function reset() {
    setStep('url')
    setUrl('')
    setScanResult(null)
    setSelected(new Set())
    setError('')
  }

  function toggleItem(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  function toggleAll() {
    if (!scanResult) return
    if (selected.size === scanResult.items.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(scanResult.items.map((i) => i.slug)))
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface-overlay)',
          borderRadius: 16,
          padding: 24,
          width: '90%',
          maxWidth: 540,
          maxHeight: '90vh',
          overflowY: 'auto',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Import from GitHub
          </h2>
          <button
            onClick={onClose}
            style={{ padding: 6, borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Step: URL */}
        {step === 'url' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Paste a GitHub repository URL to scan for importable items.
            </p>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: 'var(--text-primary)' }}>
                GitHub URL
              </label>
              <input
                className="field-input"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doScan()}
                placeholder="https://github.com/owner/repo"
                autoFocus
              />
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                Supports repo URLs, subfolder URLs, and single file URLs
              </p>
            </div>
            {error && (
              <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.15)', fontSize: 12, color: 'var(--error)' }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={doScan}
                disabled={!url.trim() || scanning}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {scanning ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={14} />}
                {scanning ? 'Scanning...' : 'Scan'}
              </button>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && scanResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                Found <strong>{scanResult.total}</strong> items in <code style={{ fontFamily: 'monospace' }}>{scanResult.owner}/{scanResult.repo}</code>
              </p>
              <button
                onClick={toggleAll}
                style={{ fontSize: 12, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {selected.size === scanResult.items.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div style={{ maxHeight: 300, overflowY: 'auto', background: 'var(--surface-base)', borderRadius: 10, padding: 8 }}>
              {scanResult.items.map((item) => (
                <label
                  key={item.slug}
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                    padding: '8px 10px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    marginBottom: 2,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(item.slug)}
                    onChange={() => toggleItem(item.slug)}
                    style={{ marginTop: 2, flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{item.name}</span>
                      {item.conflict && (
                        <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 999, background: 'rgba(234,179,8,0.1)', color: '#eab308' }}>
                          exists
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '2px 0 0', lineHeight: 1.4 }}>
                        {item.description}
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>
            {error && (
              <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.15)', fontSize: 12, color: 'var(--error)' }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={reset} className="btn btn-secondary">Back</button>
              <button
                onClick={doImport}
                disabled={selected.size === 0}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Download size={14} />
                Import {selected.size} items
              </button>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === 'importing' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0', gap: 12 }}>
            <Loader2 size={28} color="var(--text-secondary)" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              Cloning repository and importing items...
            </p>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0', gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(5,150,105,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={32} color="var(--success)" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px' }}>Import complete!</p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                {selected.size} items imported from{' '}
                <code style={{ fontFamily: 'monospace' }}>{scanResult?.owner}/{scanResult?.repo}</code>
              </p>
            </div>
            <button onClick={onClose} className="btn btn-primary" style={{ marginTop: 8 }}>
              Close
            </button>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
