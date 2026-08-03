import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import Image from 'next/image'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'Aligned — NuAIg',
  description: 'Client ticketing platform',
  robots: 'noindex, nofollow', // internal tool
  icons: { icon: '/logo.png' },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              border: '0.5px solid var(--border-default)',
              borderRadius: '10px',
              fontSize: '13px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            },
            success: { iconTheme: { primary: '#3B6D11', secondary: '#EAF3DE' } },
            error: { iconTheme: { primary: '#A32D2D', secondary: '#FCEBEB' } },
          }}
        />
        {/* Mobile block — shown on screens below md (768px) */}
        <div className="mobile-block">
          <div className="mobile-block__inner">
            <Image src="/logo.png" alt="Aligned" width={40} height={40} style={{ marginBottom: '16px' }} />
            <div className="mobile-block__logo brand-wordmark">Aligned</div>
            <h1 className="mobile-block__title">Desktop only</h1>
            <p className="mobile-block__body">
              Aligned is designed for desktop use. Please open this page on a
              laptop or desktop computer for the full experience.
            </p>
            <p className="mobile-block__sub">
              Log in from a laptop or desktop to view and reply to tickets.
            </p>
          </div>
        </div>

        {/* Main app — hidden on mobile, shown on desktop */}
        <div className="desktop-app">
          {children}
        </div>

        <style>{`
          .mobile-block {
            display: none;
          }
          .desktop-app {
            display: block;
            height: 100%;
          }
          @media (max-width: 767px) {
            .mobile-block {
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100dvh;
              padding: 32px 24px;
              background: var(--bg-tertiary);
            }
            .desktop-app {
              display: none;
            }
          }
          .mobile-block__inner {
            max-width: 320px;
            text-align: center;
          }
          .mobile-block__logo {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 32px;
            letter-spacing: -0.03em;
          }
          .mobile-block__title {
            font-size: 22px;
            font-weight: 500;
            color: var(--text-primary);
            margin: 0 0 12px;
          }
          .mobile-block__body {
            font-size: 15px;
            color: var(--text-secondary);
            line-height: 1.6;
            margin: 0 0 16px;
          }
          .mobile-block__sub {
            font-size: 13px;
            color: var(--text-tertiary);
            line-height: 1.6;
            margin: 0;
          }
        `}</style>
      </body>
    </html>
  )
}
