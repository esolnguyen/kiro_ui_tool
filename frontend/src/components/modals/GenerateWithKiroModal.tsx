import { useState, useEffect, useRef, useCallback } from 'react'
import { Wand2, X, Loader2 } from 'lucide-react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { generateApi } from '../../api/generate'
import 'xterm/css/xterm.css'

const WS_BASE = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`

const TERM_THEME = {
  background: '#0c0c10', foreground: '#cdd6f4', cursor: '#6366f1',
  selectionBackground: 'rgba(99, 102, 241, 0.3)',
  black: '#45475a', red: '#f38ba8', green: '#a6e3a1', yellow: '#f9e2af',
  blue: '#89b4fa', magenta: '#f5c2e7', cyan: '#94e2d5', white: '#bac2de',
  brightBlack: '#585b70', brightRed: '#f38ba8', brightGreen: '#a6e3a1',
  brightYellow: '#f9e2af', brightBlue: '#89b4fa', brightMagenta: '#f5c2e7',
  brightCyan: '#94e2d5', brightWhite: '#a6adc8',
}

interface Props {
  isOpen: boolean
  entityType: 'agent' | 'skill' | 'command'
  onClose: () => void
  onComplete: () => void
}

export default function GenerateWithKiroModal({ isOpen, entityType, onClose, onComplete }: Props) {
  const [description, setDescription] = useState('')
  const [phase, setPhase] = useState<'input' | 'running'>('input')
  const [loading, setLoading] = useState(false)
  const termContainerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const termRef = useRef<XTerm | null>(null)
  const roRef = useRef<ResizeObserver | null>(null)

  const cleanup = useCallback(() => {
    roRef.current?.disconnect()
    roRef.current = null
    wsRef.current?.close()
    wsRef.current = null
    termRef.current?.dispose()
    termRef.current = null
  }, [])

  function handleClose() {
    cleanup()
    setPhase('input')
    setDescription('')
    onClose()
  }

  async function handleGenerate() {
    const desc = description.trim()
    if (!desc) return
    setLoading(true)

    try {
      // Get the prompt and a temp file path from the backend
      const { prompt, tmpFile } = await generateApi.getPrompt(entityType, desc)
      setPhase('running')

      await new Promise((r) => setTimeout(r, 50))
      if (!termContainerRef.current) return

      const term = new XTerm({
        fontFamily: 'Geist Mono, SF Mono, ui-monospace, monospace',
        fontSize: 12, lineHeight: 1.5,
        theme: TERM_THEME, cursorBlink: true, scrollback: 5000,
      })
      termRef.current = term

      const fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.open(termContainerRef.current)
      fitAddon.fit()

      const sessionId = `generate-${entityType}-${Date.now()}`
      const ws = new WebSocket(`${WS_BASE}/ws/terminal/${sessionId}`)
      wsRef.current = ws
      ws.binaryType = 'arraybuffer'

      const send = (text: string) => {
        if (ws.readyState === WebSocket.OPEN)
          ws.send(new TextEncoder().encode(text))
      }

      ws.onopen = () => {
        term.writeln(`\x1b[36m● Generating ${entityType}...\x1b[0m`)
        term.writeln(`\x1b[90m${desc}\x1b[0m\n`)
        ws.send(JSON.stringify({ type: 'resize', rows: term.rows, cols: term.cols }))
        // Launch kiro-cli with the prompt read from the temp file as the INPUT argument.
        // Using --trust-all-tools so it can write files without asking.
        // The prompt is already saved to tmpFile by the backend.
        setTimeout(() => {
          send(`kiro-cli chat --trust-all-tools "$(cat ${tmpFile})" && rm -f ${tmpFile}\r`)
        }, 300)
      }

      ws.onmessage = (e) => {
        if (e.data instanceof ArrayBuffer) term.write(new Uint8Array(e.data))
        else term.write(e.data)
      }

      ws.onclose = () => {
        term.writeln('\n\x1b[33mSession ended.\x1b[0m')
      }

      term.onData((data) => send(data))

      const ro = new ResizeObserver(() => {
        fitAddon.fit()
        if (ws.readyState === WebSocket.OPEN)
          ws.send(JSON.stringify({ type: 'resize', rows: term.rows, cols: term.cols }))
      })
      ro.observe(termContainerRef.current)
      roRef.current = ro
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to start generation')
      setPhase('input')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => () => cleanup(), [cleanup])

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      }}
      onClick={undefined}
    >
      <div
        style={{
          background: 'var(--surface-raised)', borderRadius: 12,
          border: '1px solid var(--border-subtle)',
          width: phase === 'input' ? 560 : 900,
          maxWidth: '90vw', maxHeight: '85vh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', transition: 'width 0.2s ease',
        }}
      >
        <div style={{
          padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Wand2 size={14} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              Generate {entityType}
            </span>
          </div>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        {phase === 'input' ? (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              Describe what this {entityType} should do. Kiro will generate it using your available MCP servers and existing entities as context.
            </p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={`e.g. "An agent that reviews pull requests and checks for security issues using the Azure DevOps MCP server"`}
              rows={5}
              autoFocus
              style={{
                width: '100%', fontSize: 13, lineHeight: 1.6, padding: '12px 14px',
                borderRadius: 8, border: '1px solid var(--border-subtle)',
                background: 'var(--input-bg)', color: 'var(--text-primary)',
                resize: 'vertical', fontFamily: 'inherit', outline: 'none',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  handleGenerate()
                }
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Ctrl+Enter to generate</span>
              <button
                onClick={handleGenerate}
                disabled={!description.trim() || loading}
                className="btn btn-primary"
                style={{ padding: '8px 18px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {loading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Wand2 size={13} />}
                {loading ? 'Starting...' : 'Generate'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', height: 540 }}>
            <div ref={termContainerRef} style={{ flex: 1, padding: 8, overflow: 'hidden' }} />
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-secondary" onClick={handleClose} style={{ fontSize: 12 }}>Close</button>
              <button className="btn btn-primary" onClick={() => { onComplete(); handleClose() }} style={{ fontSize: 12 }}>
                Done — Refresh List
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
