import { useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import EmptyState from '../../components/common/EmptyState'
import { useWorkplace, WorkplaceProvider } from '../../components/workplace/WorkplaceContext'
import { useWorkItems } from '../../hooks/useWorkItems'
import { usePullRequests } from '../../hooks/usePullRequests'
import { useTestPlans } from '../../hooks/useTestPlans'
import WorkplaceHeader from '../../components/workplace/WorkplaceHeader'
import WorkplaceTabs from '../../components/workplace/WorkplaceTabs'
import { WorkItemFilters, PrFilters } from '../../components/workplace/WorkplaceFilters'
import CreatePbiForm from '../../components/workplace/CreatePbiForm'
import ItemList from '../../components/workplace/ItemList'
import TerminalPanel from '../../components/workplace/TerminalPanel'
import PbiDetailModal from '../../components/workplace/PbiDetailModal'
import PrDetailModal from '../../components/workplace/PrDetailModal'
import styles from '../../components/workplace/workplace.module.scss'
import 'xterm/css/xterm.css'

function WorkplaceContent() {
  const navigate = useNavigate()
  const { activeTab, status } = useWorkplace()

  const workItems = useWorkItems()
  const prs = usePullRequests(activeTab === 'pull-requests')
  const tp = useTestPlans(activeTab === 'test-plans')

  const isLoading = activeTab === 'work-items' ? workItems.loading : activeTab === 'test-plans' ? tp.loading : prs.loading

  function handleRefresh() {
    if (activeTab === 'work-items') workItems.refresh()
    else if (activeTab === 'test-plans') tp.refresh()
    else prs.refresh()
  }

  if (status && !status.connected) {
    return (
      <div className={styles.notConnected}>
        <EmptyState
          icon={<AlertCircle size={22} />}
          title="Azure DevOps not configured"
          description={status.error || 'Configure your Azure DevOps connection in Settings.'}
          action={<button className="btn btn-primary" onClick={() => navigate('/settings')}>Go to Settings</button>}
        />
      </div>
    )
  }

  return (
    <div className={styles.workplace}>
      {/* Left panel */}
      <div className={styles.leftPanel}>
        <WorkplaceHeader isLoading={isLoading} onRefresh={handleRefresh} />
        <WorkplaceTabs
          workItemCount={workItems.pbis.length}
          testPlanCount={tp.testPlans.length}
          prCount={prs.allPullRequests.length}
        />

        {activeTab === 'work-items' ? (
          <WorkItemFilters
            typeFilter={workItems.typeFilter} setTypeFilter={workItems.setTypeFilter}
            stateFilter={workItems.stateFilter} setStateFilter={workItems.setStateFilter}
            areaFilter={workItems.areaFilter} setAreaFilter={workItems.setAreaFilter}
            boardColumns={workItems.boardColumns}
          />
        ) : activeTab === 'pull-requests' ? (
          <PrFilters
            statusFilter={prs.statusFilter} setStatusFilter={prs.setStatusFilter}
            repoFilter={prs.repoFilter} setRepoFilter={prs.setRepoFilter}
            creatorFilter={prs.creatorFilter} setCreatorFilter={prs.setCreatorFilter}
            repos={prs.repos} creators={prs.creators}
          />
        ) : null}

        <CreatePbiForm areaFilter={workItems.areaFilter} />

        <div className={styles.listContent}>
          <ItemList
            pbis={workItems.pbis} loading={workItems.loading} error={workItems.error}
            pullRequests={prs.pullRequests} prLoading={prs.loading} prError={prs.error}
            testPlans={tp.testPlans} testPlansLoading={tp.loading} testPlansError={tp.error}
            selectedPlanId={tp.selectedPlanId} onSelectPlan={tp.selectPlan}
            suites={tp.suites} suitesLoading={tp.suitesLoading}
            selectedSuiteId={tp.selectedSuiteId} onSelectSuite={tp.setSelectedSuiteId}
            testCases={tp.testCases} testCasesLoading={tp.testCasesLoading}
            onRefreshSuites={tp.refreshSuites} onRefreshPlans={tp.refresh}
          />
        </div>
      </div>

      {/* Right panel — terminal */}
      <TerminalPanel />

      {/* Modals */}
      <PbiDetailModal />
      <PrDetailModal />
    </div>
  )
}

export default function WorkplacePage() {
  return (
    <WorkplaceProvider>
      <WorkplaceContent />
    </WorkplaceProvider>
  )
}
