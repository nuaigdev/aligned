import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { ThemeProvider } from '@/components/ThemeProvider'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'Aligned — NuAIg',
  description: 'Project decision and milestone management platform',
  robots: 'noindex, nofollow', // internal tool
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%23534AB7'/><text x='50%' y='54%' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='18' font-family='system-ui' font-weight='600'>A</text></svg>" },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Anti-flash: set theme before first paint */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('theme');if(!t)t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',t);})();` }} />
      </head>
      <body>
        <ThemeProvider>
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
              <div className="mobile-block__logo">Aligned</div>
              <h1 className="mobile-block__title">Desktop only</h1>
              <p className="mobile-block__body">
                Aligned is designed for desktop use. Please open this page on a
                laptop or desktop computer for the full experience.
              </p>
              <p className="mobile-block__sub">
                For approvals — check your email and open the sign link on a desktop browser.
              </p>
            </div>
          </div>

          {/* Main app — hidden on mobile, shown on desktop */}
          <div className="desktop-app">
            {children}
          </div>
        </ThemeProvider>

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
            color: var(--text-primary);
            margin-bottom: 32px;
            letter-spacing: -0.02em;
          }
          .mobile-block__logo span {
            color: #534AB7;
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
