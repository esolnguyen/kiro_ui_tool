import { X, ExternalLink, Eye, GitPullRequest, Bot } from 'lucide-react'
import { useWorkplace } from './WorkplaceContext'
import { PrStatusBadge } from './Badges'
import styles from './workplace.module.scss'

export default function PrDetailModal() {
  const {
    detailPr, setDetailPr,
    agentSlug, setAgentSlug,
    agents, sendPromptToTerminal,
  } = useWorkplace()

  if (!detailPr) return null

  function handleReview() {
    const pr = detailPr!
    const prompt = `Review this pull request:\n\nTitle: ${pr.title}\nPR #${pr.id}\nRepository: ${pr.repositoryName}\nBranch: ${pr.sourceBranch} → ${pr.targetBranch}\nAuthor: ${pr.createdBy}${pr.description ? `\n\nDescription:\n${pr.description}` : ''}${pr.reviewers.length ? `\nReviewers: ${pr.reviewers.join(', ')}` : ''}`
    sendPromptToTerminal(prompt)
    setDetailPr(null)
  }

  return (
    <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) setDetailPr(null) }}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalMeta}>
              <GitPullRequest size={14} style={{ color: 'var(--accent)' }} />
              <span className={styles.modalId}>!{detailPr.id}</span>
              <PrStatusBadge status={detailPr.status} />
            </div>
            <h2 className={styles.modalTitle}>{detailPr.title}</h2>
          </div>
          <button onClick={() => setDetailPr(null)} className={`btn btn-ghost ${styles.modalClose}`}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>
          <div className={styles.modalFields}>
            <div><span className={styles.modalFieldLabel}>Repository</span>{detailPr.repositoryName}</div>
            <div><span className={styles.modalFieldLabel}>Author</span>{detailPr.createdBy}</div>
            <div><span className={styles.modalFieldLabel}>Branch</span>{detailPr.sourceBranch} → {detailPr.targetBranch}</div>
            {detailPr.creationDate && (
              <div><span className={styles.modalFieldLabel}>Created</span>{new Date(detailPr.creationDate).toLocaleDateString()}</div>
            )}
          </div>
          {detailPr.reviewers.length > 0 && (
            <div>
              <span className={styles.modalSectionLabel}>Reviewers</span>
              <div className={styles.reviewerList}>
                {detailPr.reviewers.map((r) => (
                  <span key={r} className={styles.reviewerChip}>{r}</span>
                ))}
              </div>
            </div>
          )}
          {detailPr.description && (
            <div>
              <span className={styles.modalSectionLabel}>Description</span>
              <div className={styles.modalContentPre}>{detailPr.description}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <div className={styles.agentRow}>
            <Bot size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            <select value={agentSlug} onChange={(e) => setAgentSlug(e.target.value)}
              className={`input ${styles.agentSelect}`}>
              <option value="">Default (no agent)</option>
              {agents.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
            </select>
          </div>
          <div className={styles.modalFooterActions}>
            {detailPr.url ? (
              <a href={detailPr.url} target="_blank" rel="noopener noreferrer" className={styles.modalLink}>
                <ExternalLink size={11} /> Open in Azure DevOps
              </a>
            ) : <div />}
            <button className={`btn btn-primary ${styles.modalAction}`} onClick={handleReview}>
              <Eye size={12} />
              Review PR
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
