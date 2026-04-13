import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Bot, Github, Wand2 } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import PageHeader from '../../components/common/PageHeader'
import AgentCard from '../../components/agents/AgentCard'
import EmptyState from '../../components/common/EmptyState'
import { agentsApi } from '../../api/agents'
import GithubImportModal from '../../components/modals/GithubImportModal'
import GenerateWithKiroModal from '../../components/modals/GenerateWithKiroModal'
import './AgentsPage.scss'

export default function AgentsPage() {
    const { agents, fetchAgents } = useAppStore()
    const [deleting, setDeleting] = useState<string | null>(null)
    const [githubModalOpen, setGithubModalOpen] = useState(false)
    const [generateModalOpen, setGenerateModalOpen] = useState(false)

    async function handleDelete(slug: string) {
        if (!confirm(`Delete agent "${slug}"? This cannot be undone.`)) return
        setDeleting(slug)
        try {
            await agentsApi.delete(slug)
            await fetchAgents()
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Delete failed')
        } finally {
            setDeleting(null)
        }
    }

    return (
        <div>
            <GithubImportModal
                isOpen={githubModalOpen}
                onClose={() => setGithubModalOpen(false)}
                onImported={() => { setGithubModalOpen(false); fetchAgents() }}
                type="agents"
            />
            <GenerateWithKiroModal
                isOpen={generateModalOpen}
                entityType="agent"
                onClose={() => setGenerateModalOpen(false)}
                onComplete={fetchAgents}
            />
            <PageHeader
                title="Agents"
                description="AI agents with custom instructions and model settings"
                action={
                    <div className="agents-page__header-actions">
                        <button
                            onClick={() => setGenerateModalOpen(true)}
                            className="btn btn-secondary"
                        >
                            <Wand2 size={14} />
                            Generate with Kiro
                        </button>
                        <button
                            onClick={() => setGithubModalOpen(true)}
                            className="btn btn-secondary"
                        >
                            <Github size={14} />
                            Import from GitHub
                        </button>
                        <Link to="/agents/new" className="btn btn-primary">
                            <Plus size={14} />
                            New Agent
                        </Link>
                    </div>
                }
            />

            <div className="agents-page__content">
                {agents.length === 0 ? (
                    <EmptyState
                        icon={<Bot size={24} />}
                        title="No agents yet"
                        description="Create your first Kiro agent to get started."
                        action={
                            <Link to="/agents/new" className="btn btn-primary">
                                <Plus size={14} />
                                Create Agent
                            </Link>
                        }
                    />
                ) : (
                    <div className="agents-page__grid">
                        {agents.map((agent) => (
                            <AgentCard
                                key={agent.slug}
                                agent={agent}
                                onDelete={deleting ? undefined : handleDelete}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
