export default function Loading() {
  const pulse: React.CSSProperties = {
    background: 'var(--bg-tertiary)',
    borderRadius: '8px',
    animation: 'pulse 1.4s ease-in-out infinite',
  }

  return (
    <div>
      <div style={{ ...pulse, width: '160px', height: '22px', marginBottom: '20px' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{ ...pulse, height: '220px' }} />
        ))}
      </div>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.5 } }`}</style>
    </div>
  )
}
