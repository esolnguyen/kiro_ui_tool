import { useEffect, useRef } from 'react'
import type { NormalizedMessage } from '../../types'
import ToolRenderer from './ToolRenderer'
import StreamIndicator from './StreamIndicator'

function MarkdownContent({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  const style: React.CSSProperties = {
    fontSize: 13,
    lineHeight: 1.7,
    color: 'var(--text-primary)',
    wordBreak: 'break-word',
  }
  const className = isStreaming ? 'chat-prose streaming-cursor' : 'chat-prose'
  return (
    <div style={style} className={className}>
      <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{content}</p>
    </div>
  )
}

interface Props {
  messages: NormalizedMessage[]
  isStreaming?: boolean
  statusText?: string
}

export default function ChatMessages({ messages, isStreaming, statusText }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, messages[messages.length - 1]?.content])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`
        .chat-prose p { margin: 0.4em 0; }
        .chat-prose p:first-child { margin-top: 0; }
        .chat-prose p:last-child { margin-bottom: 0; }
        .chat-prose code { font-family: monospace; font-size: 0.9em; background: var(--input-bg); padding: 0.15em 0.4em; border-radius: 4px; }
        .chat-prose pre { background: var(--surface-base); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 0.75em 1em; overflow-x: auto; margin: 0.6em 0; }
        .chat-prose pre code { background: none; padding: 0; font-size: 0.85em; }
        .chat-prose ul, .chat-prose ol { padding-left: 1.5em; margin: 0.4em 0; }
        .chat-prose li { margin: 0.2em 0; }
        .chat-prose strong { color: var(--text-primary); font-weight: 600; }
        .chat-prose a { color: var(--accent); text-decoration: underline; text-underline-offset: 2px; }
        .chat-prose blockquote { border-left: 2px solid var(--border-subtle); padding-left: 0.75em; margin: 0.4em 0; color: var(--text-secondary); }
        .chat-prose table { width: 100%; border-collapse: collapse; font-size: 0.9em; margin: 0.6em 0; }
        .chat-prose th, .chat-prose td { border: 1px solid var(--border-subtle); padding: 0.35em 0.6em; text-align: left; }
        .chat-prose th { background: var(--surface-raised); font-weight: 600; }
        .streaming-cursor::after { content: ''; display: inline-block; width: 2px; height: 1em; background: var(--accent); margin-left: 2px; vertical-align: text-bottom; animation: cursorBlink 0.8s step-end infinite; }
        @keyframes cursorBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes chatMsgIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .chat-msg-in { animation: chatMsgIn 0.25s ease both; }
      `}</style>

      {messages.map((msg, idx) => {
        const isLast = idx === messages.length - 1
        const isStreamingThis = isStreaming && isLast && msg.role === 'assistant'

        if (msg.role === 'user') {
          return (
            <div key={msg.id} className="chat-msg-in" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div
                style={{
                  maxWidth: '80%',
                  borderRadius: '16px 16px 4px 16px',
                  padding: '10px 14px',
                  fontSize: 13,
                  lineHeight: 1.5,
                  background: 'var(--accent)',
                  color: '#fff',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {msg.content}
              </div>
            </div>
          )
        }

        if (msg.kind === 'thinking') {
          return (
            <details
              key={msg.id}
              style={{
                padding: '4px 8px',
                borderRadius: 8,
                background: 'var(--surface-inset)',
                fontSize: 11,
              }}
            >
              <summary
                style={{
                  cursor: 'pointer',
                  color: 'var(--text-tertiary)',
                  listStyle: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  userSelect: 'none',
                }}
              >
                <span>&#9658;</span> Thought process
              </summary>
              <pre
                style={{
                  marginTop: 6,
                  fontSize: 11,
                  fontFamily: 'monospace',
                  color: 'var(--text-tertiary)',
                  whiteSpace: 'pre-wrap',
                  maxHeight: 200,
                  overflowY: 'auto',
                }}
              >
                {msg.content}
              </pre>
            </details>
          )
        }

        if (msg.kind === 'tool_use') {
          return (
            <ToolRenderer
              key={msg.id}
              toolName={msg.toolName ?? msg.content}
              toolInput={msg.toolInput}
            />
          )
        }

        if (msg.kind === 'tool_result') {
          return (
            <ToolRenderer
              key={msg.id}
              toolName={msg.toolName ?? 'Result'}
              toolResult={msg.content}
            />
          )
        }

        if (msg.kind === 'error') {
          return (
            <div
              key={msg.id}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                background: 'rgba(220, 38, 38, 0.06)',
                border: '1px solid rgba(220, 38, 38, 0.15)',
                fontSize: 12,
                color: 'var(--error)',
              }}
            >
              {msg.content}
            </div>
          )
        }

        // Assistant text message
        if (msg.role === 'assistant' || msg.kind === 'text') {
          return (
            <div key={msg.id} className="chat-msg-in" style={{ display: 'flex', gap: 10 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #d97706 0%, #ea580c 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {msg.content ? (
                  <MarkdownContent content={msg.content} isStreaming={isStreamingThis} />
                ) : isStreamingThis ? (
                  <StreamIndicator statusText={statusText} />
                ) : null}
              </div>
            </div>
          )
        }

        return null
      })}

      {isStreaming &&
        (messages.length === 0 ||
          messages[messages.length - 1]?.role !== 'assistant') && (
          <div style={{ display: 'flex', gap: 10 }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #d97706 0%, #ea580c 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" />
              </svg>
            </div>
            <StreamIndicator statusText={statusText} />
          </div>
        )}

      <div ref={bottomRef} />
    </div>
  )
}
