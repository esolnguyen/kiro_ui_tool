import { getModelLabel, getModelColor } from '../../utils/models'

interface ModelBadgeProps {
  model: string
  size?: 'sm' | 'md'
}

export default function ModelBadge({ model, size = 'sm' }: ModelBadgeProps) {
  const color = getModelColor(model)
  const label = getModelLabel(model)

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: size === 'sm' ? 10 : 12,
        fontWeight: 600,
        fontFamily: 'monospace',
        padding: size === 'sm' ? '2px 7px' : '3px 9px',
        borderRadius: 999,
        background: color + '18',
        color: color,
        border: `1px solid ${color}28`,
        letterSpacing: '0.02em',
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  )
}
