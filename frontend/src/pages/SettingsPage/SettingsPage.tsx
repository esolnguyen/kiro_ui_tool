import { useEffect, useRef, useState } from 'react'
import {
    Plus, Trash2, RotateCcw, Search, ChevronDown, Check,
    Cog, Palette, Sparkles, Shield, Link2, Terminal, Zap, Save,
} from 'lucide-react'
import type { Settings, ThemeType, ModelType, HookConfig, PermissionMode } from '../../types'
import { settingsApi } from '../../api/settings'
import { cliSettingsApi, type CliSetting } from '../../api/cliSettings'
import { useAppStore } from '../../stores/appStore'
import PageHeader from '../../components/common/PageHeader'
import { MODEL_IDS, MODEL_META } from '../../utils/models'
import client from '../../api/client'
import './SettingsPage.scss'

type HookEvent = HookConfig['event']

const HOOK_EVENT_OPTIONS: { value: HookEvent; label: string; description: string }[] = [
    { value: 'PreToolUse', label: 'Before Kiro uses a tool', description: 'Triggered just before a tool is executed' },
    { value: 'PostToolUse', label: 'After Kiro uses a tool', description: 'Triggered after a tool execution completes' },
    { value: 'Notification', label: 'When a notification is sent', description: 'Triggered when the system sends a notification' },
    { value: 'Stop', label: 'When Kiro finishes', description: 'Triggered when the session finishes' },
    { value: 'SubagentStop', label: 'When a sub-agent finishes', description: 'Triggered when a background sub-agent finishes' },
]

const HOOK_EVENT_LABELS: Record<HookEvent, string> = {
    PreToolUse: 'Before tool use',
    PostToolUse: 'After tool use',
    Notification: 'On notification',
    Stop: 'On stop',
    SubagentStop: 'On sub-agent stop',
}

const PERMISSION_MODES: { value: PermissionMode; label: string; description: string }[] = [
    { value: 'auto', label: 'Auto', description: 'Kiro decides which tools to use automatically' },
    { value: 'ask', label: 'Ask', description: 'Kiro asks before using tools that modify files' },
    { value: 'deny', label: 'Deny', description: 'No tools allowed, text-only responses' },
]

const CLI_GROUP_LABELS: Record<string, string> = {
    chat: 'Chat & UI',
    knowledge: 'Knowledge Base',
    mcp: 'MCP Servers',
    api: 'API & Services',
    compaction: 'Compaction',
    introspect: 'Introspect',
    telemetry: 'Telemetry',
    telemetryClientId: 'Telemetry',
    codeWhisperer: 'CodeWhisperer',
}

const SECTIONS = [
    { id: 'general', label: 'General', icon: Cog, desc: 'Kiro directory and CLI location' },
    { id: 'appearance', label: 'Appearance', icon: Palette, desc: 'Theme and visual preferences' },
    { id: 'models', label: 'Models', icon: Sparkles, desc: 'Default model for new agents' },
    { id: 'behavior', label: 'Behavior', icon: Shield, desc: 'Permissions, thinking and status line' },
    { id: 'integrations', label: 'Integrations', icon: Link2, desc: 'Azure DevOps and external services' },
    { id: 'cli-settings', label: 'CLI Settings', icon: Terminal, desc: 'Low-level kiro-cli configuration' },
    { id: 'hooks', label: 'Hooks', icon: Zap, desc: 'Run commands on lifecycle events' },
] as const

type SectionId = typeof SECTIONS[number]['id']

interface FullSettings extends Settings {
    permissionMode?: PermissionMode
    alwaysThinkingEnabled?: boolean
    hooks?: HookConfig[]
    statusLine?: { type: string; command: string }
}

