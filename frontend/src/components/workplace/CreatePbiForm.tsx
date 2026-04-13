import { useState } from 'react'
import { Plus, ChevronUp, Send, Bot } from 'lucide-react'
import { useWorkplace } from './WorkplaceContext'
import styles from './workplace.module.scss'

interface CreatePbiFormProps {
  areaFilter: string
}

export default function CreatePbiForm({ areaFilter }: CreatePbiFormProps) {
  const { showCreateForm, setShowCreateForm, agentSlug, setAgentSlug, agents, termReady, sendPromptToTerminal } = useWorkplace()
  const [description, setDescription] = useState('')

  if (!showCreateForm) return null

  function handleSubmit() {
    if (!description.trim()) return
    const areaContext = areaFilter ? `\nArea Path: ${areaFilter}` : ''
    const prompt = `Based on the following description/transcription, create a Product Backlog Item (PBI) in Azure DevOps with a clear title, detailed description, and acceptance criteria.${areaContext}\n\n---\n${description.trim()}`
    sendPromptToTerminal(prompt)
    setDescription('')
    setShowCreateForm(false)
  }

  return (
    <div className={styles.createForm}>
      <div className={styles.createFormHeader}>
        <span className={styles.createFormTitle}>
          <Plus size={13} />
          Create PBI
        </span>
        <button className={`btn btn-ghost ${styles.createFormClose}`} onClick={() => setShowCreateForm(false)}>
          <ChevronUp size={13} />
        </button>
      </div>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe the feature, paste a transcription, or report a bug..."
        className={`input ${styles.createTextarea}`}
      />
      <div className={styles.createActions}>
        <Bot size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
        <select value={agentSlug} onChange={(e) => setAgentSlug(e.target.value)}
          className={`input ${styles.createAgentSelect}`}>
          <option value="">Default (no agent)</option>
          {agents.map((a) => (
            <option key={a.slug} value={a.slug}>{a.name}</option>
          ))}
        </select>
        <button
          className={`btn btn-primary ${styles.createSubmit}`}
          onClick={handleSubmit}
          disabled={!description.trim() || !termReady}
        >
          <Send size={12} />
          Send to Agent
        </button>
      </div>
    </div>
  )
}
