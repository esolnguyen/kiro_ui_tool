import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    CheckCircle,
    XCircle,
    Loader,
    Clock,
    ChevronDown,
    ChevronRight,
    ArrowLeft,
    RefreshCw,
    ThumbsUp,
    ThumbsDown,
    AlertCircle,
    Send,
    MessageSquare,
} from 'lucide-react'
import type { PipelineRun, StageExecution } from '../../types'
import { pipelineRunsApi } from '../../api/pipelines'
import './PipelineRunPage.scss'

const WS_BASE = `ws://${window.location.hostname}:${window.location.port || '8000'}`

function statusIcon(status: StageExecution['status'], size = 16) {
    switch (status) {
        case 'running':
            return <Loader size={size} className="pipeline-run__status-icon--running pipeline-run__spin" />
        case 'completed':
            return <CheckCircle size={size} className="pipeline-run__status-icon--completed" />
        case 'failed':
            return <XCircle size={size} className="pipeline-run__status-icon--failed" />
        case 'waiting_approval':
            return <Clock size={size} className="pipeline-run__status-icon--waiting" />
        case 'waiting_input':
            return <MessageSquare size={size} className="pipeline-run__status-icon--waiting" />
        default:
            return <div className="pipeline-run__status-dot" style={{ width: size, height: size }} />
    }
}

function statusLabel(status: string): string {
    switch (status) {
        case 'pending': return 'Pending'
        case 'running': return 'Running'
        case 'completed': return 'Completed'
        case 'failed': return 'Failed'
        case 'waiting_approval': return 'Waiting Approval'
        case 'waiting_input': return 'Waiting Input'
        default: return status
    }
}

function progressModifier(status: string): string {
    switch (status) {
        case 'completed': return 'pipeline-run__progress-segment--completed'
        case 'running': return 'pipeline-run__progress-segment--running'
        case 'failed': return 'pipeline-run__progress-segment--failed'
        case 'waiting_approval':
        case 'waiting_input': return 'pipeline-run__progress-segment--waiting'
        default: return ''
    }
}

function stageModifier(status: string): string {
    switch (status) {
        case 'running': return 'pipeline-run__stage--running'
        case 'failed': return 'pipeline-run__stage--failed'
        case 'waiting_approval':
        case 'waiting_input': return 'pipeline-run__stage--waiting'
        default: return ''
    }
}

