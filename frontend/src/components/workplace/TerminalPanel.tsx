import { useState } from 'react'
import { Terminal as TerminalIcon, Zap, GitBranch } from 'lucide-react'
import { useWorkplace } from './WorkplaceContext'
import { useTerminal } from '../../hooks/useTerminal'
import PipelineStatusBar from './PipelineStatusBar'
import styles from './workplace.module.scss'

export default function TerminalPanel() {
  const { termReady, isWhipping } = useWorkplace()
  const { termContainerRef, sendRaw } = useTerminal()
  const [codeIntelInit, setCodeIntelInit] = useState(false)

  function handleCodeIntelInit() {
    sendRaw('/code init\r')
    setCodeIntelInit(true)
  }

  function handleTangent() {
    sendRaw('/tangent\r')
  }

  return (
    <div className={styles.rightPanel}>
      <PipelineStatusBar />
      <div className={styles.termHeader}>
        <TerminalIcon size={13} style={{ color: '#a6e3a1' }} />
        <span className={styles.termTitle}>Terminal</span>
        {termReady && (
          <span className={styles.termStatus}>
            <span className={styles.termDot} />
            Connected
          </span>
        )}
        <div className={styles.termActions}>
          <button
            className={`btn btn-ghost ${styles.termActionBtn}`}
            onClick={handleCodeIntelInit}
            disabled={!termReady}
            title="Initialize Code Intelligence for the current project"
          >
            <Zap size={12} style={{ color: codeIntelInit ? '#a6e3a1' : undefined }} />
            <span>Code Intel</span>
          </button>
          <button
            className={`btn btn-ghost ${styles.termActionBtn}`}
            onClick={handleTangent}
            disabled={!termReady}
            title="Start/exit tangent mode (Ctrl+T) — ask side questions without polluting context"
          >
            <GitBranch size={12} />
            <span>Tangent</span>
          </button>
          <span className={styles.termShortcut}>Ctrl+T</span>
        </div>
      </div>
      <div ref={termContainerRef} className={styles.termContainer} />
      {isWhipping && (
        <div className={styles.whipOverlay}>
          <img
            src="https://media1.tenor.com/m/0M9mDpNl5J4AAAAC/get-to-work-work.gif"
            alt="Get to work!"
            className={styles.whipGif}
          />
        </div>
      )}
    </div>
  )
}
