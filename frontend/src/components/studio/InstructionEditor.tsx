import { useState, useMemo } from 'react'

interface Props {
  value: string
  onChange: (v: string) => void
  title?: string
}

export default function InstructionEditor({
  value,
  onChange,
  title,
}: Props) {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')

  const wordCount = useMemo(() => {
    const trimmed = value.trim()
    return trimmed ? trimmed.split(/\s+/).length : 0
  }, [value])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Header row */}
      {title && (
        <div
          style={{
            flexShrink: 0,
            borderBottom: '1px solid var(--border-subtle)',
            padding: '8px 16px',
          }}
        >
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            {title}
          </h3>
        </div>
      )}

      {/* Toolbar */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Edit/Preview toggle */}
          <div
            style={{
              display: 'flex',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            {(['edit', 'preview'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 500,
                  textTransform: 'capitalize',
                  background: mode === m ? 'var(--accent-muted)' : 'transparent',
                  color: mode === m ? 'var(--accent)' : 'var(--text-disabled)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {m}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-disabled)' }}>
            {wordCount} words
          </span>
        </div>
      </div>

      {/* Editor / Preview */}
      {mode === 'edit' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Write instructions for your agent..."
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            resize: 'none',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: 13,
            lineHeight: 1.7,
            color: 'var(--text-primary)',
            fontFamily: 'monospace',
            padding: 16,
            width: '100%',
          }}
        />
      ) : (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: 16,
            fontSize: 13,
            lineHeight: 1.7,
            color: 'var(--text-primary)',
          }}
          className="chat-prose"
        >
          {value.trim() ? (
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{value}</pre>
          ) : (
            <p style={{ color: 'var(--text-disabled)', margin: 0 }}>Nothing to preview yet.</p>
          )}
        </div>
      )}
    </div>
  )
}
