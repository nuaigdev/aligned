export default function Loading() {
  const pulse: React.CSSProperties = {
    background: 'var(--bg-tertiary)',
    borderRadius: '10px',
    animation: 'pulse 1.4s ease-in-out infinite',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '760px' }}>
      <div style={{ ...pulse, height: '140px' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ ...pulse, height: '80px' }} />
        <div style={{ ...pulse, height: '80px' }} />
      </div>
      <div style={{ ...pulse, height: '200px' }} />
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.5 } }`}</style>
    </div>
  )
}
