import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Trash2 } from 'lucide-react'
import type { Command, SkillContext } from '../../types'
import { commandsApi } from '../../api/commands'
import { useAppStore } from '../../stores/appStore'
import PageHeader from '../../components/common/PageHeader'
import InstructionEditor from '../../components/studio/InstructionEditor'
import StudioTerminal from '../../components/studio/StudioTerminal'
import { useDraftRecovery } from '../../hooks/useDraftRecovery'
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges'
import './CommandDetailPage.scss'

const AVAILABLE_TOOLS = ['Read', 'Grep', 'Glob', 'Bash', 'Write', 'Edit', 'WebFetch', 'WebSearch']

export default function CommandDetailPage() {
    const { slug } = useParams<{ slug: string }>()
    const navigate = useNavigate()
    const { fetchCommands, agents } = useAppStore()
    const isNew = !slug || slug === 'new'

    const [command, setCommand] = useState<Command | null>(null)
    const [loading, setLoading] = useState(!isNew)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isDirty, setIsDirty] = useState(false)

    const [form, setForm] = useState({
        name: '',
        description: '',
        argumentHint: '',
        agent: '',
        allowedTools: [] as string[],
        body: '',
    })

    useUnsavedChanges(isDirty)
    const { clearDraft } = useDraftRecovery('command', slug, form as Record<string, unknown>, isDirty, (data) => {
        setForm(data as typeof form)
        setIsDirty(false)
    })

    useEffect(() => {
        if (isNew) return
        commandsApi
            .get(slug)
            .then((c) => {
                setCommand(c)
                setForm({
                    name: c.name,
                    description: c.description,
                    argumentHint: c.argumentHint ?? '',
                    agent: c.agent ?? '',
                    allowedTools: c.allowedTools ?? [],
                    body: c.body,
                })
            })
            .catch((e: Error) => setError(e.message))
            .finally(() => setLoading(false))
    }, [slug, isNew])

    function updateForm<K extends keyof typeof form>(key: K, value: typeof form[K]) {
        setForm((f) => ({ ...f, [key]: value }))
        setIsDirty(true)
    }

    async function handleSubmit(e?: React.FormEvent) {
        e?.preventDefault()
        setSaving(true)
        setError(null)
        try {
            const data: Omit<Command, 'slug'> = {
                name: form.name,
                description: form.description,
                argumentHint: form.argumentHint || undefined,
                agent: form.agent || undefined,
                allowedTools: form.allowedTools.length > 0 ? form.allowedTools : undefined,
                body: form.body,
            }
            if (isNew) {
                const created = await commandsApi.create(data)
                clearDraft()
                await fetchCommands()
                navigate(`/commands/${created.slug}`, { replace: true })
            } else {
                await commandsApi.update(slug!, data)
                clearDraft()
                setIsDirty(false)
                await fetchCommands()
                navigate('/commands')
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Save failed')
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete() {
        if (!slug || !confirm(`Delete command "${slug}"?`)) return
        try {
            await commandsApi.delete(slug)
            await fetchCommands()
            navigate('/commands')
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Delete failed')
        }
    }

    if (loading) {
        return <div className="command-detail__loading">Loading command...</div>
    }

    return (
        <div className="command-detail">
            <PageHeader
                title={isNew ? 'New Command' : (command?.name ?? slug ?? '')}
                description={isNew ? 'Create a new slash command' : 'Edit command'}
                action={
                    <div className="command-detail__header-actions">
                        {isDirty && (
                            <span className="command-detail__unsaved-badge">
                                Unsaved changes
                            </span>
                        )}
                        <button className="btn btn-secondary" onClick={() => navigate('/commands')}>
                            <ArrowLeft size={14} /> Back
                        </button>
                        {!isNew && (
                            <button className="btn btn-danger" onClick={handleDelete}>
                                <Trash2 size={14} /> Delete
                            </button>
                        )}
                        <button className="btn btn-primary" onClick={() => handleSubmit()} disabled={saving}>
                            {saving ? 'Saving...' : isNew ? 'Create Command' : 'Save Changes'}
                        </button>
                    </div>
                }
            />

            <div className="command-detail__content">
                {/* Editor */}
                <div className="command-detail__editor">
                    {error && (
                        <div className="command-detail__error">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="command-detail__form">
                        {/* Basic */}
                        <div className="bg-card command-detail__card command-detail__card--fields">
                            <div>
                                <label className="command-detail__label">
                                    Name <span className="command-detail__required">*</span>
                                </label>
                                <input className="field-input" value={form.name} onChange={(e) => updateForm('name', e.target.value)} placeholder="my-command" required />
                            </div>
                            <div>
                                <label className="command-detail__label">Description</label>
                                <input className="field-input" value={form.description} onChange={(e) => updateForm('description', e.target.value)} placeholder="What does this command do?" />
                            </div>
                            <div>
                                <label className="command-detail__label">Argument hint</label>
                                <input className="field-input" value={form.argumentHint} onChange={(e) => updateForm('argumentHint', e.target.value)} placeholder="e.g. [filename] or <required>" />
                                <p className="command-detail__hint">Shown as a hint when users type the command</p>
                            </div>
                        </div>

                        {/* Agent */}
                        <div className="bg-card command-detail__card">
                            <label className="command-detail__label command-detail__label--spaced">
                                Link to Agent
                            </label>
                            <select
                                className="field-input"
                                value={form.agent}
                                onChange={(e) => updateForm('agent', e.target.value)}
                            >
                                <option value="">No agent (standalone command)</option>
                                {agents.map((a) => (
                                    <option key={a.slug} value={a.slug}>{a.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Allowed tools */}
                        <div className="bg-card command-detail__card">
                            <h3 className="command-detail__section-title">Allowed Tools</h3>
                            <div className="command-detail__tools-grid">
                                {AVAILABLE_TOOLS.map((tool) => {
                                    const checked = form.allowedTools.includes(tool)
                                    return (
                                        <label
                                            key={tool}
                                            className={`command-detail__tool${checked ? ' command-detail__tool--checked' : ''}`}
                                        >
                                            <input type="checkbox" className="command-detail__tool-checkbox" checked={checked} onChange={() => {
                                                const tools = checked ? form.allowedTools.filter((t) => t !== tool) : [...form.allowedTools, tool]
                                                updateForm('allowedTools', tools)
                                            }} />
                                            {tool}
                                        </label>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Instructions */}
                        <div className="bg-card command-detail__card command-detail__card--instructions">
                            <div className="command-detail__instructions-body">
                                <InstructionEditor value={form.body} onChange={(v) => updateForm('body', v)} title="Prompt" />
                            </div>
                        </div>
                    </form>
                </div>

                {/* CLI terminal */}
                <div className="command-detail__test-panel">
                    <StudioTerminal
                        entityType="command"
                        slug={isNew ? undefined : slug}
                        entityName={form.name || 'Command'}
                    />
                </div>
            </div>
        </div>
    )
}
