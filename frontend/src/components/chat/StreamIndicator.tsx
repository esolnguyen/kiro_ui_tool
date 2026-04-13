interface Props {
  statusText?: string
}

export default function StreamIndicator({ statusText = 'Thinking...' }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 0',
        fontSize: 12,
        color: 'var(--text-tertiary)',
      }}
    >
      <span style={{ display: 'inline-flex', gap: 3 }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              display: 'inline-block',
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: 'var(--accent)',
              animation: `thinkingBounce 1.4s infinite ease-in-out both`,
              animationDelay: `${-0.32 + i * 0.16}s`,
            }}
          />
        ))}
      </span>
      <span>{statusText}</span>
      <style>{`
        @keyframes thinkingBounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
