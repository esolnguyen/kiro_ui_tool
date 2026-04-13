import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Terminal, Trash2, Lock, Search, Wand2 } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import PageHeader from '../../components/common/PageHeader'
import EmptyState from '../../components/common/EmptyState'
import { commandsApi } from '../../api/commands'
import { BUILTIN_COMMANDS, BUILTIN_COMMAND_GROUPS, type BuiltinCommandGroup } from '../../data/builtinCommands'
import GenerateWithKiroModal from '../../components/modals/GenerateWithKiroModal'
import './CommandsPage.scss'

export default function CommandsPage() {
    const { commands, fetchCommands } = useAppStore()
    const [deleting, setDeleting] = useState<string | null>(null)
    const [filter, setFilter] = useState('')
    const [generateModalOpen, setGenerateModalOpen] = useState(false)

    async function handleDelete(slug: string) {
        if (!confirm(`Delete command "${slug}"?`)) return
        setDeleting(slug)
        try {
            await commandsApi.delete(slug)
            await fetchCommands()
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Delete failed')
        } finally {
            setDeleting(null)
        }
    }

    const filteredBuiltins = useMemo(() => {
        const q = filter.trim().toLowerCase()
        if (!q) return BUILTIN_COMMANDS
        return BUILTIN_COMMANDS.filter(
            (c) => c.slug.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
        )
    }, [filter])

    const groupedBuiltins = useMemo(() => {
        const groups = new Map<BuiltinCommandGroup, typeof BUILTIN_COMMANDS>()
        for (const group of BUILTIN_COMMAND_GROUPS) {
            const items = filteredBuiltins.filter((c) => c.group === group)
            if (items.length) groups.set(group, items)
        }
        return groups
    }, [filteredBuiltins])

    const filteredCustom = useMemo(() => {
        const q = filter.trim().toLowerCase()
        if (!q) return commands
        return commands.filter(
            (c) =>
                c.name.toLowerCase().includes(q) ||
                c.slug.toLowerCase().includes(q) ||
                (c.description ?? '').toLowerCase().includes(q),
        )
    }, [commands, filter])

    return (
        <div>
            <GenerateWithKiroModal
                isOpen={generateModalOpen}
                entityType="command"
                onClose={() => setGenerateModalOpen(false)}
                onComplete={fetchCommands}
            />
            <PageHeader
                title="Commands"
                description="Slash commands for quick actions in Kiro"
                action={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                            onClick={() => setGenerateModalOpen(true)}
                            className="btn btn-secondary"
                        >
                            <Wand2 size={14} />
                            Generate with Kiro
                        </button>
                        <Link to="/commands/new" className="btn btn-primary">
                            <Plus size={14} />
                            New Command
                        </Link>
                    </div>
                }
            />

            <div className="commands-page__content">
                <div className="commands-page__search">
                    <Search size={14} />
                    <input
                        className="field-input"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        placeholder="Filter commands..."
                    />
                </div>

                {/* ── Custom commands ── */}
                <section className="commands-page__section">
                    <div className="commands-page__section-header">
                        <h2 className="commands-page__section-title">
                            Your Commands
                            <span className="commands-page__count">{filteredCustom.length}</span>
                        </h2>
                        <p className="commands-page__section-desc">
                            Custom slash commands you've created.
                        </p>
                    </div>

                    {commands.length === 0 ? (
                        <EmptyState
                            icon={<Terminal size={24} />}
                            title="No commands yet"
                            description="Create slash commands to speed up your Kiro workflow."
                            action={
                                <Link to="/commands/new" className="btn btn-primary">
                                    <Plus size={14} />
                                    Create Command
                                </Link>
                            }
                        />
                    ) : filteredCustom.length === 0 ? (
                        <div className="commands-page__no-match">No custom commands match "{filter}"</div>
                    ) : (
                        <div className="commands-page__list">
                            {filteredCustom.map((cmd) => (
                                <div
                                    key={cmd.slug}
                                    className="hover-bg commands-page__item"
                                >
                                    <span className="commands-page__slash">/</span>
                                    <div className="commands-page__info">
                                        <div className="commands-page__name">{cmd.name}</div>
                                        {cmd.description && (
                                            <div className="commands-page__description">
                                                {cmd.description}
                                            </div>
                                        )}
                                    </div>
                                    {cmd.agent && (
                                        <span className="commands-page__agent-badge">
                                            {cmd.agent}
                                        </span>
                                    )}
                                    <div className="commands-page__actions">
                                        <Link
                                            to={`/commands/${cmd.slug}`}
                                            className="btn btn-secondary commands-page__edit-btn"
                                        >
                                            Edit
                                        </Link>
                                        <button
                                            className="btn btn-ghost commands-page__delete-btn"
                                            onClick={() => handleDelete(cmd.slug)}
                                            disabled={deleting === cmd.slug}
                                            aria-label={`Delete ${cmd.name}`}
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* ── Built-in commands ── */}
                <section className="commands-page__section">
                    <div className="commands-page__section-header">
                        <h2 className="commands-page__section-title">
                            Built-in
                            <span className="commands-page__count">{filteredBuiltins.length}</span>
                        </h2>
                        <p className="commands-page__section-desc">
                            Shipped with the Kiro CLI. Available in any session.
                        </p>
                    </div>

                    {filteredBuiltins.length === 0 ? (
                        <div className="commands-page__no-match">No built-in commands match "{filter}"</div>
                    ) : (
                        <div className="commands-page__builtin-groups">
                            {Array.from(groupedBuiltins.entries()).map(([group, items]) => (
                                <div key={group} className="commands-page__builtin-group">
                                    <div className="commands-page__group-label">{group}</div>
                                    <div className="commands-page__builtin-grid">
                                        {items.map((cmd) => (
                                            <div key={cmd.slug} className="commands-page__builtin-card">
                                                <div className="commands-page__builtin-header">
                                                    <code className="commands-page__builtin-slug">
                                                        <span className="commands-page__slash">/</span>
                                                        {cmd.slug}
                                                    </code>
                                                    <Lock size={11} className="commands-page__lock" aria-label="Read-only" />
                                                </div>
                                                <div className="commands-page__builtin-desc">{cmd.description}</div>
                                                {cmd.shortcut && (
                                                    <div className="commands-page__builtin-shortcut">
                                                        <kbd>{cmd.shortcut}</kbd>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    )
}
