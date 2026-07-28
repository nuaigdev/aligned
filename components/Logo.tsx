import Image from 'next/image'

export function Logo({
  size = 28,
  showWordmark = true,
  wordmarkSize = 16,
}: {
  size?: number
  showWordmark?: boolean
  wordmarkSize?: number
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
      <Image
        src="/logo.png"
        alt="Aligned"
        width={size}
        height={size}
        priority
        style={{ flexShrink: 0 }}
      />
      {showWordmark && (
        <span
          className="brand-wordmark"
          style={{
            fontSize: `${wordmarkSize}px`,
            fontWeight: 600,
            letterSpacing: '-0.03em',
          }}
        >
          Aligned
        </span>
      )}
    </div>
  )
}
