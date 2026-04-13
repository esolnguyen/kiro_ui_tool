import { useState } from 'react'
import { ClipboardList, GitPullRequest, FlaskConical, ChevronLeft, FolderOpen, FileText, Loader, Plus } from 'lucide-react'
import type { AdoPbi, AdoPullRequest, AdoTestPlan, AdoTestSuite, AdoTestCase } from '../../api/ado'
import { adoApi } from '../../api/ado'
import EmptyState from '../common/EmptyState'
import { useWorkplace } from './WorkplaceContext'
import { TypeBadge, StateBadge, PrStatusBadge } from './Badges'
import GenerateTestSuiteModal from './GenerateTestSuiteModal'
import styles from './workplace.module.scss'

interface ItemListProps {
  pbis: AdoPbi[]
  loading: boolean
  error: string
  pullRequests: AdoPullRequest[]
  prLoading: boolean
  prError: string
  // Test plans
  testPlans: AdoTestPlan[]
  testPlansLoading: boolean
  testPlansError: string
  selectedPlanId: number | null
  onSelectPlan: (id: number | null) => void
  suites: AdoTestSuite[]
  suitesLoading: boolean
  selectedSuiteId: number | null
  onSelectSuite: (id: number | null) => void
  testCases: AdoTestCase[]
  testCasesLoading: boolean
  onRefreshSuites: () => void
  onRefreshPlans: () => void
}

export default function ItemList({
  pbis, loading, error,
  pullRequests, prLoading, prError,
  testPlans, testPlansLoading, testPlansError,
  selectedPlanId, onSelectPlan,
  suites, suitesLoading,
  selectedSuiteId, onSelectSuite,
  testCases, testCasesLoading,
  onRefreshSuites, onRefreshPlans,
}: ItemListProps) {
  const { activeTab, setDetailPbi, setDetailPr } = useWorkplace()

  if (activeTab === 'work-items') {
    if (loading) return <LoadingSpinner />
    if (error) return <div className={styles.errorState}>{error}</div>
    if (pbis.length === 0) return <EmptyState icon={<ClipboardList size={18} />} title="No work items" description="Try changing the filters." />

    return (
      <>
        {pbis.map((pbi) => (
          <div key={pbi.id} className={`hover-bg ${styles.itemCard}`} onClick={() => setDetailPbi(pbi)}>
            <div className={styles.itemMeta}>
              <span className={styles.itemId}>#{pbi.id}</span>
              <TypeBadge type={pbi.workItemType} />
              <StateBadge state={pbi.state} />
            </div>
            <div className={styles.itemTitle}>{pbi.title}</div>
            <div className={styles.itemSub}>
              {pbi.assignedTo && <span>{pbi.assignedTo}</span>}
              {pbi.iterationPath && <span>{pbi.iterationPath}</span>}
            </div>
          </div>
        ))}
      </>
    )
  }

  if (activeTab === 'test-plans') {
    return (
      <TestPlansList
        testPlans={testPlans}
        loading={testPlansLoading}
        error={testPlansError}
        selectedPlanId={selectedPlanId}
        onSelectPlan={onSelectPlan}
        suites={suites}
        suitesLoading={suitesLoading}
        selectedSuiteId={selectedSuiteId}
        onSelectSuite={onSelectSuite}
        testCases={testCases}
        testCasesLoading={testCasesLoading}
        onRefreshSuites={onRefreshSuites}
        onRefreshPlans={onRefreshPlans}
      />
    )
  }

  // Pull Requests tab
  if (prLoading) return <LoadingSpinner />
  if (prError) return <div className={styles.errorState}>{prError}</div>
  if (pullRequests.length === 0) return <EmptyState icon={<GitPullRequest size={18} />} title="No pull requests" description="No PRs found with the current filters." />

  return (
    <>
      {pullRequests.map((pr) => (
        <div key={pr.id} className={`hover-bg ${styles.itemCard}`} onClick={() => setDetailPr(pr)}>
          <div className={styles.itemMeta}>
            <span className={styles.itemId}>!{pr.id}</span>
            <PrStatusBadge status={pr.status} />
            <span className={styles.itemRepoName}>{pr.repositoryName}</span>
          </div>
          <div className={styles.itemTitle}>{pr.title}</div>
          <div className={styles.itemSub}>
            <span>{pr.createdBy}</span>
            <span>{pr.sourceBranch} → {pr.targetBranch}</span>
          </div>
        </div>
      ))}
    </>
  )
}

