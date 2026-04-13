import { useState } from 'react'
import {
  CheckCircle, XCircle, Loader, Clock, MessageSquare,
  ThumbsUp, ThumbsDown, RefreshCw, X, Send,
  ChevronDown, ChevronRight,
} from 'lucide-react'
import { useWorkplace } from './WorkplaceContext'
import type { StageExecution } from '../../types'
import styles from './workplace.module.scss'

function statusIcon(status: StageExecution['status'], size = 12) {
  switch (status) {
    case 'running': return <Loader size={size} className={styles.spin} />
    case 'completed': return <CheckCircle size={size} className={styles.pipelineIconCompleted} />
    case 'failed': return <XCircle size={size} className={styles.pipelineIconFailed} />
    case 'waiting_approval': return <Clock size={size} className={styles.pipelineIconWaiting} />
    case 'waiting_input': return <MessageSquare size={size} className={styles.pipelineIconWaiting} />
    default: return <div className={styles.pipelineStageDot} />
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'pending': return 'Pending'
    case 'running': return 'Running'
    case 'completed': return 'Completed'
    case 'failed': return 'Failed'
    case 'waiting_approval': return 'Awaiting Approval'
    case 'waiting_input': return 'Awaiting Input'
    default: return status
  }
}

export default function PipelineStatusBar() {
  const {
    activePipelineRun: run,
    dismissPipelineRun,
    approvePipelineStage,
    rejectPipelineStage,
    submitPipelineInput,
    retryPipelineStage,
  } = useWorkplace()

  const [expanded, setExpanded] = useState(false)
  const [stageInput, setStageInput] = useState('')

  if (!run) return null

  const completedCount = run.stages.filter((s) => s.status === 'completed').length
  const activeStage = run.stages.find(
    (s) => s.status === 'running' || s.status === 'waiting_approval' || s.status === 'waiting_input'
  )

  return (
    <div className={styles.pipelineBar}>
      {/* Summary row */}
      <div className={styles.pipelineBarHeader} onClick={() => setExpanded(!expanded)}>
        <button className={`btn btn-ghost ${styles.pipelineBarToggle}`}>
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        {statusIcon(run.status as StageExecution['status'])}
        <span className={styles.pipelineBarName}>{run.pipelineName}</span>
        <span className={styles.pipelineBarMeta}>
          {completedCount}/{run.stages.length} stages &middot; {statusLabel(run.status)}
        </span>
        <div className={styles.pipelineBarProgress}>
          {run.stages.map((stage) => (
            <div
              key={stage.id}
              className={`${styles.pipelineBarSegment} ${styles[`pipelineBarSegment--${stage.status}`] || ''}`}
            />
          ))}
        </div>
        <button
          className={`btn btn-ghost ${styles.pipelineBarDismiss}`}
          onClick={(e) => { e.stopPropagation(); dismissPipelineRun() }}
          title="Close pipeline"
        >
          <X size={12} />
        </button>
      </div>

      {/* Expanded stage list */}
      {expanded && (
        <div className={styles.pipelineBarStages}>
          {run.stages.map((stage, i) => (
            <div key={stage.id} className={styles.pipelineBarStage}>
              <div className={styles.pipelineBarStageRow}>
                {statusIcon(stage.status)}
                <span className={styles.pipelineBarStageNum}>{i + 1}</span>
                <span className={styles.pipelineBarStageId}>{stage.id}</span>
                <span className={styles.pipelineBarStageStatus}>{statusLabel(stage.status)}</span>

                {stage.status === 'waiting_approval' && (
                  <div className={styles.pipelineBarStageActions}>
                    <button
                      className={`btn btn-primary ${styles.pipelineBarSmallBtn}`}
                      onClick={() => approvePipelineStage(stage.id)}
                    >
                      <ThumbsUp size={10} /> Approve
                    </button>
                    <button
                      className={`btn btn-secondary ${styles.pipelineBarSmallBtn}`}
                      onClick={() => rejectPipelineStage(stage.id)}
                    >
                      <ThumbsDown size={10} /> Reject
                    </button>
                  </div>
                )}

                {stage.status === 'failed' && (
                  <button
                    className={`btn btn-secondary ${styles.pipelineBarSmallBtn}`}
                    onClick={() => retryPipelineStage(stage.id)}
                  >
                    <RefreshCw size={10} /> Retry
                  </button>
                )}
              </div>

              {stage.status === 'waiting_input' && (
                <div className={styles.pipelineBarInputRow}>
                  <input
                    className={`input ${styles.pipelineBarInput}`}
                    value={stageInput}
                    onChange={(e) => setStageInput(e.target.value)}
                    placeholder="Enter input..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && stageInput.trim()) {
                        submitPipelineInput(stage.id, stageInput.trim())
                        setStageInput('')
                      }
                    }}
                  />
                  <button
                    className={`btn btn-primary ${styles.pipelineBarSmallBtn}`}
                    disabled={!stageInput.trim()}
                    onClick={() => {
                      submitPipelineInput(stage.id, stageInput.trim())
                      setStageInput('')
                    }}
                  >
                    <Send size={10} /> Submit
                  </button>
                </div>
              )}

              {stage.error && (
                <div className={styles.pipelineBarError}>{stage.error}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
