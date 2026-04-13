import { useState, useEffect } from 'react'
import { X, Search, Bot, Play, Loader, FlaskConical } from 'lucide-react'
import { adoApi, type AdoPbi, type AdoAreaPath } from '../../api/ado'
import { useWorkplace } from './WorkplaceContext'
import { TypeBadge, StateBadge } from './Badges'
import styles from './workplace.module.scss'

interface GenerateTestSuiteModalProps {
  planId: number
  planName: string
  onClose: () => void
  onCreated: () => void
}

export default function GenerateTestSuiteModal({ planId, planName, onClose, onCreated }: GenerateTestSuiteModalProps) {
  const { agents, agentSlug, setAgentSlug, sendPromptToTerminal, termReady } = useWorkplace()

  const [pbis, setPbis] = useState<AdoPbi[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [areaFilter, setAreaFilter] = useState('')
  const [areaPaths, setAreaPaths] = useState<AdoAreaPath[]>([])
  const [selectedPbi, setSelectedPbi] = useState<AdoPbi | null>(null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    adoApi.areaPaths().then(setAreaPaths).catch(() => {})
  }, [])

  useEffect(() => {
    fetchPbis()
  }, [stateFilter, areaFilter])

  async function fetchPbis() {
    setLoading(true)
    try {
      const items = await adoApi.listPbis({
        ...(stateFilter ? { state: stateFilter } : {}),
        ...(areaFilter ? { area_path: areaFilter } : {}),
        top: 50,
      })
      setPbis(items)
    } catch {
      setPbis([])
    } finally {
      setLoading(false)
    }
  }

  const filtered = pbis.filter((pbi) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      pbi.title.toLowerCase().includes(q) ||
      String(pbi.id).includes(q)
    )
  })

  async function handleGenerate() {
    if (!selectedPbi) return
    setGenerating(true)
    try {
      // 1. Create the test suite in ADO (requirement-based, linked to PBI)
      await adoApi.createTestSuite(planId, selectedPbi.title, 'requirementTestSuite')

      // 2. Build prompt for the agent
      const prompt = [
        `Generate test cases for the following work item and create them in Azure DevOps Test Plan "${planName}" (Plan ID: ${planId}).`,
        '',
        `Work Item #${selectedPbi.id}: ${selectedPbi.title}`,
        `Type: ${selectedPbi.workItemType}`,
        `State: ${selectedPbi.state}`,
        selectedPbi.description ? `\nDescription:\n${selectedPbi.description}` : '',
        selectedPbi.acceptanceCriteria ? `\nAcceptance Criteria:\n${selectedPbi.acceptanceCriteria}` : '',
        '',
        'Instructions:',
        '1. Analyze the work item description and acceptance criteria',
        '2. Generate comprehensive test cases covering positive, negative, and edge cases',
        '3. Each test case should have a clear title and step-by-step instructions',
        '4. Create the test cases as Azure DevOps Test Case work items',
        `5. Add them to the test suite for "${selectedPbi.title}" in test plan "${planName}"`,
      ].filter(Boolean).join('\n')

      // 3. Send to terminal with selected agent
      sendPromptToTerminal(prompt, agentSlug || undefined)
      onCreated()
      onClose()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to create test suite')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalMeta}>
              <FlaskConical size={13} style={{ color: 'var(--accent)' }} />
              <span className={styles.modalId}>Plan #{planId}</span>
            </div>
            <h2 className={styles.modalTitle}>Generate Test Suite</h2>
          </div>
          <button onClick={onClose} className={`btn btn-ghost ${styles.modalClose}`}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>
          {/* Search & filter */}
          <div className={styles.genSearchRow}>
            <div className={styles.genSearchBox}>
              <Search size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
              <input
                className={styles.genSearchInput}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search work items..."
              />
            </div>
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className={`input ${styles.genFilterSelect}`}
            >
              <option value="">All states</option>
              <option value="New">New</option>
              <option value="Approved">Approved</option>
              <option value="Committed">Committed</option>
              <option value="Done">Done</option>
            </select>
            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              className={`input ${styles.genFilterSelect}`}
            >
              <option value="">All areas</option>
              {areaPaths.map((ap) => (
                <option key={ap.path} value={ap.path}>{ap.name}</option>
              ))}
            </select>
          </div>

          {/* PBI list */}
          <div className={styles.genPbiList}>
            {loading ? (
              <div className={styles.loadingState}>
                <Loader size={14} className={styles.spin} />
                <div>Loading work items...</div>
              </div>
            ) : filtered.length === 0 ? (
              <div className={styles.loadingState}>No work items found</div>
            ) : (
              filtered.map((pbi) => (
                <div
                  key={pbi.id}
                  className={`${styles.genPbiItem} ${selectedPbi?.id === pbi.id ? styles.genPbiItemSelected : ''}`}
                  onClick={() => setSelectedPbi(pbi)}
                >
                  <div className={styles.itemMeta}>
                    <span className={styles.itemId}>#{pbi.id}</span>
                    <TypeBadge type={pbi.workItemType} />
                    <StateBadge state={pbi.state} />
                  </div>
                  <div className={styles.itemTitle}>{pbi.title}</div>
                </div>
              ))
            )}
          </div>

          {/* Selected PBI preview */}
          {selectedPbi && (
            <div className={styles.genSelectedPreview}>
              <span className={styles.modalSectionLabel}>Selected Work Item</span>
              <div className={styles.genSelectedCard}>
                <span className={styles.itemId}>#{selectedPbi.id}</span>
                <span className={styles.genSelectedTitle}>{selectedPbi.title}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <div className={styles.agentRow}>
            <Bot size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            <select
              value={agentSlug}
              onChange={(e) => setAgentSlug(e.target.value)}
              className={`input ${styles.agentSelect}`}
            >
              <option value="">Default (no agent)</option>
              {agents.map((a) => (
                <option key={a.slug} value={a.slug}>{a.name}</option>
              ))}
            </select>
          </div>
          <div className={styles.modalFooterActions}>
            <div />
            <button
              className={`btn btn-primary ${styles.modalAction}`}
              disabled={!selectedPbi || generating || !termReady}
              onClick={handleGenerate}
            >
              {generating ? <Loader size={12} className={styles.spin} /> : <Play size={12} />}
              Generate Test Cases
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
