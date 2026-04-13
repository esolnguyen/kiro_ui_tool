import { Link } from 'react-router-dom'
import { Bot, Trash2 } from 'lucide-react'
import type { Agent } from '../../types'
import ModelBadge from '../common/ModelBadge'
import { getAgentColor } from '../../utils/colors'

interface AgentCardProps {
  agent: Agent
  onDelete?: (slug: string) => void
}

export default function AgentCard({ agent, onDelete }: AgentCardProps) {
  const color = getAgentColor(agent.color)

  return (
    <div
      className="bg-card hover-card"
      style={{
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}
    >
      {/* Color accent bar */}
      <div
        style={{
          height: 3,
          background: color,
          borderRadius: '12px 12px 0 0',
        }}
      />

      <div style={{ padding: '14px 16px', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          {/* Icon */}
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: color + '18',
              border: `1px solid ${color}28`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Bot size={16} style={{ color }} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <Link
                to={`/agents/${agent.slug}`}
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  textDecoration: 'none',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {agent.name}
              </Link>
              <ModelBadge model={agent.model} />
            </div>

            {agent.description && (
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  marginTop: 4,
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {agent.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '8px 16px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: 'var(--text-tertiary)',
            fontFamily: 'monospace',
          }}
        >
          {agent.slug}
        </span>

        <div style={{ display: 'flex', gap: 4 }}>
          <Link
            to={`/agents/${agent.slug}`}
            className="btn btn-secondary"
            style={{ padding: '4px 10px', fontSize: 12 }}
          >
            Edit
          </Link>
          {onDelete && (
            <button
              className="btn btn-ghost"
              style={{ padding: '4px 6px', color: 'var(--error)' }}
              onClick={() => onDelete(agent.slug)}
              aria-label={`Delete ${agent.name}`}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
