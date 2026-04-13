import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import 'xterm/css/xterm.css'

export interface TerminalHandle {
  sendCommand: (text: string) => void
}

interface TerminalProps {
  sessionId: string
  wsUrl?: string
}

const Terminal = forwardRef<TerminalHandle, TerminalProps>(function Terminal(
  {
    sessionId,
    wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/terminal/${sessionId}`,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  useImperativeHandle(ref, () => ({
    sendCommand(text: string) {
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(new TextEncoder().encode(text))
      }
    },
  }))

  useEffect(() => {
    if (!containerRef.current) return

    const term = new XTerm({
      fontFamily: 'Geist Mono, SF Mono, ui-monospace, monospace',
      fontSize: 13,
      lineHeight: 1.5,
      theme: {
        background: '#0c0c10',
        foreground: '#cdd6f4',
        cursor: '#6366f1',
        selectionBackground: 'rgba(99, 102, 241, 0.3)',
        black: '#45475a',
        red: '#f38ba8',
        green: '#a6e3a1',
        yellow: '#f9e2af',
        blue: '#89b4fa',
        magenta: '#f5c2e7',
        cyan: '#94e2d5',
        white: '#bac2de',
        brightBlack: '#585b70',
        brightRed: '#f38ba8',
        brightGreen: '#a6e3a1',
        brightYellow: '#f9e2af',
        brightBlue: '#89b4fa',
        brightMagenta: '#f5c2e7',
        brightCyan: '#94e2d5',
        brightWhite: '#a6adc8',
      },
      cursorBlink: true,
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)
    term.open(containerRef.current)
    fitAddon.fit()

    xtermRef.current = term
    fitAddonRef.current = fitAddon

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws
    ws.binaryType = 'arraybuffer'

    ws.onopen = () => {
      term.writeln('\x1b[32mConnected to Kiro terminal\x1b[0m')
      ws.send(JSON.stringify({ type: 'resize', rows: term.rows, cols: term.cols }))
      // Auto-launch kiro CLI after a brief delay for shell init
      setTimeout(() => {
        ws.send(new TextEncoder().encode('kiro-cli chat\r'))
      }, 300)
    }

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        term.write(new Uint8Array(event.data))
      } else {
        term.write(event.data)
      }
    }

    ws.onerror = () => {
      term.writeln('\x1b[31mWebSocket error — is the backend running?\x1b[0m')
    }

    ws.onclose = () => {
      term.writeln('\x1b[33mConnection closed\x1b[0m')
    }

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(new TextEncoder().encode(data))
      }
    })

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', rows: term.rows, cols: term.cols }))
      }
    })

    if (containerRef.current.parentElement) {
      resizeObserver.observe(containerRef.current.parentElement)
    }

    return () => {
      resizeObserver.disconnect()
      ws.close()
      term.dispose()
    }
  }, [wsUrl])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        background: '#0c0c10',
        padding: 8,
        borderRadius: 8,
        overflow: 'hidden',
      }}
    />
  )
})

export default Terminal
