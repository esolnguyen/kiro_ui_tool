import { useEffect, useState } from 'react'
import { Server, ChevronDown, RefreshCw, AlertCircle, Plus, X, Check } from 'lucide-react'
import type { AgentMcpServerConfig, McpServer, McpTool } from '../../types'
import { mcpApi } from '../../api/mcp'
import './McpServerPicker.scss'

interface Props {
    servers: Record<string, AgentMcpServerConfig>
    allowedTools: string[]
    onChange: (next: {
        servers: Record<string, AgentMcpServerConfig>
        allowedTools: string[]
    }) => void
}

interface ServerToolsState {
    loading: boolean
    tools: McpTool[]
    error: string | null
    fetched: boolean
}

export default function McpServerPicker({ servers, allowedTools, onChange }: Props) {
    const [available, setAvailable] = useState<McpServer[]>([])
    const [loading, setLoading] = useState(true)
    const [listError, setListError] = useState<string | null>(null)
    const [expanded, setExpanded] = useState<Set<string>>(new Set())
    const [toolsByServer, setToolsByServer] = useState<Record<string, ServerToolsState>>({})
    const [manualTool, setManualTool] = useState('')

    useEffect(() => {
        mcpApi
            .list()
            .then(setAvailable)
            .catch((e: Error) => setListError(e.message))
            .finally(() => setLoading(false))
    }, [])

    function toggleExpanded(name: string) {
        const next = new Set(expanded)
        if (next.has(name)) next.delete(name)
        else next.add(name)
        setExpanded(next)
    }

    function toggleServer(server: McpServer) {
        const isEnabled = !!servers[server.name]
        if (isEnabled) {
            // remove
            const { [server.name]: _removed, ...rest } = servers
            // Also strip any allowed tools scoped to this server
            const prefix = `@${server.name}/`
            const nextAllowed = allowedTools.filter((t) => !t.startsWith(prefix))
            onChange({ servers: rest, allowedTools: nextAllowed })
        } else {
            onChange({
                servers: {
                    ...servers,
                    [server.name]: {
                        command: server.command,
                        args: server.args ?? [],
                        env: server.env ?? {},
                        autoApprove: [],
                        disabledTools: [],
                    },
                },
                allowedTools,
            })
            // auto-expand the freshly added server
            setExpanded((prev) => new Set(prev).add(server.name))
            // auto-fetch tools if not already loaded
            if (!toolsByServer[server.name]?.fetched) {
                void fetchTools(server.name)
            }
        }
    }

    async function fetchTools(name: string) {
        setToolsByServer((prev) => ({
            ...prev,
            [name]: { loading: true, tools: prev[name]?.tools ?? [], error: null, fetched: prev[name]?.fetched ?? false },
        }))
        try {
            const res = await mcpApi.listTools(name)
            setToolsByServer((prev) => ({
                ...prev,
                [name]: {
                    loading: false,
                    tools: res.tools,
                    error: res.error,
                    fetched: true,
                },
            }))
        } catch (e) {
            setToolsByServer((prev) => ({
                ...prev,
                [name]: {
                    loading: false,
                    tools: [],
                    error: e instanceof Error ? e.message : 'Discovery failed',
                    fetched: true,
                },
            }))
        }
    }

    function isToolAllowed(serverName: string, toolName: string): boolean {
        return allowedTools.includes(`@${serverName}/${toolName}`)
    }

    function toggleTool(serverName: string, toolName: string) {
        const token = `@${serverName}/${toolName}`
        const wasAllowed = allowedTools.includes(token)
        const nextAllowed = wasAllowed
            ? allowedTools.filter((t) => t !== token)
            : [...allowedTools, token]
        // If allowing, ensure it's not in disabledTools
        let nextServers = servers
        if (!wasAllowed) {
            const cfg = servers[serverName]
            if (cfg?.disabledTools?.includes(toolName)) {
                nextServers = {
                    ...servers,
                    [serverName]: {
                        ...cfg,
                        disabledTools: cfg.disabledTools.filter((t) => t !== toolName),
                    },
                }
            }
        }
        onChange({ servers: nextServers, allowedTools: nextAllowed })
    }

    function addManualTool() {
        const t = manualTool.trim()
        if (!t || allowedTools.includes(t)) {
            setManualTool('')
            return
        }
        onChange({ servers, allowedTools: [...allowedTools, t] })
        setManualTool('')
    }

    function removeAllowedTool(t: string) {
        onChange({ servers, allowedTools: allowedTools.filter((x) => x !== t) })
    }

    function toggleAutoApprove(serverName: string, toolName: string) {
        const cfg = servers[serverName]
        if (!cfg) return
        const current = cfg.autoApprove ?? []
        const next = current.includes(toolName)
            ? current.filter((t) => t !== toolName)
            : [...current, toolName]
        onChange({
            servers: { ...servers, [serverName]: { ...cfg, autoApprove: next } },
            allowedTools,
        })
    }

    function toggleDisabled(serverName: string, toolName: string) {
        const cfg = servers[serverName]
        if (!cfg) return
        const current = cfg.disabledTools ?? []
        const willDisable = !current.includes(toolName)
        const next = willDisable
            ? [...current, toolName]
            : current.filter((t) => t !== toolName)
        // If disabling, also remove from allowedTools to avoid contradiction
        const token = `@${serverName}/${toolName}`
        const nextAllowed = willDisable
            ? allowedTools.filter((t) => t !== token)
            : allowedTools
        onChange({
            servers: { ...servers, [serverName]: { ...cfg, disabledTools: next } },
            allowedTools: nextAllowed,
        })
    }

    const enabledCount = Object.keys(servers).length

    return (
        <div className="mcp-picker">
            <div className="mcp-picker__header">
                <div>
                    <h3 className="mcp-picker__title">MCP Servers</h3>
                    <p className="mcp-picker__desc">
                        Enable MCP servers for this agent and pick which tools it may use.
                    </p>
                </div>
                {enabledCount > 0 && (
                    <span className="mcp-picker__count">{enabledCount} enabled</span>
                )}
            </div>

            {listError && (
                <div className="mcp-picker__error">
                    <AlertCircle size={13} /> {listError}
                </div>
            )}

            {loading ? (
                <div className="mcp-picker__loading">Loading servers...</div>
            ) : available.length === 0 ? (
                <div className="mcp-picker__empty">
                    <Server size={18} />
                    <div>No MCP servers configured.</div>
                    <a href="/mcp" className="mcp-picker__empty-link">Add one in MCP Servers →</a>
                </div>
            ) : (
                <div className="mcp-picker__server-list">
                    {available.map((server) => {
                        const enabled = !!servers[server.name]
                        const isExpanded = expanded.has(server.name)
                        const state = toolsByServer[server.name]
                        const cfg = servers[server.name]
                        return (
                            <div
                                key={server.name}
                                className={`mcp-picker__server${enabled ? ' mcp-picker__server--enabled' : ''}`}
                            >
                                <div className="mcp-picker__server-row">
                                    <button
                                        type="button"
                                        className={`mcp-picker__check${enabled ? ' mcp-picker__check--on' : ''}`}
                                        onClick={() => toggleServer(server)}
                                        aria-pressed={enabled}
                                        aria-label={enabled ? `Disable ${server.name}` : `Enable ${server.name}`}
                                    >
                                        {enabled && <Check size={12} />}
                                    </button>
                                    <div className="mcp-picker__server-body" onClick={() => toggleExpanded(server.name)}>
                                        <div className="mcp-picker__server-name">
                                            <Server size={13} />
                                            {server.name}
                                        </div>
                                        <div className="mcp-picker__server-cmd">
                                            {server.command} {server.args.join(' ')}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="mcp-picker__expand-btn"
                                        onClick={() => toggleExpanded(server.name)}
                                        aria-label={isExpanded ? 'Collapse' : 'Expand'}
                                    >
                                        <ChevronDown
                                            size={14}
                                            className={`mcp-picker__chevron${isExpanded ? ' mcp-picker__chevron--open' : ''}`}
                                        />
                                    </button>
                                </div>

                                {isExpanded && (
                                    <div className="mcp-picker__server-expanded">
                                        <div className="mcp-picker__tools-header">
                                            <span className="mcp-picker__tools-label">
                                                Available tools
                                                {state?.fetched && !state.loading && (
                                                    <span className="mcp-picker__tools-meta">
                                                        {state.tools.length} found
                                                    </span>
                                                )}
                                            </span>
                                            <button
                                                type="button"
                                                className="mcp-picker__refresh-btn"
                                                onClick={() => fetchTools(server.name)}
                                                disabled={state?.loading}
                                            >
                                                <RefreshCw
                                                    size={11}
                                                    className={state?.loading ? 'mcp-picker__spin' : ''}
                                                />
                                                {state?.fetched ? 'Refresh' : 'Discover'}
                                            </button>
                                        </div>

                                        {state?.error && (
                                            <div className="mcp-picker__tools-error">
                                                <AlertCircle size={11} /> {state.error}
                                            </div>
                                        )}

                                        {state?.loading && !state.fetched && (
                                            <div className="mcp-picker__tools-loading">
                                                Starting server and querying tools... (may take up to a minute on first run)
                                            </div>
                                        )}

                                        {state?.fetched && state.tools.length === 0 && !state.loading && (
                                            <div className="mcp-picker__tools-empty">
                                                No tools returned. You can still add tool names manually below.
                                            </div>
                                        )}

                                        {state?.tools && state.tools.length > 0 && (
                                            <div className="mcp-picker__tools-list">
                                                {state.tools.map((tool) => {
                                                    const allowed = isToolAllowed(server.name, tool.name)
                                                    const auto = cfg?.autoApprove?.includes(tool.name) ?? false
                                                    const disabled = cfg?.disabledTools?.includes(tool.name) ?? false
                                                    return (
                                                        <div
                                                            key={tool.name}
                                                            className={`mcp-picker__tool${allowed ? ' mcp-picker__tool--allowed' : ''}${disabled ? ' mcp-picker__tool--disabled' : ''}`}
                                                        >
                                                            <label className="mcp-picker__tool-main">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={allowed}
                                                                    onChange={() => toggleTool(server.name, tool.name)}
                                                                    disabled={!enabled}
                                                                />
                                                                <div className="mcp-picker__tool-info">
                                                                    <code className="mcp-picker__tool-name">{tool.name}</code>
                                                                    {tool.description && (
                                                                        <div className="mcp-picker__tool-desc">
                                                                            {tool.description}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </label>
                                                            {enabled && (
                                                                <div className="mcp-picker__tool-flags">
                                                                    <button
                                                                        type="button"
                                                                        className={`mcp-picker__flag${auto ? ' mcp-picker__flag--on' : ''}`}
                                                                        onClick={() => toggleAutoApprove(server.name, tool.name)}
                                                                        title="Auto-approve this tool without prompting"
                                                                    >
                                                                        auto
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className={`mcp-picker__flag${disabled ? ' mcp-picker__flag--off' : ''}`}
                                                                        onClick={() => toggleDisabled(server.name, tool.name)}
                                                                        title="Disable this tool entirely"
                                                                    >
                                                                        off
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* ── Allowed tools summary ── */}
            <div className="mcp-picker__allowed">
                <div className="mcp-picker__allowed-header">
                    <h4 className="mcp-picker__allowed-title">Allowed tools</h4>
                    <span className="mcp-picker__allowed-hint">Leave empty to allow everything the agent has access to</span>
                </div>
                <div className="mcp-picker__chip-list">
                    {allowedTools.length === 0 && (
                        <span className="mcp-picker__chip-empty">No tools pinned</span>
                    )}
                    {allowedTools.map((t) => (
                        <span key={t} className="mcp-picker__chip">
                            <code>{t}</code>
                            <button
                                type="button"
                                onClick={() => removeAllowedTool(t)}
                                aria-label={`Remove ${t}`}
                            >
                                <X size={10} />
                            </button>
                        </span>
                    ))}
                </div>
                <div className="mcp-picker__chip-input">
                    <input
                        className="field-input"
                        value={manualTool}
                        onChange={(e) => setManualTool(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault()
                                addManualTool()
                            }
                        }}
                        placeholder="Add tool name (e.g. fs_read or @server/tool)"
                    />
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={addManualTool}
                        disabled={!manualTool.trim()}
                    >
                        <Plus size={13} /> Add
                    </button>
                </div>
            </div>
        </div>
    )
}
