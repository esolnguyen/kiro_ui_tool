import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Trash2 } from 'lucide-react'
import type { Skill, SkillContext } from '../../types'
import { skillsApi } from '../../api/skills'
import { useAppStore } from '../../stores/appStore'
import PageHeader from '../../components/common/PageHeader'
import InstructionEditor from '../../components/studio/InstructionEditor'
import StudioTerminal from '../../components/studio/StudioTerminal'
import { useDraftRecovery } from '../../hooks/useDraftRecovery'
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges'
import './SkillDetailPage.scss'

export default function SkillDetailPage() {
    const { slug } = useParams<{ slug: string }>()
    const navigate = useNavigate()
    const { fetchSkills, agents } = useAppStore()
    const isNew = !slug || slug === 'new'

    const [skill, setSkill] = useState<Skill | null>(null)
    const [loading, setLoading] = useState(!isNew)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isDirty, setIsDirty] = useState(false)

    const [form, setForm] = useState({
        name: '',
        description: '',
        context: 'when' as SkillContext,
        agent: '',
        body: '',
    })

    useUnsavedChanges(isDirty)
    const { clearDraft } = useDraftRecovery('skill', slug, form as Record<string, unknown>, isDirty, (data) => {
        setForm(data as typeof form)
        setIsDirty(false)
    })

    useEffect(() => {
        if (isNew) return
        skillsApi
            .get(slug)
            .then((s) => {
                setSkill(s)
                setForm({
                    name: s.name,
                    description: s.description,
                    context: s.context ?? 'when',
                    agent: s.agent ?? '',
                    body: s.body,
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
            const data: Omit<Skill, 'slug'> = {
                name: form.name,
                description: form.description,
                context: form.context,
                agent: form.agent || undefined,
                body: form.body,
            }
            if (isNew) {
                const created = await skillsApi.create(data)
                clearDraft()
                await fetchSkills()
                navigate(`/skills/${created.slug}`, { replace: true })
            } else {
                await skillsApi.update(slug!, data)
                clearDraft()
                setIsDirty(false)
                await fetchSkills()
                navigate('/skills')
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Save failed')
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete() {
        if (!slug || !confirm(`Delete skill "${slug}"?`)) return
        try {
            await skillsApi.delete(slug)
            await fetchSkills()
            navigate('/skills')
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Delete failed')
        }
    }

    if (loading) {
        return <div className="skill-detail__loading">Loading skill...</div>
    }

    const linkedAgent = agents.find((a) => a.slug === form.agent)

    return (
        <div className="skill-detail">
            <PageHeader
                title={isNew ? 'New Skill' : (skill?.name ?? slug ?? '')}
                description={isNew ? 'Create a new skill' : 'Edit skill'}
                action={
                    <div className="skill-detail__actions">
                        {isDirty && (
                            <span className="skill-detail__unsaved-badge">
                                Unsaved changes
                            </span>
                        )}
                        <button className="btn btn-secondary" onClick={() => navigate('/skills')}>
                            <ArrowLeft size={14} /> Back
                        </button>
                        {!isNew && (
                            <button className="btn btn-danger" onClick={handleDelete}>
                                <Trash2 size={14} /> Delete
                            </button>
                        )}
                        <button className="btn btn-primary" onClick={() => handleSubmit()} disabled={saving}>
                            {saving ? 'Saving...' : isNew ? 'Create Skill' : 'Save Changes'}
                        </button>
                    </div>
                }
            />

            <div className="skill-detail__content">
                {/* Editor */}
                <div className="skill-detail__editor">
                    {error && (
                        <div className="skill-detail__error">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="skill-detail__form">
                        {/* Basic */}
                        <div className="bg-card skill-detail__card">
                            <div>
                                <label className="skill-detail__label">
                                    Name <span className="skill-detail__required">*</span>
                                </label>
                                <input className="field-input" value={form.name} onChange={(e) => updateForm('name', e.target.value)} placeholder="my-skill" required />
                            </div>
                            <div>
                                <label className="skill-detail__label">Description</label>
                                <input className="field-input" value={form.description} onChange={(e) => updateForm('description', e.target.value)} placeholder="What does this skill teach?" />
                            </div>
                        </div>

                        {/* Context */}
                        <div className="bg-card skill-detail__card--context">
                            <h3 className="skill-detail__context-heading">Context</h3>
                            <div className="skill-detail__context-buttons">
                                {(['when', 'always'] as SkillContext[]).map((c) => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => updateForm('context', c)}
                                        className={`skill-detail__context-btn${form.context === c ? ' skill-detail__context-btn--active' : ''}`}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>
                            <p className="skill-detail__context-help">
                                <strong>When</strong>: Active when relevant to the task. <strong>Always</strong>: Active in every conversation.
                            </p>
                        </div>

                        {/* Agent */}
                        <div className="bg-card skill-detail__card--agent">
                            <label className="skill-detail__label skill-detail__label--agent">
                                Link to Agent
                            </label>
                            <select className="field-input" value={form.agent} onChange={(e) => updateForm('agent', e.target.value)}>
                                <option value="">No agent (available to all)</option>
                                {agents.map((a) => (
                                    <option key={a.slug} value={a.slug}>{a.name}</option>
                                ))}
                            </select>
                            {linkedAgent && (
                                <div className="skill-detail__linked-agent">
                                    <div
                                        className="skill-detail__linked-agent-dot"
                                        style={{ background: linkedAgent.color ?? undefined }}
                                    />
                                    <span className="skill-detail__linked-agent-text">Linked to agent: <strong>{linkedAgent.name}</strong></span>
                                </div>
                            )}
                        </div>

                        {/* Instructions */}
                        <div className="bg-card skill-detail__card--instructions">
                            <div className="skill-detail__instructions-body">
                                <InstructionEditor value={form.body} onChange={(v) => updateForm('body', v)} title="Instructions" />
                            </div>
                        </div>
                    </form>
                </div>

                {/* CLI terminal */}
                <div className="skill-detail__test-panel">
                    <StudioTerminal
                        entityType="skill"
                        slug={isNew ? undefined : slug}
                        entityName={form.name || 'Skill'}
                    />
                </div>
            </div>
        </div>
    )
}
