import { ClipboardList, Plus, RefreshCw } from 'lucide-react'
import { useWorkplace } from './WorkplaceContext'
import styles from './workplace.module.scss'

interface WorkplaceHeaderProps {
  isLoading: boolean
  onRefresh: () => void
}

export default function WorkplaceHeader({ isLoading, onRefresh }: WorkplaceHeaderProps) {
  const { activeTab, status, showCreateForm, setShowCreateForm } = useWorkplace()

  return (
    <div className={styles.header}>
      <div className={styles.headerRow}>
        <div className={styles.headerTitle}>
          <ClipboardList size={16} style={{ color: 'var(--accent)' }} />
          <span className={styles.headerTitleText}>Workplace</span>
        </div>
        <div className={styles.headerActions}>
          {activeTab === 'work-items' && (
            <button
              className={`btn btn-ghost ${styles.headerAction}`}
              onClick={() => setShowCreateForm(!showCreateForm)}
              title="Create PBI"
            >
              <Plus size={14} />
            </button>
          )}
          <button
            className={`btn btn-ghost ${styles.headerAction}`}
            onClick={onRefresh}
            disabled={isLoading}
            title="Refresh"
          >
            <RefreshCw size={14} className={isLoading ? styles.spin : ''} />
          </button>
        </div>
      </div>
      {status && (
        <div className={styles.orgProject}>
          {status.organization}/{status.project}
        </div>
      )}
    </div>
  )
}