function TestPlansList({
  testPlans, loading, error,
  selectedPlanId, onSelectPlan,
  suites, suitesLoading,
  selectedSuiteId, onSelectSuite,
  testCases, testCasesLoading,
  onRefreshSuites, onRefreshPlans,
}: {
  testPlans: AdoTestPlan[]
  loading: boolean
  error: string
  selectedPlanId: number | null
  onSelectPlan: (id: number | null) => void
  suites: AdoTestSuite[]
  suitesLoading: boolean
  selectedSuiteId: number | null
  onSelectSuite: (id: number | null) => void
  testCases: AdoTestCase[]
  testCasesLoading: boolean
  onRefreshSuites: () => void
  onRefreshPlans: () => void
}) {
  const [showCreatePlan, setShowCreatePlan] = useState(false)
  const [newPlanName, setNewPlanName] = useState('')
  const [creating, setCreating] = useState(false)
  const [showGenModal, setShowGenModal] = useState(false)

  async function handleCreatePlan() {
    if (!newPlanName.trim()) return
    setCreating(true)
    try {
      await adoApi.createTestPlan(newPlanName.trim())
      setNewPlanName('')
      setShowCreatePlan(false)
      onRefreshPlans()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to create test plan')
    } finally {
      setCreating(false)
    }
  }

  // Drill-down: test cases view
  if (selectedPlanId && selectedSuiteId) {
    const suite = suites.find((s) => s.id === selectedSuiteId)
    return (
      <>
        <button className={`hover-bg ${styles.backBtn}`} onClick={() => onSelectSuite(null)}>
          <ChevronLeft size={12} /> Back to suites
        </button>
        <div className={styles.drilldownTitle}>
          <FileText size={12} />
          {suite?.name || `Suite #${selectedSuiteId}`}
        </div>
        {testCasesLoading ? <LoadingSpinner /> : testCases.length === 0 ? (
          <EmptyState icon={<FileText size={18} />} title="No test cases" description="This suite has no test cases." />
        ) : (
          testCases.map((tc) => (
            <div key={tc.id} className={`${styles.itemCard}`}>
              <div className={styles.itemMeta}>
                <span className={styles.itemId}>TC-{tc.id}</span>
                {tc.priority > 0 && <span className={styles.testPriority}>P{tc.priority}</span>}
                {tc.automationStatus && <span className={styles.testAutomation}>{tc.automationStatus}</span>}
              </div>
              <div className={styles.itemTitle}>{tc.name}</div>
              {tc.state && <div className={styles.itemSub}><span>{tc.state}</span></div>}
            </div>
          ))
        )}
      </>
    )
  }

  // Drill-down: suites view
  if (selectedPlanId) {
    const plan = testPlans.find((p) => p.id === selectedPlanId)
    return (
      <>
        <div className={styles.drilldownHeader}>
          <button className={`hover-bg ${styles.backBtn}`} onClick={() => onSelectPlan(null)}>
            <ChevronLeft size={12} /> Back to plans
          </button>
          <button
            className={`btn btn-ghost ${styles.drilldownAddBtn}`}
            onClick={() => setShowGenModal(true)}
            title="Generate test suite from PBI"
          >
            <Plus size={13} />
          </button>
        </div>
        <div className={styles.drilldownTitle}>
          <FlaskConical size={12} />
          {plan?.name || `Plan #${selectedPlanId}`}
        </div>
        {suitesLoading ? <LoadingSpinner /> : suites.length === 0 ? (
          <EmptyState icon={<FolderOpen size={18} />} title="No suites" description="Click + to generate a test suite from a work item." />
        ) : (
          suites.map((suite) => (
            <div key={suite.id} className={`hover-bg ${styles.itemCard}`} onClick={() => onSelectSuite(suite.id)}>
              <div className={styles.itemMeta}>
                <FolderOpen size={11} style={{ color: 'var(--text-tertiary)' }} />
                <span className={styles.itemId}>#{suite.id}</span>
                <span className={styles.testSuiteType}>{suite.suiteType.replace('TestSuite', '')}</span>
              </div>
              <div className={styles.itemTitle}>{suite.name}</div>
              <div className={styles.itemSub}>
                <span>{suite.testCaseCount} test case{suite.testCaseCount !== 1 ? 's' : ''}</span>
              </div>
            </div>
          ))
        )}

        {showGenModal && plan && (
          <GenerateTestSuiteModal
            planId={selectedPlanId}
            planName={plan.name}
            onClose={() => setShowGenModal(false)}
            onCreated={onRefreshSuites}
          />
        )}
      </>
    )
  }

  // Top-level: plans list
  if (loading) return <LoadingSpinner />
  if (error) return <div className={styles.errorState}>{error}</div>

  return (
    <>
      {/* Create plan inline form */}
      {showCreatePlan ? (
        <div className={styles.createPlanForm}>
          <input
            className={`input ${styles.createPlanInput}`}
            value={newPlanName}
            onChange={(e) => setNewPlanName(e.target.value)}
            placeholder="Test plan name..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreatePlan()
              if (e.key === 'Escape') { setShowCreatePlan(false); setNewPlanName('') }
            }}
          />
          <button
            className={`btn btn-primary ${styles.createPlanSubmit}`}
            onClick={handleCreatePlan}
            disabled={!newPlanName.trim() || creating}
          >
            {creating ? <Loader size={11} className={styles.spin} /> : <Plus size={11} />}
            Create
          </button>
        </div>
      ) : (
        <button className={`hover-bg ${styles.addPlanBtn}`} onClick={() => setShowCreatePlan(true)}>
          <Plus size={12} />
          New Test Plan
        </button>
      )}

      {testPlans.length === 0 && !showCreatePlan ? (
        <EmptyState icon={<FlaskConical size={18} />} title="No test plans" description="Create a test plan to get started." />
      ) : (
        testPlans.map((plan) => (
          <div key={plan.id} className={`hover-bg ${styles.itemCard}`} onClick={() => onSelectPlan(plan.id)}>
            <div className={styles.itemMeta}>
              <FlaskConical size={11} style={{ color: 'var(--text-tertiary)' }} />
              <span className={styles.itemId}>#{plan.id}</span>
              <span className={`${styles.badge} ${plan.state === 'Active' ? styles.badgeActive : styles.badgeInactive}`}>
                {plan.state}
              </span>
            </div>
            <div className={styles.itemTitle}>{plan.name}</div>
            <div className={styles.itemSub}>
              {plan.areaPath && <span>{plan.areaPath}</span>}
              {plan.iteration && <span>{plan.iteration}</span>}
            </div>
          </div>
        ))
      )}
    </>
  )
}

function LoadingSpinner() {
  return (
    <div className={styles.loadingState}>
      <Loader size={14} className={styles.spin} style={{ marginBottom: 8 }} />
      <div>Loading...</div>
    </div>
  )
}
