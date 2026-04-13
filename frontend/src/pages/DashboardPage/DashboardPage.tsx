import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot, Terminal, Sparkles, Zap, Plug, Plus, ArrowRight } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import PageHeader from '../../components/common/PageHeader'
import ModelBadge from '../../components/common/ModelBadge'
import { getAgentColor } from '../../utils/colors'
import { MODEL_IDS, getModelColor, getModelLabel } from '../../utils/models'
import './DashboardPage.scss'

function useAnimatedCounter(target: number) {
    const [value, setValue] = useState(0)

    useEffect(() => {
        if (target === 0) {
            setValue(0)
            return
        }
        const duration = 600
        const start = performance.now()
        const tick = (now: number) => {
            const elapsed = now - start
            const progress = Math.min(elapsed / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setValue(Math.round(eased * target))
            if (progress < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
    }, [target])

    return value
}

export default function DashboardPage() {
    const { agents, commands, skills, pipelines } = useAppStore()

    const agentCount = useAnimatedCounter(agents.length)
    const commandCount = useAnimatedCounter(commands.length)
    const skillCount = useAnimatedCounter(skills.length)
    const pipelineCount = useAnimatedCounter(pipelines.length)

    // Model breakdown
    const modelBreakdown = MODEL_IDS.reduce<Record<string, number>>(
        (acc, m) => {
            acc[m] = agents.filter((a) => a.model === m).length
            return acc
        },
        {}
    )
    const totalAgents = agents.length
    const modelPercentages = Object.fromEntries(
        Object.entries(modelBreakdown)
            .filter(([, count]) => count > 0)
            .map(([m, count]) => [m, totalAgents ? (count / totalAgents) * 100 : 0])
    )

    const statItems = [
        { to: '/agents', count: agentCount, label: 'Agents', icon: <Bot size={15} /> },
        { to: '/commands', count: commandCount, label: 'Commands', icon: <Terminal size={15} /> },
        { to: '/skills', count: skillCount, label: 'Skills', icon: <Sparkles size={15} /> },
        { to: '/pipelines', count: pipelineCount, label: 'Pipelines', icon: <Zap size={15} /> },
    ]

    const quickActions = [
        {
            to: '/pipelines',
            icon: <Zap size={16} />,
            title: 'Create Pipeline',
            description: 'Multi-stage agent workflows',
        },
        {
            to: '/mcp',
            icon: <Plug size={16} />,
            title: 'MCP Servers',
            description: 'Manage tool integrations',
        },
        {
            to: '/skills',
            icon: <Sparkles size={16} />,
            title: 'Skills',
            description: 'Reusable agent capabilities',
        },
    ]

    return (
        <div>
            <PageHeader
                title="Dashboard"
                description="Manage your Kiro agents, commands, and skills"
                action={
                    <Link to="/agents/new" className="btn btn-primary">
                        <Plus size={14} />
                        New Agent
                    </Link>
                }
            />

            <div className="stagger-section dashboard-page__content">
                {/* Stat cards */}
                <div className="dashboard-page__stat-grid">
                    {statItems.map((item) => (
                        <Link
                            key={item.to}
                            to={item.to}
                            className="dashboard-page__stat-link"
                        >
                            <div className="bg-card hover-card dashboard-page__stat-card">
                                <div className="card-glow dashboard-page__stat-card-glow" />
                                <div className="dashboard-page__stat-header">
                                    <span className="dashboard-page__stat-icon">{item.icon}</span>
                                    <span className="dashboard-page__stat-label">
                                        {item.label}
                                    </span>
                                </div>
                                <div className="stat-number">{item.count}</div>
                            </div>
                        </Link>
                    ))}
                </div>

                {/* Model distribution */}
                {agents.length > 0 && (
                    <div className="bg-card dashboard-page__model-distribution">
                        <div className="dashboard-page__model-header">
                            <span className="text-section-title">Model Distribution</span>
                            <span className="dashboard-page__model-count">
                                {totalAgents} agent{totalAgents === 1 ? '' : 's'}
                            </span>
                        </div>
                        <div className="proportion-bar dashboard-page__proportion-bar">
                            {Object.entries(modelPercentages).map(([model, pct]) => (
                                <div
                                    key={model}
                                    className="proportion-bar__segment"
                                    style={{ flexGrow: pct, background: getModelColor(model) }}
                                />
                            ))}
                        </div>
                        <div className="dashboard-page__model-legend">
                            {Object.entries(modelBreakdown).map(([model, count]) => (
                                <div key={model} className="dashboard-page__model-legend-item">
                                    <div
                                        className="dashboard-page__model-dot"
                                        style={{ background: getModelColor(model) }}
                                    />
                                    <span className="dashboard-page__model-label">
                                        {getModelLabel(model)}
                                    </span>
                                    <span className="dashboard-page__model-value">
                                        {count}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Bento: agents list + quick actions */}
                <div className="dashboard-page__bento">
                    {/* Agents */}
                    <div className="dashboard-page__panel">
                        <div className="dashboard-page__panel-header">
                            <span className="text-section-title dashboard-page__panel-title">
                                <Bot size={14} className="dashboard-page__panel-title-icon" />
                                Agents
                            </span>
                            <Link to="/agents" className="dashboard-page__view-all-link">
                                View all
                            </Link>
                        </div>
                        {agents.length === 0 ? (
                            <div className="dashboard-page__empty-state">
                                No agents yet.{' '}
                                <Link to="/agents/new" className="dashboard-page__empty-link">
                                    Create one
                                </Link>
                            </div>
                        ) : (
                            <div>
                                {agents.slice(0, 6).map((agent) => {
                                    const color = getAgentColor(agent.color)
                                    return (
                                        <Link
                                            key={agent.slug}
                                            to={`/agents/${agent.slug}`}
                                            className="hover-bg dashboard-page__agent-link"
                                        >
                                            <div
                                                className="dashboard-page__agent-avatar"
                                                style={{
                                                    background: color + '18',
                                                    border: `1px solid ${color}28`,
                                                }}
                                            >
                                                <Bot size={14} style={{ color }} />
                                            </div>
                                            <div className="dashboard-page__agent-info">
                                                <div className="dashboard-page__agent-name">
                                                    {agent.name}
                                                </div>
                                                {agent.description && (
                                                    <div className="dashboard-page__agent-description">
                                                        {agent.description}
                                                    </div>
                                                )}
                                            </div>
                                            <ModelBadge model={agent.model} />
                                        </Link>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* Right column */}
                    <div className="dashboard-page__right-column">
                        {/* Commands mini-list */}
                        <div className="dashboard-page__panel">
                            <div className="dashboard-page__panel-header">
                                <span className="text-section-title dashboard-page__panel-title">
                                    <Terminal size={14} className="dashboard-page__panel-title-icon" />
                                    Commands
                                </span>
                                <Link to="/commands" className="dashboard-page__view-all-link">
                                    View all
                                </Link>
                            </div>
                            {commands.length === 0 ? (
                                <div className="dashboard-page__empty-state--small">
                                    No commands
                                </div>
                            ) : (
                                <div>
                                    {commands.slice(0, 4).map((cmd) => (
                                        <Link
                                            key={cmd.slug}
                                            to={`/commands/${cmd.slug}`}
                                            className="hover-bg dashboard-page__command-link"
                                        >
                                            <span className="dashboard-page__command-prefix">
                                                /
                                            </span>
                                            <span className="dashboard-page__command-name">
                                                {cmd.name}
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Quick actions */}
                        <div className="dashboard-page__quick-actions">
                            {quickActions.map((action) => (
                                <Link
                                    key={action.to}
                                    to={action.to}
                                    className="dashboard-page__quick-action-link"
                                >
                                    <div className="bg-card hover-card dashboard-page__quick-action-card">
                                        <div className="dashboard-page__quick-action-row">
                                            <div className="dashboard-page__quick-action-icon-box">
                                                {action.icon}
                                            </div>
                                            <div className="dashboard-page__quick-action-info">
                                                <div className="dashboard-page__quick-action-title">
                                                    {action.title}
                                                </div>
                                                <div className="dashboard-page__quick-action-desc">
                                                    {action.description}
                                                </div>
                                            </div>
                                            <ArrowRight size={14} className="dashboard-page__quick-action-arrow" />
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
