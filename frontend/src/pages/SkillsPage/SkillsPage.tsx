import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Sparkles, Trash2, Github, Wand2 } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import PageHeader from '../../components/common/PageHeader'
import EmptyState from '../../components/common/EmptyState'
import { skillsApi } from '../../api/skills'
import GithubImportModal from '../../components/modals/GithubImportModal'
import GenerateWithKiroModal from '../../components/modals/GenerateWithKiroModal'
import './SkillsPage.scss'

export default function SkillsPage() {
    const { skills, fetchSkills } = useAppStore()
    const [deleting, setDeleting] = useState<string | null>(null)
    const [githubModalOpen, setGithubModalOpen] = useState(false)
    const [generateModalOpen, setGenerateModalOpen] = useState(false)

    async function handleDelete(slug: string) {
        if (!confirm(`Delete skill "${slug}"?`)) return
        setDeleting(slug)
        try {
            await skillsApi.delete(slug)
            await fetchSkills()
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
                onImported={() => { setGithubModalOpen(false); fetchSkills() }}
                type="skills"
            />
            <GenerateWithKiroModal
                isOpen={generateModalOpen}
                entityType="skill"
                onClose={() => setGenerateModalOpen(false)}
                onComplete={fetchSkills}
            />
            <PageHeader
                title="Skills"
                description="Reusable capabilities that can be assigned to agents"
                action={
                    <div className="skills-page__actions">
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
                        <Link to="/skills/new" className="btn btn-primary">
                            <Plus size={14} />
                            New Skill
                        </Link>
                    </div>
                }
            />

            <div className="skills-page__content">
                {skills.length === 0 ? (
                    <EmptyState
                        icon={<Sparkles size={24} />}
                        title="No skills yet"
                        description="Skills extend agents with reusable capabilities."
                        action={
                            <Link to="/skills/new" className="btn btn-primary">
                                <Plus size={14} />
                                Create Skill
                            </Link>
                        }
                    />
                ) : (
                    <div className="skills-page__grid">
                        {skills.map((skill) => (
                            <div key={skill.slug} className="bg-card skills-page__card">
                                <div className="skills-page__card-header">
                                    <div className="skills-page__card-name-group">
                                        <div className="skills-page__card-icon">
                                            <Sparkles size={13} />
                                        </div>
                                        <span className="skills-page__card-name">
                                            {skill.name}
                                        </span>
                                    </div>
                                    {skill.context && (
                                        <span className="skills-page__card-context">
                                            {skill.context}
                                        </span>
                                    )}
                                </div>
                                {skill.description && (
                                    <p className="skills-page__card-description">
                                        {skill.description}
                                    </p>
                                )}
                                <div className="skills-page__card-footer">
                                    <span className="skills-page__card-slug">
                                        {skill.slug}
                                    </span>
                                    <div className="skills-page__card-actions">
                                        <Link
                                            to={`/skills/${skill.slug}`}
                                            className="btn btn-secondary skills-page__card-edit"
                                        >
                                            Edit
                                        </Link>
                                        <button
                                            className="btn btn-ghost skills-page__card-delete"
                                            onClick={() => handleDelete(skill.slug)}
                                            disabled={deleting === skill.slug}
                                            aria-label={`Delete ${skill.name}`}
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
