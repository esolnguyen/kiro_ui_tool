import { useState } from 'react'
import { Wrench, CheckCircle, AlertCircle } from 'lucide-react'

interface Props {
  toolName: string
  toolInput?: Record<string, unknown>
  toolResult?: string
  isError?: boolean
}

export default function ToolRenderer({ toolName, toolInput, toolResult, isError }: Props) {
  const [open, setOpen] = useState(false)

  const headerColor = isError ? 'var(--error)' : toolResult ? '#22c55e' : 'var(--accent)'
  const bgColor = isError
    ? 'rgba(220, 38, 38, 0.06)'
    : toolResult
    ? 'rgba(34, 197, 94, 0.04)'
    : 'rgba(99, 102, 241, 0.05)'
  const borderColor = isError
    ? 'rgba(220, 38, 38, 0.15)'
    : toolResult
    ? 'rgba(34, 197, 94, 0.12)'
    : 'rgba(99, 102, 241, 0.12)'

  return (
    <div
      style={{
        borderRadius: 8,
        border: `1px solid ${borderColor}`,
        background: bgColor,
        overflow: 'hidden',
        marginBottom: 4,
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          padding: '6px 10px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {isError ? (
          <AlertCircle size={12} color={headerColor} />
        ) : toolResult ? (
          <CheckCircle size={12} color={headerColor} />
        ) : (
          <Wrench size={12} color={headerColor} />
        )}
        <span
          style={{
            fontSize: 11,
            fontFamily: 'monospace',
            fontWeight: 600,
            color: headerColor,
            flex: 1,
          }}
        >
          {toolName}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-disabled)' }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div style={{ padding: '0 10px 8px' }}>
          {toolInput && Object.keys(toolInput).length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <div
                style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 3, fontWeight: 600 }}
              >
                Input
              </div>
              <pre
                style={{
                  fontSize: 11,
                  fontFamily: 'monospace',
                  color: 'var(--text-secondary)',
                  background: 'var(--surface-base)',
                  borderRadius: 6,
                  padding: '6px 8px',
                  overflowX: 'auto',
                  maxHeight: 120,
                  margin: 0,
                }}
              >
                {JSON.stringify(toolInput, null, 2)}
              </pre>
            </div>
          )}
          {toolResult && (
            <div>
              <div
                style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 3, fontWeight: 600 }}
              >
                Result
              </div>
              <pre
                style={{
                  fontSize: 11,
                  fontFamily: 'monospace',
                  color: 'var(--text-secondary)',
                  background: 'var(--surface-base)',
                  borderRadius: 6,
                  padding: '6px 8px',
                  overflowX: 'auto',
                  maxHeight: 160,
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {toolResult}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
