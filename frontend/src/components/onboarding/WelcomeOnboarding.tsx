import { useState } from 'react'
import { Zap, FolderOpen, CheckCircle2, X, ChevronRight } from 'lucide-react'

const STORAGE_KEY = 'kiro-onboarded'

interface Props {
  onComplete?: () => void
}

export default function WelcomeOnboarding({ onComplete }: Props) {
  const [visible, setVisible] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) !== 'true'
  })
  const [step, setStep] = useState(0)
  const [kiroDir, setKiroDir] = useState('~/.kiro')
  const [isSettingUp, setIsSettingUp] = useState(false)

  if (!visible) return null

  function complete() {
    localStorage.setItem(STORAGE_KEY, 'true')
    setVisible(false)
    onComplete?.()
  }

  async function handleSetup() {
    setIsSettingUp(true)
    try {
      await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kiroDir }),
      })
    } catch { /* ignore */ }
    finally {
      setIsSettingUp(false)
      setStep(2)
    }
  }

  const steps = [
    {
      title: 'Welcome to Kiro Agent Manager',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center' }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              background: 'var(--accent-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Zap size={36} color="#fff" />
          </div>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
              Welcome to Kiro Agent Manager
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 360, margin: '0 auto' }}>
              A visual dashboard for managing your Kiro AI agents, commands, skills, and workflows — without touching markdown files directly.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, width: '100%' }}>
            {[
              { icon: '🤖', title: 'Agents', desc: 'Specialized AI assistants with custom instructions' },
              { icon: '/', title: 'Commands', desc: 'Reusable workflows triggered with slash commands' },
              { icon: '✦', title: 'Skills', desc: 'Capabilities you can add to any agent' },
            ].map((item) => (
              <div
                key={item.title}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: 'var(--input-bg)',
                  border: '1px solid var(--border-subtle)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 20, marginBottom: 4 }}>{item.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>{item.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      ),
      action: 'Get Started',
      onAction: () => setStep(1),
    },
    {
      title: 'Setup Workspace',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FolderOpen size={22} color="var(--accent)" />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>Setup Directory</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                Where should Kiro store your agents, commands, and skills?
              </p>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>
              Kiro Directory
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="field-input"
                value={kiroDir}
                onChange={(e) => setKiroDir(e.target.value)}
                placeholder="~/.kiro"
                style={{ flex: 1 }}
              />
              <button
                onClick={() => setKiroDir('~/.kiro')}
                className="btn btn-secondary"
                style={{ flexShrink: 0, fontSize: 12 }}
              >
                Use Default
              </button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
              Default: ~/.kiro
            </p>
          </div>
        </div>
      ),
      action: isSettingUp ? 'Setting up...' : 'Configure',
      onAction: handleSetup,
    },
    {
      title: 'All Set!',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(5, 150, 105, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={40} color="var(--success)" />
          </div>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>Your workspace is ready!</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 340, margin: '0 auto' }}>
              Start by creating your first agent, or explore the templates in the Explore page.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', textAlign: 'left' }}>
            {[
              'Create agents with custom personalities and instructions',
              'Build slash commands for recurring workflows',
              'Add skills to teach agents specific capabilities',
              'Use the CLI tab to run Kiro directly in your terminal',
            ].map((tip) => (
              <div key={tip} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <ChevronRight size={14} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{tip}</span>
              </div>
            ))}
          </div>
        </div>
      ),
      action: 'Start Using Kiro',
      onAction: complete,
    },
  ]

  const currentStep = steps[step]

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
      }}
    >
      <div
        style={{
          background: 'var(--surface-overlay)',
          borderRadius: 20,
          padding: 32,
          width: '90%',
          maxWidth: 520,
          maxHeight: '90vh',
          overflowY: 'auto',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {steps.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === step ? 20 : 8,
                  height: 8,
                  borderRadius: 999,
                  background: i === step ? 'var(--accent)' : i < step ? 'var(--accent)' : 'var(--border-default)',
                  transition: 'all 0.2s',
                  opacity: i < step ? 0.5 : 1,
                }}
              />
            ))}
          </div>
          <button
            onClick={complete}
            style={{ padding: 6, borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}
            title="Skip"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ marginTop: 16, marginBottom: 24 }}>
          {currentStep.content}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={complete}
            style={{ fontSize: 12, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Skip setup
          </button>
          <button
            onClick={currentStep.onAction}
            disabled={isSettingUp}
            className="btn btn-primary"
            style={{ minWidth: 120 }}
          >
            {currentStep.action}
          </button>
        </div>
      </div>
    </div>
  )
}
