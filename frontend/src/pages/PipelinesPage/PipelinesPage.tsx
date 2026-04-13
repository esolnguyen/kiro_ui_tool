import { useState } from 'react'
import { Plus, Zap, Trash2 } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import PageHeader from '../../components/common/PageHeader'
import EmptyState from '../../components/common/EmptyState'
import { pipelinesApi } from '../../api/pipelines'
import PipelineBuilder from '../../components/pipelines/PipelineBuilder'
import './PipelinesPage.scss'

export default function PipelinesPage() {
    const { pipelines, fetchPipelines } = useAppStore()
    const [creating, setCreating] = useState(false)
    const [selectedId, setSelectedId] = useState<string | null>(null)

    async function handleDelete(id: string) {
        if (!confirm('Delete this pipeline?')) return
        try {
            await pipelinesApi.delete(id)
            await fetchPipelines()
            if (selectedId === id) setSelectedId(null)
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Delete failed')
        }
    }

    const selectedPipeline = pipelines.find((p) => p.id === selectedId) ?? null
    const isEditing = creating || !!selectedPipeline

    return (
        <div>
            <PageHeader
                title="Pipelines"
                description="Multi-stage agent workflows with prompt templates and gates"
                action={
                    <button
                        className="btn btn-primary"
                        onClick={() => {
                            setSelectedId(null)
                            setCreating(true)
                        }}
                    >
                        <Plus size={14} />
                        New Pipeline
                    </button>
                }
            />

            <div className="pipelines-page__content">
                {/* Pipeline list */}
                <div className="pipelines-page__sidebar">
                    {pipelines.length === 0 && !creating ? (
                        <EmptyState
                            icon={<Zap size={22} />}
                            title="No pipelines"
                            description="Create your first multi-stage pipeline."
                            action={
                                <button
                                    className="btn btn-primary"
                                    onClick={() => setCreating(true)}
                                >
                                    <Plus size={14} />
                                    Create
                                </button>
                            }
                        />
                    ) : (
                        pipelines.map((p) => (
                            <div
                                key={p.id}
                                className={`pipelines-page__card ${selectedId === p.id ? 'pipelines-page__card--selected bg-raised' : 'bg-card'}`}
                                onClick={() => {
                                    setSelectedId(p.id)
                                    setCreating(false)
                                }}
                            >
                                <div className="pipelines-page__card-header">
                                    <div className="pipelines-page__card-info">
                                        <div className="pipelines-page__card-name">
                                            {p.name}
                                        </div>
                                        <div className="pipelines-page__card-meta">
                                            {p.stages.length} stage{p.stages.length !== 1 ? 's' : ''}
                                        </div>
                                    </div>
                                    <div className="pipelines-page__card-actions">
                                        <button
                                            className="btn btn-ghost pipelines-page__card-btn--delete"
                                            onClick={(e) => { e.stopPropagation(); handleDelete(p.id) }}
                                            aria-label="Delete pipeline"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Right panel: builder */}
                <div className="pipelines-page__panel">
                    <div className={`pipelines-page__builder ${isEditing ? 'pipelines-page__builder--active' : ''}`}>
                        {isEditing ? (
                            <PipelineBuilder
                                key={selectedPipeline?.id ?? 'new'}
                                initial={selectedPipeline ?? undefined}
                                onSave={async (data) => {
                                    if (selectedPipeline) {
                                        await pipelinesApi.update(selectedPipeline.id, data)
                                    } else {
                                        const created = await pipelinesApi.create(data)
                                        setSelectedId(created.id)
                                    }
                                    await fetchPipelines()
                                    setCreating(false)
                                }}
                                onCancel={() => {
                                    setCreating(false)
                                    setSelectedId(null)
                                }}
                            />
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    )
}
