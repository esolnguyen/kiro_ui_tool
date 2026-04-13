import { useState, useEffect, useRef, useCallback } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { Terminal as TerminalIcon, Play } from 'lucide-react'
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
  entityType: 'agent' | 'command' | 'skill'
  slug?: string
  entityName?: string
}

export default function StudioTerminal({ entityType, slug }: Props) {
  const [connected, setConnected] = useState(false)
  const termContainerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const sendRaw = useCallback((data: string) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(new TextEncoder().encode(data))
  }, [])

  function handleTest() {
    if (!slug) return
    const flag = entityType === 'agent' ? ` --agent ${slug}`
      : entityType === 'command' ? ` --command ${slug}`
      : ` --skill ${slug}`
    sendRaw(`kiro-cli chat${flag}\r`)
  }

  useEffect(() => {
    if (!termContainerRef.current) return

    const sessionId = `studio-${entityType}-${Date.now()}`
    const term = new XTerm({
      fontFamily: 'Geist Mono, SF Mono, ui-monospace, monospace',
      fontSize: 12, lineHeight: 1.5,
      theme: TERM_THEME, cursorBlink: true, scrollback: 5000,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(new WebLinksAddon())
    term.open(termContainerRef.current)
    fitAddon.fit()

    const ws = new WebSocket(`${WS_BASE}/ws/terminal/${sessionId}`)
    wsRef.current = ws
    ws.binaryType = 'arraybuffer'

    ws.onopen = () => {
      term.writeln('\x1b[32m● Connected to Kiro CLI\x1b[0m')
      term.writeln(`\x1b[90mReady to test your ${entityType}${slug ? ` (${slug})` : ''}.\x1b[0m`)
      ws.send(JSON.stringify({ type: 'resize', rows: term.rows, cols: term.cols }))
      setConnected(true)
    }
    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) term.write(new Uint8Array(e.data))
      else term.write(e.data)
    }
    ws.onerror = () => term.writeln('\x1b[31mWebSocket error\x1b[0m')
    ws.onclose = () => { term.writeln('\x1b[33mDisconnected\x1b[0m'); setConnected(false) }

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(new TextEncoder().encode(data))
    })

    const ro = new ResizeObserver(() => {
      fitAddon.fit()
      if (ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify({ type: 'resize', rows: term.rows, cols: term.cols }))
    })
    if (termContainerRef.current.parentElement)
      ro.observe(termContainerRef.current.parentElement)

    return () => { ro.disconnect(); ws.close(); term.dispose() }
  }, [entityType, slug])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0c0c10' }}>
      {/* Header */}
      <div
        style={{
          flexShrink: 0,
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <TerminalIcon size={13} style={{ color: '#a6e3a1' }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: '#cdd6f4' }}>CLI</span>
        {connected && (
          <span style={{ fontSize: 10, color: '#a6e3a1', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a6e3a1', display: 'inline-block' }} />
            Connected
          </span>
        )}
        {slug && (
          <button
            onClick={handleTest}
            disabled={!connected}
            style={{
              marginLeft: 'auto',
              padding: '3px 10px',
              fontSize: 10,
              fontWeight: 600,
              borderRadius: 6,
              border: '1px solid rgba(99,102,241,0.3)',
              background: 'rgba(99,102,241,0.1)',
              color: connected ? '#818cf8' : '#585b70',
              cursor: connected ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Play size={10} />
            Test {entityType}
          </button>
        )}
      </div>

      {/* Terminal */}
      <div ref={termContainerRef} style={{ flex: 1, padding: 8, overflow: 'hidden' }} />
    </div>
  )
}
