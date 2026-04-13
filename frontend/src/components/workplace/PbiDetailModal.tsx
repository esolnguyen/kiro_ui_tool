import { X, ExternalLink, Play, Bot, Layers } from 'lucide-react'
import { useWorkplace } from './WorkplaceContext'
import { TypeBadge, StateBadge } from './Badges'
import styles from './workplace.module.scss'

export default function PbiDetailModal() {
  const {
    detailPbi, setDetailPbi,
    runMode, setRunMode,
    agentSlug, setAgentSlug,
    selectedPipelineId, setSelectedPipelineId,
    agents, pipelines,
    sendPromptToTerminal,
    startPipelineRun,
  } = useWorkplace()

  if (!detailPbi) return null

  function buildPrompt() {
    const pbi = detailPbi!
    const isBug = pbi.workItemType.toLowerCase().includes('bug')
    const taskType = isBug ? 'bug' : 'PBI'
    return `Implement this ${taskType}:\n\nTitle: ${pbi.title}\nID: #${pbi.id}\nType: ${pbi.workItemType}\nState: ${pbi.state}${pbi.description ? `\n\nDescription:\n${pbi.description}` : ''}${pbi.tags ? `\nTags: ${pbi.tags}` : ''}`
  }

  async function handleStart() {
    if (runMode === 'pipeline') {
      if (!selectedPipelineId) return
      try {
        await startPipelineRun(selectedPipelineId, {
          pbiId: String(detailPbi!.id),
          title: detailPbi!.title,
          pbiUrl: detailPbi!.url || '',
        })
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Failed to start pipeline')
      }
      setDetailPbi(null)
      return
    }
    sendPromptToTerminal(buildPrompt())
    setDetailPbi(null)
  }

  return (
    <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) setDetailPbi(null) }}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalMeta}>
              <span className={styles.modalId}>#{detailPbi.id}</span>
              <TypeBadge type={detailPbi.workItemType} />
              <StateBadge state={detailPbi.state} />
            </div>
            <h2 className={styles.modalTitle}>{detailPbi.title}</h2>
          </div>
          <button onClick={() => setDetailPbi(null)} className={`btn btn-ghost ${styles.modalClose}`}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>
          <div className={styles.modalFields}>
            {detailPbi.assignedTo && (
              <div><span className={styles.modalFieldLabel}>Assigned To</span>{detailPbi.assignedTo}</div>
            )}
            {detailPbi.iterationPath && (
              <div><span className={styles.modalFieldLabel}>Iteration</span>{detailPbi.iterationPath}</div>
            )}
            {detailPbi.areaPath && (
              <div><span className={styles.modalFieldLabel}>Area</span>{detailPbi.areaPath}</div>
            )}
            {detailPbi.tags && (
              <div><span className={styles.modalFieldLabel}>Tags</span>{detailPbi.tags}</div>
            )}
          </div>
          {detailPbi.description && (
            <div>
              <span className={styles.modalSectionLabel}>Description</span>
              <div className={styles.modalContent} dangerouslySetInnerHTML={{ __html: detailPbi.description }} />
            </div>
          )}
          {detailPbi.acceptanceCriteria && (
            <div>
              <span className={styles.modalSectionLabel}>Acceptance Criteria</span>
              <div className={styles.modalContent} dangerouslySetInnerHTML={{ __html: detailPbi.acceptanceCriteria }} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <div className={styles.runModeRow}>
            <div className={styles.runModeToggle}>
              <button onClick={() => setRunMode('single')}
                className={`${styles.runModeBtn} ${runMode === 'single' ? styles.active : ''}`}>
                <Bot size={11} /> Agent
              </button>
              <button onClick={() => setRunMode('pipeline')}
                className={`${styles.runModeBtn} ${runMode === 'pipeline' ? styles.active : ''}`}>
                <Layers size={11} /> Pipeline
              </button>
            </div>
            {runMode === 'single' ? (
              <select value={agentSlug} onChange={(e) => setAgentSlug(e.target.value)}
                className={`input ${styles.runModeSelect}`}>
                <option value="">Default (no agent)</option>
                {agents.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
              </select>
            ) : (
              <select value={selectedPipelineId ?? ''} onChange={(e) => setSelectedPipelineId(e.target.value || null)}
                className={`input ${styles.runModeSelect}`}>
                <option value="">Select pipeline...</option>
                {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>
          <div className={styles.modalFooterActions}>
            {detailPbi.url ? (
              <a href={detailPbi.url} target="_blank" rel="noopener noreferrer" className={styles.modalLink}>
                <ExternalLink size={11} /> Open in Azure DevOps
              </a>
            ) : <div />}
            <button
              className={`btn btn-primary ${styles.modalAction}`}
              disabled={runMode === 'pipeline' && !selectedPipelineId}
              onClick={handleStart}
            >
              <Play size={12} />
              {runMode === 'single' ? 'Start Agent' : 'Run Pipeline'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
