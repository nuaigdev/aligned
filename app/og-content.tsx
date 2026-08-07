import { readFileSync } from 'fs'
import { join } from 'path'

export const ogImageSize = { width: 1200, height: 630 } as const

export function OgImage() {
  const logoData = readFileSync(join(process.cwd(), 'public', 'logo.png'))
  const logoSrc = `data:image/png;base64,${logoData.toString('base64')}`

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
        background: '#534AB7',
        backgroundImage:
          'radial-gradient(circle at 88% 12%, #6E63D6 0%, #534AB7 55%)',
        padding: '80px',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          width: 100,
          height: 100,
          borderRadius: 24,
          background: '#ffffff',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 44,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} width={64} height={64} alt="" />
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: 88,
          color: '#ffffff',
          fontWeight: 500,
          letterSpacing: '-0.03em',
        }}
      >
        Aligned
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: 32,
          color: '#EEEDFE',
          marginTop: 22,
        }}
      >
        Client ticketing platform by NuAIg
      </div>
    </div>
  )
}