export default function PipelineRunPage() {
    const { runId } = useParams<{ runId: string }>()
    const navigate = useNavigate()
    const [run, setRun] = useState<PipelineRun | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [expandedStage, setExpandedStage] = useState<string | null>(null)
    const [stageInput, setStageInput] = useState('')
    const outputRef = useRef<HTMLPreElement>(null)
    const wsRef = useRef<WebSocket | null>(null)

    // Fetch initial state + connect WebSocket
    useEffect(() => {
        if (!runId) return

        let cancelled = false

        async function fetchRun() {
            try {
                const data = await pipelineRunsApi.get(runId!)
                if (!cancelled) {
                    setRun(data)
                    setLoading(false)
                    // Auto-expand the currently active stage
                    const active = data.stages.find((s) => s.status === 'running' || s.status === 'waiting_approval')
                    if (active) setExpandedStage(active.id)
                }
            } catch (e) {
                if (!cancelled) {
                    setError(e instanceof Error ? e.message : 'Failed to load run')
                    setLoading(false)
                }
            }
        }

        fetchRun()

        // WebSocket for live updates
        const ws = new WebSocket(`${WS_BASE}/ws/pipeline-runs/${runId}`)
        wsRef.current = ws

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data)
                if (msg.run) {
                    setRun(msg.run as PipelineRun)
                    // Auto-expand running/waiting stage
                    const active = (msg.run as PipelineRun).stages.find(
                        (s: StageExecution) => s.status === 'running' || s.status === 'waiting_approval'
                    )
                    if (active) setExpandedStage(active.id)
                }
            } catch {
                // ignore parse errors
            }
        }

        ws.onerror = () => {
            // WebSocket errors are non-fatal — we still have REST polling as fallback
        }

        return () => {
            cancelled = true
            ws.close()
        }
    }, [runId])

    // Auto-scroll output
    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight
        }
    }, [run, expandedStage])

    async function handleApprove(stageId: string) {
        if (!runId) return
        try {
            const updated = await pipelineRunsApi.approveStage(runId, stageId)
            setRun(updated)
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Approve failed')
        }
    }

    async function handleReject(stageId: string) {
        if (!runId) return
        try {
            const updated = await pipelineRunsApi.rejectStage(runId, stageId)
            setRun(updated)
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Reject failed')
        }
    }

    async function handleSubmitInput(stageId: string) {
        if (!runId || !stageInput.trim()) return
        try {
            const updated = await pipelineRunsApi.submitInput(runId, stageId, stageInput.trim())
            setRun(updated)
            setStageInput('')
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Submit failed')
        }
    }

    async function handleRetry(stageId: string) {
        if (!runId) return
        try {
            const updated = await pipelineRunsApi.retryStage(runId, stageId)
            setRun(updated)
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Retry failed')
        }
    }

    if (loading) {
        return (
            <div className="pipeline-run__loading">
                <Loader size={20} className="pipeline-run__spin" />
                <div className="pipeline-run__loading-text">Loading run...</div>
            </div>
        )
    }

    if (error || !run) {
        return (
            <div className="pipeline-run__error">
                <AlertCircle size={20} />
                <div className="pipeline-run__error-text">{error || 'Run not found'}</div>
                <button className="btn btn-secondary pipeline-run__error-back" onClick={() => navigate('/pipelines')}>
                    Back to Pipelines
                </button>
            </div>
        )
    }

    const completedCount = run.stages.filter((s) => s.status === 'completed').length

    return (
        <div className="pipeline-run">
            {/* Header */}
            <div className="pipeline-run__header">
                <button
                    className="btn btn-ghost pipeline-run__back-btn"
                    onClick={() => navigate('/pipelines')}
                >
                    <ArrowLeft size={16} />
                </button>
                <div className="pipeline-run__header-info">
                    <div className="pipeline-run__title">
                        {run.pipelineName}
                    </div>
                    <div className="pipeline-run__subtitle">
                        Run {run.id.slice(0, 8)} · {completedCount}/{run.stages.length} stages · {statusLabel(run.status)}
                    </div>
                </div>
                {statusIcon(run.status as StageExecution['status'], 20)}
            </div>

            {/* Stage progress bar */}
            <div className="pipeline-run__progress">
                {run.stages.map((stage, i) => (
                    <div
                        key={stage.id}
                        className={`pipeline-run__progress-segment ${progressModifier(stage.status)}`}
                        title={`Stage ${i + 1}: ${statusLabel(stage.status)}`}
                    />
                ))}
            </div>

            {/* Stages list */}
            <div className="pipeline-run__stages">
                <div className="pipeline-run__stages-list">
                    {run.stages.map((stage, index) => {
                        const isExpanded = expandedStage === stage.id
                        return (
                            <div
                                key={stage.id}
                                className={`pipeline-run__stage ${stageModifier(stage.status)}`}
                            >
                                {/* Stage header */}
                                <div
                                    className="pipeline-run__stage-header"
                                    onClick={() => setExpandedStage(isExpanded ? null : stage.id)}
                                >
                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    <div className="pipeline-run__stage-number">
                                        {index + 1}
                                    </div>
                                    <div className="pipeline-run__stage-info">
                                        <div className="pipeline-run__stage-name">
                                            {stage.id}
                                        </div>
                                        <div className="pipeline-run__stage-meta">
                                            {statusLabel(stage.status)}
                                            {stage.startedAt && ` · Started ${new Date(stage.startedAt).toLocaleTimeString()}`}
                                        </div>
                                    </div>
                                    {statusIcon(stage.status)}

                                    {/* Action buttons */}
                                    {stage.status === 'waiting_approval' && (
                                        <div className="pipeline-run__stage-actions">
                                            <button
                                                className="btn btn-primary pipeline-run__approve-btn"
                                                onClick={(e) => { e.stopPropagation(); handleApprove(stage.id) }}
                                            >
                                                <ThumbsUp size={12} />
                                                Approve
                                            </button>
                                            <button
                                                className="btn btn-secondary pipeline-run__reject-btn"
                                                onClick={(e) => { e.stopPropagation(); handleReject(stage.id) }}
                                            >
                                                <ThumbsDown size={12} />
                                                Reject
                                            </button>
                                        </div>
                                    )}
                                    {stage.status === 'failed' && (
                                        <button
                                            className="btn btn-secondary pipeline-run__retry-btn"
                                            onClick={(e) => { e.stopPropagation(); handleRetry(stage.id) }}
                                        >
                                            <RefreshCw size={12} />
                                            Retry
                                        </button>
                                    )}
                                </div>

                                {/* Manual input form */}
                                {isExpanded && stage.status === 'waiting_input' && (
                                    <div className="pipeline-run__input-form">
                                        <div className="pipeline-run__input-label">
                                            Additional input required
                                        </div>
                                        <textarea
                                            className="field-input pipeline-run__input-textarea"
                                            value={stageInput}
                                            onChange={(e) => setStageInput(e.target.value)}
                                            placeholder="Enter additional context or instructions..."
                                            rows={3}
                                        />
                                        <div className="pipeline-run__input-actions">
                                            <button
                                                className="btn btn-primary pipeline-run__input-submit"
                                                disabled={!stageInput.trim()}
                                                onClick={() => handleSubmitInput(stage.id)}
                                            >
                                                <Send size={12} />
                                                Submit
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Expanded output */}
                                {isExpanded && (stage.output || stage.error) && (
                                    <div className="pipeline-run__output">
                                        {stage.error && (
                                            <div
                                                className={`pipeline-run__output-error${stage.output ? ' pipeline-run__output-error--with-output' : ''}`}
                                            >
                                                {stage.error}
                                            </div>
                                        )}
                                        {stage.output && (
                                            <pre
                                                ref={isExpanded ? outputRef : undefined}
                                                className="pipeline-run__output-pre"
                                            >
                                                {stage.output}
                                            </pre>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
