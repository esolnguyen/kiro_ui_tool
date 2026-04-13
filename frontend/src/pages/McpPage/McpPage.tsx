import { useEffect, useState } from 'react'
import { Plus, Server, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import type { McpServer } from '../../types'
import { mcpApi } from '../../api/mcp'
import PageHeader from '../../components/common/PageHeader'
import EmptyState from '../../components/common/EmptyState'
import AddMcpModal from '../../components/modals/AddMcpModal'
import './McpPage.scss'

export default function McpPage() {
    const [servers, setServers] = useState<McpServer[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        mcpApi
            .list()
            .then(setServers)
            .catch((e: Error) => setError(e.message))
            .finally(() => setLoading(false))
    }, [])

    async function handleDelete(name: string) {
        if (!confirm(`Delete MCP server "${name}"?`)) return
        try {
            await mcpApi.delete(name)
            setServers((prev) => prev.filter((s) => s.name !== name))
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Delete failed')
        }
    }

    async function handleToggle(server: McpServer) {
        try {
            const updated = await mcpApi.update(server.name, {
                ...server,
                enabled: !server.enabled,
            })
            setServers((prev) => prev.map((s) => (s.name === updated.name ? updated : s)))
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Update failed')
        }
    }

    return (
        <div>
            <PageHeader
                title="MCP Servers"
                description="Model Context Protocol server configurations"
                action={
                    <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                        <Plus size={14} />
                        Add Server
                    </button>
                }
            />

            <AddMcpModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                onAdded={(added) => {
                    setServers((prev) => {
                        const names = new Set(added.map((s) => s.name))
                        return [...prev.filter((s) => !names.has(s.name)), ...added]
                    })
                    setShowModal(false)
                }}
            />

            <div className="mcp-page__content">
                {error && (
                    <div className="mcp-page__error">
                        {error}
                    </div>
                )}

                {/* Server list */}
                {loading ? (
                    <div className="mcp-page__loading">Loading...</div>
                ) : servers.length === 0 ? (
                    <EmptyState
                        icon={<Server size={22} />}
                        title="No MCP servers"
                        description="Add Model Context Protocol servers to extend Kiro's capabilities."
                        action={
                            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                                <Plus size={14} />
                                Add Server
                            </button>
                        }
                    />
                ) : (
                    <div className="mcp-page__server-list">
                        {servers.map((server) => (
                            <div
                                key={server.name}
                                className={`mcp-page__server-item${server.enabled ? '' : ' mcp-page__server-item--disabled'}`}
                            >
                                <div className="mcp-page__server-icon">
                                    <Server size={15} />
                                </div>
                                <div className="mcp-page__server-info">
                                    <div className="mcp-page__server-name">
                                        {server.name}
                                    </div>
                                    <div className="mcp-page__server-command">
                                        {server.command} {server.args.join(' ')}
                                    </div>
                                </div>
                                <div className="mcp-page__server-actions">
                                    <button
                                        className={`btn btn-ghost mcp-page__toggle-btn${server.enabled ? ' mcp-page__toggle-btn--enabled' : ' mcp-page__toggle-btn--disabled'}`}
                                        onClick={() => handleToggle(server)}
                                        aria-label={server.enabled ? 'Disable' : 'Enable'}
                                    >
                                        {server.enabled ? (
                                            <ToggleRight size={18} />
                                        ) : (
                                            <ToggleLeft size={18} />
                                        )}
                                    </button>
                                    <button
                                        className="btn btn-ghost mcp-page__delete-btn"
                                        onClick={() => handleDelete(server.name)}
                                        aria-label={`Delete ${server.name}`}
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
