import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Trash2, Clock } from 'lucide-react'
import type { Agent, AgentMcpServerConfig, ModelType, MemoryType } from '../../types'
import { agentsApi } from '../../api/agents'
import { useAppStore } from '../../stores/appStore'
import PageHeader from '../../components/common/PageHeader'
import InstructionEditor from '../../components/studio/InstructionEditor'
import StudioTerminal from '../../components/studio/StudioTerminal'
import McpServerPicker from '../../components/agents/McpServerPicker'
import KnowledgePanel from '../../components/agents/KnowledgePanel'
import { useDraftRecovery } from '../../hooks/useDraftRecovery'
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges'
import { MODEL_IDS, MODEL_META } from '../../utils/models'
import './AgentDetailPage.scss'

const MEMORY_OPTIONS: { value: MemoryType; label: string }[] = [
    { value: 'user', label: 'User' },
    { value: 'project', label: 'Project' },
    { value: 'none', label: 'None' },
]

export default function AgentDetailPage() {
    const { slug } = useParams<{ slug: string }>()
    const navigate = useNavigate()
    const { fetchAgents } = useAppStore()
    const isNew = !slug || slug === 'new'

    const [agent, setAgent] = useState<Agent | null>(null)
    const [loading, setLoading] = useState(!isNew)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isDirty, setIsDirty] = useState(false)

    // Form state
    const [form, setForm] = useState({
        name: '',
        description: '',
        model: 'sonnet' as ModelType,
        memory: 'user' as MemoryType,
        color: '#6366f1',
        body: '',
        allowedTools: [] as string[],
        mcpServers: {} as Record<string, AgentMcpServerConfig>,
    })

    useUnsavedChanges(isDirty)

    const { clearDraft } = useDraftRecovery(
        'agent',
        slug,
        form as Record<string, unknown>,
        isDirty,
        (data) => {
            setForm(data as typeof form)
            setIsDirty(false)
        }
    )

    useEffect(() => {
        if (isNew) return
        agentsApi
            .get(slug)
            .then((a) => {
                setAgent(a)
                setForm({
                    name: a.name,
                    description: a.description,
                    model: a.model ?? 'sonnet',
                    memory: a.memory ?? 'user',
                    color: a.color ?? '#6366f1',
                    body: a.body,
                    allowedTools: a.allowedTools ?? [],
                    mcpServers: a.mcpServers ?? {},
                })
                clearDraft()
            })
            .catch((e: Error) => setError(e.message))
            .finally(() => setLoading(false))
    }, [slug, isNew]) // eslint-disable-line react-hooks/exhaustive-deps

    function updateForm<K extends keyof typeof form>(key: K, value: typeof form[K]) {
        setForm((f) => ({ ...f, [key]: value }))
        setIsDirty(true)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        setError(null)
        try {
            if (isNew) {
                const created = await agentsApi.create(form)
                clearDraft()
                await fetchAgents()
                navigate(`/agents/${created.slug}`, { replace: true })
            } else {
                await agentsApi.update(slug!, form)
                clearDraft()
                setIsDirty(false)
                await fetchAgents()
                navigate('/agents')
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Save failed')
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete() {
        if (!slug || !confirm(`Delete agent "${slug}"? This cannot be undone.`)) return
        try {
            await agentsApi.delete(slug)
            await fetchAgents()
            navigate('/agents')
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Delete failed')
        }
    }

    if (loading) {
        return <div className="agent-detail__loading">Loading agent...</div>
    }

    return (
        <div className="agent-detail">
            <PageHeader
                title={isNew ? 'New Agent' : (agent?.name ?? slug ?? '')}
                description={isNew ? 'Create a new Kiro agent' : 'Edit agent configuration'}
                action={
                    <div className="agent-detail__header-actions">
                        {!isNew && agent && (
                            <div className="agent-detail__saved-indicator">
                                <Clock size={12} />
                                <span>Saved</span>
                            </div>
                        )}
                        {isDirty && (
                            <span className="agent-detail__unsaved-badge">
                                Unsaved changes
                            </span>
                        )}
                        <button className="btn btn-secondary" onClick={() => navigate('/agents')}>
                            <ArrowLeft size={14} />
                            Back
                        </button>
                        {!isNew && (
                            <button className="btn btn-danger" onClick={handleDelete}>
                                <Trash2 size={14} />
                                Delete
                            </button>
                        )}
                        <button
                            className="btn btn-primary"
                            onClick={handleSubmit}
                            disabled={saving}
                        >
                            {saving ? 'Saving...' : isNew ? 'Create Agent' : 'Save Changes'}
                        </button>
                    </div>
                }
            />

            <div className="agent-detail__content">
                {/* Left: Editor (60%) */}
                <div className="agent-detail__editor">
                    {error && (
                        <div className="agent-detail__error">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="agent-detail__form">
                        {/* Basic info */}
                        <div className="bg-card agent-detail__card">
                            <div className="agent-detail__name-row">
                                {/* Color swatch */}
                                <div className="agent-detail__color-group">
                                    <label className="agent-detail__label">
                                        Color
                                    </label>
                                    <input
                                        type="color"
                                        value={form.color}
                                        onChange={(e) => updateForm('color', e.target.value)}
                                        className="agent-detail__color-input"
                                    />
                                </div>

                                <div className="agent-detail__name-group">
                                    <label className="agent-detail__label">
                                        Name <span className="agent-detail__required">*</span>
                                    </label>
                                    <input
                                        className="field-input"
                                        value={form.name}
                                        onChange={(e) => updateForm('name', e.target.value)}
                                        placeholder="My Agent"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="agent-detail__label">
                                    Description
                                </label>
                                <input
                                    className="field-input"
                                    value={form.description}
                                    onChange={(e) => updateForm('description', e.target.value)}
                                    placeholder="What does this agent do?"
                                />
                            </div>
                        </div>

                        {/* Model */}
                        <div className="bg-card agent-detail__card" style={{ gap: 0 }}>
                            <h3 className="agent-detail__section-title">Model</h3>
                            <div className="agent-detail__options-row">
                                {MODEL_IDS.map((m) => {
                                    const meta = MODEL_META[m]
                                    const selected = form.model === m
                                    return (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => updateForm('model', m as ModelType)}
                                            className="agent-detail__model-btn"
                                            style={{
                                                border: `1px solid ${selected ? meta.color : 'var(--border-default)'}`,
                                                background: selected ? meta.color + '12' : 'var(--input-bg)',
                                                color: selected ? meta.color : 'var(--text-secondary)',
                                                fontWeight: selected ? 600 : 400,
                                            }}
                                        >
                                            <span>{meta.label}</span>
                                            <span className="agent-detail__model-tagline">{meta.tagline}</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Memory */}
                        <div className="bg-card agent-detail__card" style={{ gap: 0 }}>
                            <h3 className="agent-detail__section-title">Memory</h3>
                            <div className="agent-detail__options-row">
                                {MEMORY_OPTIONS.map(({ value, label }) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => updateForm('memory', value)}
                                        className={`agent-detail__memory-btn${form.memory === value ? ' agent-detail__memory-btn--selected' : ''}`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* MCP servers + allowed tools */}
                        <div className="bg-card agent-detail__card">
                            <McpServerPicker
                                servers={form.mcpServers}
                                allowedTools={form.allowedTools}
                                onChange={({ servers, allowedTools }) => {
                                    setForm((f) => ({ ...f, mcpServers: servers, allowedTools }))
                                    setIsDirty(true)
                                }}
                            />
                        </div>

                        {/* Knowledge base */}
                        {!isNew && slug && (
                            <div className="bg-card agent-detail__card">
                                <KnowledgePanel agentSlug={slug} />
                            </div>
                        )}

                        {/* Instructions */}
                        <div className="bg-card agent-detail__card agent-detail__card--instructions">
                            <div className="agent-detail__instructions-body">
                                <InstructionEditor
                                    value={form.body}
                                    onChange={(v) => updateForm('body', v)}
                                    title="Instructions"
                                />
                            </div>
                        </div>
                    </form>
                </div>

                {/* Right: CLI terminal (40%) */}
                <div className="agent-detail__test-panel">
                    <StudioTerminal
                        entityType="agent"
                        slug={isNew ? undefined : slug}
                        entityName={form.name || 'Agent'}
                    />
                </div>
            </div>
        </div>
    )
}
