import styles from './workplace.module.scss'

const STATE_COLORS: Record<string, string> = {
  New: '#3b82f6',
  Approved: '#8b5cf6',
  Committed: '#f59e0b',
  'On hold': '#6b7280',
  'In Review': '#0ea5e9',
  Done: '#10b981',
  Removed: '#ef4444',
}

const PR_STATUS_COLORS: Record<string, string> = {
  active: '#3b82f6',
  completed: '#10b981',
  abandoned: '#6b7280',
}

export function StateBadge({ state }: { state: string }) {
  const color = STATE_COLORS[state] ?? 'var(--text-tertiary)'
  return (
    <span className={styles.badge} style={{ background: `${color}18`, color }}>
      {state}
    </span>
  )
}

export function TypeBadge({ type }: { type: string }) {
  const isBug = type.toLowerCase().includes('bug')
  return (
    <span className={`${styles.badge} ${isBug ? styles.badgeBug : styles.badgePbi}`}>
      {type}
    </span>
  )
}

export function PrStatusBadge({ status }: { status: string }) {
  const color = PR_STATUS_COLORS[status] ?? 'var(--text-tertiary)'
  return (
    <span className={styles.badge} style={{ background: `${color}18`, color }}>
      {status}
    </span>
  )
}
