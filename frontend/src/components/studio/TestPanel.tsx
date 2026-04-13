import { useState, useCallback } from 'react'
import { RotateCcw } from 'lucide-react'
import type { NormalizedMessage } from '../../types'
import { useWebSocket } from '../../hooks/useWebSocket'
import ChatMessages from '../chat/ChatMessages'
import ChatInput from '../chat/ChatInput'

const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/chat`

const TOOL_LABELS: Record<string, string> = {
  Read: 'Reading file',
  Write: 'Writing file',
  Edit: 'Editing file',
  Glob: 'Searching files',
  Grep: 'Searching code',
  Bash: 'Running command',
}

interface Props {
  agentSlug?: string
  agentName?: string
  commandSlug?: string
  skillSlug?: string
  isDraft?: boolean
}

export default function TestPanel({ agentSlug, agentName, commandSlug, skillSlug, isDraft }: Props) {
  const [messages, setMessages] = useState<NormalizedMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [statusText, setStatusText] = useState('Online')
  const [error, setError] = useState<string | null>(null)

  const testName = agentName ?? commandSlug ?? skillSlug ?? 'Entity'

  const handleMessage = useCallback((data: unknown) => {
    const event = data as { type: string; data?: NormalizedMessage; sessionId?: string; error?: string }

    if (event.type === 'session' && event.sessionId) {
      setSessionId(event.sessionId)
    }

    if (event.type === 'message' && event.data) {
      const msg = event.data
      if (msg.kind === 'stream_delta') {
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last?.isStreaming && last.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, content: last.content + msg.content }]
          }
          return [
            ...prev,
            {
              id: `stream-${Date.now()}`,
              kind: 'text' as const,
              role: 'assistant' as const,
              content: msg.content,
              isStreaming: true,
              timestamp: new Date().toISOString(),
            },
          ]
        })
        setIsStreaming(true)
        setStatusText('Responding...')
      } else if (msg.kind === 'thinking') {
        setStatusText('Thinking...')
      } else if (msg.kind === 'tool_use') {
        setStatusText(TOOL_LABELS[msg.toolName ?? ''] ?? (msg.toolName ?? 'Running') + '...')
        setMessages((prev) => [...prev, msg])
      } else if (msg.kind === 'stream_end' || msg.kind === 'complete') {
        setMessages((prev) => prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)))
        setIsStreaming(false)
        setStatusText('Ready')
      } else if (msg.kind === 'error') {
        setError(msg.content)
        setIsStreaming(false)
        setStatusText('Error')
      }
    }

    if (event.type === 'complete') {
      setMessages((prev) => prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)))
      setIsStreaming(false)
      setStatusText('Ready')
    }

    if (event.type === 'error') {
      setError(event.error ?? 'An error occurred')
      setIsStreaming(false)
    }
  }, [])

  const { send, readyState } = useWebSocket(WS_URL, {
    onMessage: handleMessage,
    reconnect: true,
  })

  const connectionLabel =
    readyState === 'connecting' ? 'Connecting...' :
    readyState === 'closed' ? 'Disconnected' :
    isStreaming ? statusText : 'Online'

  function handleSend() {
    const text = input.trim()
    if (!text) return

    const userMsg: NormalizedMessage = {
      id: `user-${Date.now()}`,
      kind: 'text',
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setError(null)
    setIsStreaming(true)
    setStatusText('Starting...')

    send({
      type: 'start',
      message: text,
      sessionId: sessionId ?? undefined,
      agentSlug: agentSlug ?? undefined,
      commandSlug: commandSlug ?? undefined,
      skillSlug: skillSlug ?? undefined,
    })
  }

  function handleStop() {
    send({ type: 'abort' })
    setIsStreaming(false)
    setMessages((prev) => prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)))
  }

  function handleClear() {
    setMessages([])
    setSessionId(null)
    setError(null)
    setIsStreaming(false)
    setStatusText('Online')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div
        style={{
          flexShrink: 0,
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>Test</span>
          {isDraft && (
            <span
              style={{
                fontSize: 9,
                fontFamily: 'monospace',
                padding: '1px 6px',
                borderRadius: 999,
                background: 'rgba(99,102,241,0.1)',
                color: 'var(--accent)',
              }}
            >
              Draft
            </span>
          )}
          <span
            style={{
              fontSize: 9,
              fontFamily: 'monospace',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              padding: '1px 6px',
              borderRadius: 999,
              background:
                readyState === 'closed' ? 'rgba(220,38,38,0.08)' :
                isStreaming ? 'var(--accent-muted)' : 'var(--input-bg)',
              color:
                readyState === 'closed' ? 'var(--error)' :
                isStreaming ? 'var(--accent)' : 'var(--text-disabled)',
              transition: 'all 0.2s',
            }}
          >
            {connectionLabel}
          </span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            title="Clear conversation"
            style={{
              padding: 4,
              borderRadius: 6,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-disabled)',
            }}
          >
            <RotateCcw size={13} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {messages.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 10,
              color: 'var(--text-tertiary)',
            }}
          >
            <p style={{ fontSize: 12, textAlign: 'center', maxWidth: 200, lineHeight: 1.5, margin: 0 }}>
              Test your {agentSlug ? 'agent' : commandSlug ? 'command' : 'skill'} here. Changes to instructions are reflected immediately.
            </p>
          </div>
        ) : (
          <ChatMessages messages={messages} isStreaming={isStreaming} statusText={statusText} />
        )}

        {error && (
          <div
            style={{
              marginTop: 8,
              padding: '6px 10px',
              borderRadius: 8,
              fontSize: 11,
              background: 'rgba(220,38,38,0.06)',
              color: 'var(--error)',
            }}
          >
            {error}
          </div>
        )}
      </div>

      <ChatInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        onStop={handleStop}
        disabled={isStreaming || readyState !== 'open'}
        isStreaming={isStreaming}
        placeholder={readyState !== 'open' ? 'Connecting...' : `Ask ${testName} something...`}
      />
    </div>
  )
}
