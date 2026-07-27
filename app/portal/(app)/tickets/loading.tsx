export default function Loading() {
  const pulse: React.CSSProperties = {
    background: 'var(--bg-tertiary)',
    borderRadius: '10px',
    animation: 'pulse 1.4s ease-in-out infinite',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} style={{ ...pulse, height: '52px' }} />
      ))}
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.5 } }`}</style>
    </div>
  )
}
