import { useRef, useEffect, useState } from 'react'
import { ArrowUp, Square } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'

interface MenuItem {
  type: 'command' | 'skill'
  name: string
  description?: string
  slug: string
}

interface Props {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  onStop?: () => void
  disabled?: boolean
  isStreaming?: boolean
  placeholder?: string
  projectPath?: string | null
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  disabled,
  isStreaming,
  placeholder = 'Tell Kiro what to do...',
  projectPath,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuQuery, setMenuQuery] = useState('')
  const [menuIdx, setMenuIdx] = useState(0)

  const commands = useAppStore((s) => s.commands)
  const skills = useAppStore((s) => s.skills)

  const menuItems: MenuItem[] = [
    ...commands.map((c) => ({ type: 'command' as const, name: c.name, description: c.description, slug: c.slug })),
    ...skills.map((s) => ({ type: 'skill' as const, name: s.name, description: s.description, slug: s.slug })),
  ].filter((item) => {
    if (!menuQuery) return true
    const q = menuQuery.toLowerCase()
    return item.name.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q)
  })

  function autoResize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  useEffect(() => {
    autoResize()
  }, [value])

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    onChange(val)
    if (val.startsWith('/') && !val.includes(' ')) {
      setMenuQuery(val.slice(1))
      setMenuOpen(true)
      setMenuIdx(0)
    } else {
      setMenuOpen(false)
    }
  }

  function selectMenuItem(item: MenuItem) {
    onChange(`/${item.slug} `)
    setMenuOpen(false)
    textareaRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (menuOpen && menuItems.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMenuIdx((i) => (i + 1) % menuItems.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMenuIdx((i) => (i - 1 + menuItems.length) % menuItems.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const item = menuItems[menuIdx]
        if (item) selectMenuItem(item)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setMenuOpen(false)
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!disabled && value.trim()) onSend()
    }
  }

  return (
    <div style={{ flexShrink: 0, padding: '8px 20px 20px', position: 'relative' }}>
      {/* Command menu */}
      {menuOpen && menuItems.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% - 8px)',
            left: 20,
            right: 20,
            maxHeight: 250,
            overflowY: 'auto',
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 12,
            zIndex: 50,
            boxShadow: '0 8px 24px var(--card-shadow)',
          }}
        >
          {menuItems.map((item, idx) => (
            <button
              key={`${item.type}-${item.slug}`}
              onClick={() => selectMenuItem(item)}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                textAlign: 'left',
                background: idx === menuIdx ? 'var(--accent-muted)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                borderRadius: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    color: idx === menuIdx ? 'var(--accent)' : 'var(--text-secondary)',
                  }}
                >
                  /{item.name}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '1px 5px',
                    borderRadius: 999,
                    marginLeft: 'auto',
                    background:
                      item.type === 'command'
                        ? 'rgba(6, 182, 212, 0.1)'
                        : 'rgba(139, 92, 246, 0.1)',
                    color: item.type === 'command' ? '#06b6d4' : '#8b5cf6',
                  }}
                >
                  {item.type}
                </span>
              </div>
              {item.description && (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                  {item.description}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Input box */}
      <div
        style={{
          borderRadius: 16,
          border: isStreaming
            ? '1px solid rgba(99, 102, 241, 0.3)'
            : '1px solid var(--border-subtle)',
          background: 'var(--surface-raised)',
          boxShadow: isStreaming ? '0 0 16px var(--accent-glow)' : '0 2px 8px var(--card-shadow)',
          transition: 'all 0.2s',
          position: 'relative',
        }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={disabled}
          placeholder={placeholder}
          style={{
            width: '100%',
            resize: 'none',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: 13,
            color: 'var(--text-primary)',
            padding: '12px 14px 40px',
            maxHeight: 120,
            fontFamily: 'inherit',
          }}
        />

        <div
          style={{
            position: 'absolute',
            bottom: 10,
            left: 12,
            right: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-disabled)' }}>
            {projectPath && (
              <>
                <span style={{ color: 'var(--accent)' }}>&#128193;</span>{' '}
                <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', verticalAlign: 'bottom' }}>
                  {projectPath}
                </span>{' '}
                &middot;{' '}
              </>
            )}
            &#9166; Send &middot; &#8679;&#9166; New line
          </span>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {value.length > 0 && (
              <span style={{ fontSize: 10, fontFamily: 'monospace', color: value.length > 10000 ? 'var(--error)' : 'var(--text-disabled)' }}>
                {value.length.toLocaleString()}
              </span>
            )}
            {isStreaming ? (
              <button
                onClick={onStop}
                style={{
                  padding: '5px',
                  borderRadius: 8,
                  background: 'var(--error)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Square size={12} color="white" />
              </button>
            ) : (
              <button
                onClick={onSend}
                disabled={disabled || !value.trim()}
                style={{
                  padding: '5px',
                  borderRadius: 8,
                  background: value.trim() ? 'var(--accent)' : 'var(--input-bg)',
                  border: 'none',
                  cursor: value.trim() ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: value.trim() ? '0 0 10px var(--accent-glow)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                <ArrowUp size={12} color={value.trim() ? 'white' : 'var(--text-disabled)'} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