function Accordion({ title, count, defaultOpen, children }: { title: string; count?: number; defaultOpen?: boolean; children: React.ReactNode }) {
    const [open, setOpen] = useState(defaultOpen ?? false)
    return (
        <div className={`settings-page__accordion${open ? ' settings-page__accordion--open' : ''}`}>
            <button type="button" className="settings-page__accordion-trigger" onClick={() => setOpen(!open)}>
                <span className="settings-page__accordion-title">
                    {title}
                    {count !== undefined && <span className="settings-page__accordion-count">{count}</span>}
                </span>
                <ChevronDown size={16} className={`settings-page__accordion-chevron${open ? ' settings-page__accordion-chevron--open' : ''}`} />
            </button>
            {open && <div className="settings-page__accordion-body">{children}</div>}
        </div>
    )
}

export default function SettingsPage() {
    const { settings, setSettings } = useAppStore()
    const [form, setForm] = useState<FullSettings>({
        kiroDir: '~/.kiro',
        kiroCLIPath: '',
        theme: 'system',
        defaultModel: 'sonnet',
        azureDevOps: { organization: '', project: '', personalAccessToken: '', apiVersion: '7.1' },
        permissionMode: 'ask',
        alwaysThinkingEnabled: false,
        hooks: [],
    })
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [cliStatus, setCliStatus] = useState<{ path: string; found: boolean } | null>(null)

    const [showAddHook, setShowAddHook] = useState(false)
    const [hookEvent, setHookEvent] = useState<HookEvent>('PreToolUse')
    const [hookCommand, setHookCommand] = useState('')
    const [hookMatcher, setHookMatcher] = useState('')

    const [statusLineType, setStatusLineType] = useState('')
    const [statusLineCommand, setStatusLineCommand] = useState('')

    const [cliSettings, setCliSettings] = useState<CliSetting[]>([])
    const [cliFilter, setCliFilter] = useState('')
    const [cliSaving, setCliSaving] = useState<string | null>(null)

    const [activeSection, setActiveSection] = useState<SectionId>('general')
    const scrollContainerRef = useRef<HTMLElement | null>(null)

    useEffect(() => {
        const base = settings ?? {}
        settingsApi.get().then((s) => {
            const full = { ...base, ...s } as FullSettings
            setForm(full)
            if (full.statusLine) {
                setStatusLineType(full.statusLine.type ?? '')
                setStatusLineCommand(full.statusLine.command ?? '')
            }
        }).catch(console.error)

        client.get<{ kiroCLIPath: string; kiroCLIFound: boolean }>('/config')
            .then((r) => setCliStatus({ path: r.data.kiroCLIPath, found: r.data.kiroCLIFound }))
            .catch(() => setCliStatus({ path: '', found: false }))

        cliSettingsApi.list().then(setCliSettings).catch(console.error)
    }, [settings])

    // Scroll spy — highlight nav item based on which section is in view.
    useEffect(() => {
        // The Layout uses <main> as the scroll container.
        scrollContainerRef.current = document.querySelector('main')
        const els = SECTIONS
            .map((s) => document.getElementById(s.id))
            .filter((el): el is HTMLElement => el !== null)

        const obs = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
                if (visible[0]) setActiveSection(visible[0].target.id as SectionId)
            },
            {
                root: scrollContainerRef.current,
                rootMargin: '-120px 0px -55% 0px',
                threshold: [0, 0.25, 0.5, 1],
            },
        )
        els.forEach((el) => obs.observe(el))
        return () => obs.disconnect()
    }, [])

    function scrollToSection(id: SectionId) {
        setActiveSection(id)
        const el = document.getElementById(id)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true); setError(null); setSaved(false)
        try {
            const updated = await settingsApi.update(form as Settings)
            setSettings(updated)
            setSaved(true)
            setTimeout(() => setSaved(false), 2500)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Save failed')
        } finally { setSaving(false) }
    }

    function updateForm<K extends keyof FullSettings>(key: K, value: FullSettings[K]) {
        setForm((f) => ({ ...f, [key]: value }))
    }

    function addHook() {
        if (!hookCommand.trim()) return
        updateForm('hooks', [...(form.hooks ?? []), { event: hookEvent, command: hookCommand.trim(), enabled: true, matcher: hookMatcher.trim() || undefined }])
        setHookCommand(''); setHookMatcher(''); setShowAddHook(false)
    }

    function removeHook(i: number) { updateForm('hooks', (form.hooks ?? []).filter((_, idx) => idx !== i)) }
    function toggleHook(i: number) { updateForm('hooks', (form.hooks ?? []).map((h, idx) => idx === i ? { ...h, enabled: !h.enabled } : h)) }

    async function saveStatusLine() {
        const patch: Partial<FullSettings> = statusLineType ? { statusLine: { type: statusLineType, command: statusLineCommand } } : { statusLine: undefined }
        try {
            await client.put('/settings', { ...form, ...patch })
            setSaved(true); setTimeout(() => setSaved(false), 2500)
        } catch (e) { setError(e instanceof Error ? e.message : 'Save failed') }
    }

    async function handleCliSettingChange(setting: CliSetting, value: string) {
        setCliSaving(setting.key)
        try {
            const updated = await cliSettingsApi.set(setting.key, value)
            setCliSettings((prev) => prev.map((s) => s.key === setting.key ? updated : s))
        } catch (e) { setError(e instanceof Error ? e.message : 'CLI setting update failed') }
        finally { setCliSaving(null) }
    }

    async function handleCliSettingReset(setting: CliSetting) {
        setCliSaving(setting.key)
        try {
            await cliSettingsApi.delete(setting.key)
            setCliSettings((prev) => prev.map((s) => s.key === setting.key ? { ...s, value: null, scope: null } : s))
        } catch (e) { setError(e instanceof Error ? e.message : 'CLI setting reset failed') }
        finally { setCliSaving(null) }
    }

    const cliSettingsGrouped = (() => {
        const filtered = cliSettings.filter((s) =>
            !cliFilter || s.key.toLowerCase().includes(cliFilter.toLowerCase()) || s.description.toLowerCase().includes(cliFilter.toLowerCase())
        )
        const groups: Record<string, CliSetting[]> = {}
        for (const s of filtered) {
            const cat = s.key.split('.')[0]
            ;(groups[cat] ??= []).push(s)
        }
        return groups
    })()

    const setCount = cliSettings.filter((s) => s.value !== null).length
    const hookCount = (form.hooks ?? []).length

    const sectionCounts: Partial<Record<SectionId, number>> = {
        'cli-settings': setCount || undefined,
        hooks: hookCount || undefined,
    }

    function renderCliControl(s: CliSetting) {
        if (s.type === 'boolean') {
            return (
                <button
                    type="button"
                    className={`settings-page__switch settings-page__switch--sm${s.value === 'true' ? ' settings-page__switch--on' : ''}`}
                    onClick={() => handleCliSettingChange(s, s.value === 'true' ? 'false' : 'true')}
                    disabled={cliSaving === s.key}
                    role="switch"
                    aria-checked={s.value === 'true'}
                >
                    <span className={`settings-page__switch-knob settings-page__switch-knob--sm${s.value === 'true' ? ' settings-page__switch-knob--on' : ''}`} />
                </button>
            )
        }
        return (
            <input
                className="field-input settings-page__cli-input"
                type={s.type === 'number' ? 'number' : 'text'}
                defaultValue={s.value ?? ''}
                key={`${s.key}-${s.value}`}
                placeholder="not set"
                onBlur={(e) => {
                    if (e.target.value !== (s.value ?? '')) {
                        if (e.target.value) handleCliSettingChange(s, e.target.value)
                        else if (s.value !== null) handleCliSettingReset(s)
                    }
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                disabled={cliSaving === s.key}
            />
        )
    }

    return (
        <div className="settings-page">
            <PageHeader title="Settings" description="Configure the Kiro Agent Manager" />

            <form onSubmit={handleSave} className="settings-page__form">
                <div className="settings-page__layout">
                    {/* ── Sticky sidebar nav ── */}
                    <aside className="settings-page__nav" aria-label="Settings sections">
                        {SECTIONS.map((s) => {
                            const Icon = s.icon
                            const count = sectionCounts[s.id]
                            const active = activeSection === s.id
                            return (
                                <button
                                    key={s.id}
                                    type="button"
                                    className={`settings-page__nav-item${active ? ' settings-page__nav-item--active' : ''}`}
                                    onClick={() => scrollToSection(s.id)}
                                >
                                    <Icon size={16} className="settings-page__nav-icon" />
                                    <span className="settings-page__nav-label">{s.label}</span>
                                    {count !== undefined && <span className="settings-page__nav-count">{count}</span>}
                                </button>
                            )
                        })}
                    </aside>

                    {/* ── Main content ── */}
                    <div className="settings-page__main">
                        {error && <div className="settings-page__error">{error}</div>}

                        {/* General */}
                        <section id="general" className="settings-page__section">
                            <SectionHeader icon={Cog} title="General" desc="Where Kiro lives on your system" />
                            <div className="settings-page__card settings-page__card--stack">
                                <div className="settings-page__field">
                                    <label className="settings-page__label">Kiro directory</label>
                                    <input className="field-input" value={form.kiroDir} onChange={(e) => updateForm('kiroDir', e.target.value)} placeholder="~/.kiro" />
                                    <span className="settings-page__help">Where Kiro stores agents, commands, and skills</span>
                                </div>
                                <div className="settings-page__field">
                                    <label className="settings-page__label">CLI path</label>
                                    <input className="field-input" value={form.kiroCLIPath ?? ''} onChange={(e) => updateForm('kiroCLIPath', e.target.value)} placeholder="Auto-detected" />
                                    <span className="settings-page__help">Override the auto-detected kiro binary</span>
                                </div>
                                {cliStatus && (
                                    <div className={`settings-page__status-chip${cliStatus.found ? ' settings-page__status-chip--ok' : ' settings-page__status-chip--error'}`}>
                                        <span className="settings-page__status-dot" />
                                        <span className="settings-page__status-text">
                                            {cliStatus.found ? `Found: ${cliStatus.path}` : 'Kiro CLI not found'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Appearance */}
                        <section id="appearance" className="settings-page__section">
                            <SectionHeader icon={Palette} title="Appearance" desc="Pick a theme for the dashboard" />
                            <div className="settings-page__card">
                                <div className="settings-page__segmented">
                                    {(['light', 'dark', 'system'] as ThemeType[]).map((t) => (
                                        <button
                                            key={t}
                                            type="button"
                                            className={`settings-page__segmented-btn${form.theme === t ? ' settings-page__segmented-btn--active' : ''}`}
                                            onClick={() => updateForm('theme', t)}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </section>

                        {/* Models */}
                        <section id="models" className="settings-page__section">
                            <SectionHeader icon={Sparkles} title="Default Model" desc="Chosen automatically for new agents" />
                            <div className="settings-page__card">
                                <div className="settings-page__model-grid">
                                    {MODEL_IDS.map((m) => {
                                        const meta = MODEL_META[m]
                                        const selected = form.defaultModel === m
                                        return (
                                            <button
                                                key={m}
                                                type="button"
                                                className={`settings-page__model-card${selected ? ' settings-page__model-card--selected' : ''}`}
                                                onClick={() => updateForm('defaultModel', m as ModelType)}
                                                style={selected ? {
                                                    borderColor: meta.color,
                                                    background: `linear-gradient(135deg, ${meta.color}14, ${meta.color}06)`,
                                                } : undefined}
                                            >
                                                <span className="settings-page__model-dot" style={{ background: meta.color }} />
                                                <span className="settings-page__model-body">
                                                    <span className="settings-page__model-label" style={selected ? { color: meta.color } : undefined}>
                                                        {meta.label}
                                                    </span>
                                                    <span className="settings-page__model-tagline">{meta.tagline}</span>
                                                </span>
                                                {selected && <Check size={14} className="settings-page__model-check" style={{ color: meta.color }} />}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </section>

                        {/* Behavior */}
                        <section id="behavior" className="settings-page__section">
                            <SectionHeader icon={Shield} title="Behavior" desc="How Kiro handles tools, thinking and the status line" />
                            <div className="settings-page__card settings-page__card--stack-lg">
                                <div className="settings-page__field">
                                    <label className="settings-page__label">Permission mode</label>
                                    <div className="settings-page__segmented">
                                        {PERMISSION_MODES.map((mode) => (
                                            <button
                                                key={mode.value}
                                                type="button"
                                                className={`settings-page__segmented-btn${form.permissionMode === mode.value ? ' settings-page__segmented-btn--active' : ''}`}
                                                onClick={() => updateForm('permissionMode', mode.value)}
                                                title={mode.description}
                                            >
                                                {mode.label}
                                            </button>
                                        ))}
                                    </div>
                                    <span className="settings-page__help">
                                        {PERMISSION_MODES.find((m) => m.value === form.permissionMode)?.description}
                                    </span>
                                </div>

                                <div className="settings-page__divider" />

                                <div className="settings-page__toggle-row">
                                    <div>
                                        <div className="settings-page__toggle-title">Extended thinking</div>
                                        <div className="settings-page__help">Enable extended thinking mode for all conversations</div>
                                    </div>
                                    <button
                                        type="button"
                                        className={`settings-page__switch${form.alwaysThinkingEnabled ? ' settings-page__switch--on' : ''}`}
                                        onClick={() => updateForm('alwaysThinkingEnabled', !form.alwaysThinkingEnabled)}
                                        role="switch"
                                        aria-checked={form.alwaysThinkingEnabled}
                                    >
                                        <span className={`settings-page__switch-knob${form.alwaysThinkingEnabled ? ' settings-page__switch-knob--on' : ''}`} />
                                    </button>
                                </div>

                                <div className="settings-page__divider" />

                                <div className="settings-page__field">
                                    <label className="settings-page__label">Status line</label>
                                    <div className="settings-page__statusline-row">
                                        <select className="field-input settings-page__statusline-select" value={statusLineType} onChange={(e) => setStatusLineType(e.target.value)}>
                                            <option value="">None (disabled)</option>
                                            <option value="command">Command (bash)</option>
                                        </select>
                                        {statusLineType === 'command' && (
                                            <input
                                                className="field-input"
                                                value={statusLineCommand}
                                                onChange={(e) => setStatusLineCommand(e.target.value)}
                                                placeholder="e.g. git branch --show-current"
                                            />
                                        )}
                                        <button type="button" className="btn btn-secondary settings-page__btn--sm" onClick={saveStatusLine}>
                                            Save
                                        </button>
                                    </div>
                                    <span className="settings-page__help">Runs independently of the main Save Settings button</span>
                                </div>
                            </div>
                        </section>

                        {/* Integrations */}
                        <section id="integrations" className="settings-page__section">
                            <SectionHeader icon={Link2} title="Azure DevOps" desc="Connect work items and pipelines" />
                            <div className="settings-page__card settings-page__card--stack">
                                <div className="settings-page__grid-2">
                                    <div className="settings-page__field">
                                        <label className="settings-page__label">Organization</label>
                                        <input className="field-input" value={form.azureDevOps?.organization ?? ''}
                                            onChange={(e) => updateForm('azureDevOps', { ...(form.azureDevOps ?? { organization: '', project: '', personalAccessToken: '', apiVersion: '7.1' }), organization: e.target.value })}
                                            placeholder="e.g. mycompany" />
                                    </div>
                                    <div className="settings-page__field">
                                        <label className="settings-page__label">Project</label>
                                        <input className="field-input" value={form.azureDevOps?.project ?? ''}
                                            onChange={(e) => updateForm('azureDevOps', { ...(form.azureDevOps ?? { organization: '', project: '', personalAccessToken: '', apiVersion: '7.1' }), project: e.target.value })}
                                            placeholder="e.g. MyProject" />
                                    </div>
                                </div>
                                <div className="settings-page__field">
                                    <label className="settings-page__label">Personal access token</label>
                                    <input className="field-input" type="password" value={form.azureDevOps?.personalAccessToken ?? ''}
                                        onChange={(e) => updateForm('azureDevOps', { ...(form.azureDevOps ?? { organization: '', project: '', personalAccessToken: '', apiVersion: '7.1' }), personalAccessToken: e.target.value })}
                                        placeholder="Paste your PAT here" />
                                    <span className="settings-page__help">Needs Work Items: Read &amp; Write scope</span>
                                </div>
                                <div className="settings-page__field settings-page__field--narrow">
                                    <label className="settings-page__label">API version</label>
                                    <input className="field-input" value={form.azureDevOps?.apiVersion ?? '7.1'}
                                        onChange={(e) => updateForm('azureDevOps', { ...(form.azureDevOps ?? { organization: '', project: '', personalAccessToken: '', apiVersion: '7.1' }), apiVersion: e.target.value })}
                                        placeholder="7.1" />
                                </div>
                            </div>
                        </section>

                        {/* CLI Settings */}
                        <section id="cli-settings" className="settings-page__section">
                            <SectionHeader
                                icon={Terminal}
                                title="CLI Settings"
                                desc="Managed via kiro-cli settings. Changes apply immediately."
                                badge={setCount > 0 ? `${setCount} configured` : undefined}
                            />
                            <div className="settings-page__card settings-page__card--stack">
                                <div className="settings-page__cli-search">
                                    <Search size={14} />
                                    <input className="field-input" value={cliFilter} onChange={(e) => setCliFilter(e.target.value)} placeholder="Filter settings..." />
                                </div>
                                {Object.entries(cliSettingsGrouped).map(([group, items]) => {
                                    const activeCount = items.filter((s) => s.value !== null).length
                                    return (
                                        <Accordion
                                            key={group}
                                            title={CLI_GROUP_LABELS[group] ?? group}
                                            count={activeCount > 0 ? activeCount : undefined}
                                            defaultOpen={!!cliFilter || activeCount > 0}
                                        >
                                            <div className="settings-page__cli-list">
                                                {items.map((s) => (
                                                    <div key={s.key} className={`settings-page__cli-item${s.value !== null ? ' settings-page__cli-item--active' : ''}`}>
                                                        <div className="settings-page__cli-item-left">
                                                            <div className="settings-page__cli-item-key">
                                                                <code>{s.key}</code>
                                                                {s.scope && <span className="settings-page__cli-scope">{s.scope}</span>}
                                                            </div>
                                                            <div className="settings-page__cli-item-desc">{s.description}</div>
                                                        </div>
                                                        <div className="settings-page__cli-item-right">
                                                            {renderCliControl(s)}
                                                            {s.value !== null && (
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-ghost settings-page__btn--sm settings-page__cli-reset"
                                                                    onClick={() => handleCliSettingReset(s)}
                                                                    disabled={cliSaving === s.key}
                                                                    title="Reset to default"
                                                                >
                                                                    <RotateCcw size={11} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </Accordion>
                                    )
                                })}
                            </div>
                        </section>

                        {/* Hooks */}
                        <section id="hooks" className="settings-page__section">
                            <SectionHeader
                                icon={Zap}
                                title="Hooks"
                                desc="Run shell commands automatically when Kiro performs certain actions."
                                badge={hookCount > 0 ? `${hookCount} active` : undefined}
                            />
                            <div className="settings-page__card settings-page__card--stack">
                                {hookCount > 0 ? (
                                    <div className="settings-page__hook-list">
                                        {(form.hooks ?? []).map((hook, i) => (
                                            <div key={i} className={`settings-page__hook-item${hook.enabled ? '' : ' settings-page__hook-item--disabled'}`}>
                                                <button
                                                    type="button"
                                                    className={`settings-page__switch settings-page__switch--sm${hook.enabled ? ' settings-page__switch--on' : ''}`}
                                                    onClick={() => toggleHook(i)}
                                                    role="switch"
                                                    aria-checked={hook.enabled}
                                                >
                                                    <span className={`settings-page__switch-knob settings-page__switch-knob--sm${hook.enabled ? ' settings-page__switch-knob--on' : ''}`} />
                                                </button>
                                                <div className="settings-page__hook-info">
                                                    <div className="settings-page__hook-header">
                                                        <span className="settings-page__hook-badge">{HOOK_EVENT_LABELS[hook.event]}</span>
                                                        {hook.matcher && <span className="settings-page__hook-matcher">matcher: {hook.matcher}</span>}
                                                    </div>
                                                    <code className="settings-page__hook-command">{hook.command}</code>
                                                </div>
                                                <button type="button" className="btn btn-ghost settings-page__hook-delete" onClick={() => removeHook(i)} aria-label="Remove hook">
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    !showAddHook && (
                                        <div className="settings-page__empty">
                                            <Zap size={20} />
                                            <div className="settings-page__empty-title">No hooks yet</div>
                                            <div className="settings-page__empty-desc">Add a shell command to react to Kiro events</div>
                                        </div>
                                    )
                                )}

                                {showAddHook ? (
                                    <div className="settings-page__hook-form">
                                        <div className="settings-page__field">
                                            <label className="settings-page__label">Event</label>
                                            <select className="field-input" value={hookEvent} onChange={(e) => setHookEvent(e.target.value as HookEvent)}>
                                                {HOOK_EVENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                            </select>
                                        </div>
                                        <div className="settings-page__field">
                                            <label className="settings-page__label">Shell command</label>
                                            <input className="field-input" value={hookCommand} onChange={(e) => setHookCommand(e.target.value)} placeholder="e.g. echo 'tool used' >> ~/kiro-log.txt" />
                                        </div>
                                        <div className="settings-page__field">
                                            <label className="settings-page__label">Tool matcher (optional)</label>
                                            <input className="field-input" value={hookMatcher} onChange={(e) => setHookMatcher(e.target.value)} placeholder="e.g. Bash" />
                                        </div>
                                        <div className="settings-page__hook-form-actions">
                                            <button type="button" className="btn btn-primary settings-page__btn--sm" onClick={addHook}>Add hook</button>
                                            <button type="button" className="btn btn-secondary settings-page__btn--sm" onClick={() => setShowAddHook(false)}>Cancel</button>
                                        </div>
                                    </div>
                                ) : (
                                    <button type="button" className="btn btn-secondary settings-page__add-hook-btn" onClick={() => setShowAddHook(true)}>
                                        <Plus size={14} /> Add hook
                                    </button>
                                )}
                            </div>
                        </section>

                        <div className="settings-page__about">
                            <div className="settings-page__about-title">Kiro Agent Manager</div>
                            <div className="settings-page__about-text">
                                A visual dashboard for managing Kiro AI agents, commands, skills, and workflows.
                                Files are stored in the <code>~/.kiro</code> directory.
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sticky save bar */}
                <div className="settings-page__save-bar">
                    <div className="settings-page__save-bar-inner">
                        <span className={`settings-page__save-status${saved ? ' settings-page__save-status--visible' : ''}`}>
                            <Check size={14} /> Settings saved
                        </span>
                        <button type="submit" className="btn btn-primary settings-page__save-btn" disabled={saving}>
                            <Save size={14} />
                            {saving ? 'Saving...' : 'Save settings'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    )
}

function SectionHeader({
    icon: Icon,
    title,
    desc,
    badge,
}: {
    icon: React.ComponentType<{ size?: number | string; className?: string }>
    title: string
    desc?: string
    badge?: string
}) {
    return (
        <div className="settings-page__section-header">
            <span className="settings-page__section-icon">
                <Icon size={16} />
            </span>
            <div className="settings-page__section-heading">
                <h2 className="settings-page__section-title">
                    {title}
                    {badge && <span className="settings-page__badge">{badge}</span>}
                </h2>
                {desc && <p className="settings-page__section-desc">{desc}</p>}
            </div>
        </div>
    )
}
