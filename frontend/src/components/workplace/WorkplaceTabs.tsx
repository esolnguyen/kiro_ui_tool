import { ClipboardList, GitPullRequest, FlaskConical } from 'lucide-react'
import { useWorkplace, type Tab } from './WorkplaceContext'
import styles from './workplace.module.scss'

interface WorkplaceTabsProps {
  workItemCount: number
  testPlanCount: number
  prCount: number
}

export default function WorkplaceTabs({ workItemCount, testPlanCount, prCount }: WorkplaceTabsProps) {
  const { activeTab, setActiveTab } = useWorkplace()

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'work-items', label: 'Work Items', icon: <ClipboardList size={13} />, count: workItemCount },
    { key: 'test-plans', label: 'Test Plans', icon: <FlaskConical size={13} />, count: testPlanCount },
    { key: 'pull-requests', label: 'Pull Requests', icon: <GitPullRequest size={13} />, count: prCount },
  ]

  return (
    <div className={styles.tabs}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => setActiveTab(tab.key)}
          className={`${styles.tab} ${activeTab === tab.key ? styles.active : ''}`}
        >
          {tab.icon}
          {tab.label}
          {tab.count > 0 && <span className={styles.tabCount}>{tab.count}</span>}
        </button>
      ))}
    </div>
  )
}
