'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { getInitials } from '@/lib/utils'
import { LayoutDashboard, FolderOpen, Users, LogOut, Ticket } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'
import NotificationBell from './NotificationBell'

interface Props {
  member: { name: string; email: string; role: string } | null
}

const NAV = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/tickets', label: 'Tickets', icon: Ticket },
  { href: '/dashboard/projects', label: 'Projects', icon: FolderOpen },
  { href: '/dashboard/clients', label: 'Clients', icon: Users },
]

export default function DashboardSidebar({ member }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createBrowserClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside style={{
      width: '220px',
      flexShrink: 0,
      background: 'var(--bg-primary)',
      borderRight: '0.5px solid var(--border-default)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
    }}>
      {/* Logo */}
      <div style={{
        padding: '18px 16px 14px',
        borderBottom: '0.5px solid var(--border-default)',
      }}>
        <div style={{ fontSize: '16px', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
          <span style={{ color: '#534AB7' }}>Aligned</span>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>NuAIg</div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 8px' }}>
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 10px',
                borderRadius: '7px',
                fontSize: '13px',
                fontWeight: active ? 500 : 400,
                color: active ? '#534AB7' : 'var(--text-secondary)',
                background: active ? 'var(--brand-50)' : 'transparent',
                textDecoration: 'none',
                marginBottom: '2px',
                transition: 'background .12s',
              }}
            >
              <Icon size={15} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      {member && (
        <div style={{
          padding: '12px 12px',
          borderTop: '0.5px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'var(--brand-50)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: 500,
            color: 'var(--brand-800)',
            flexShrink: 0,
          }}>
            {getInitials(member.name)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {member.name}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{member.role}</div>
          </div>
          <NotificationBell />
          <ThemeToggle />
          <button
            onClick={handleSignOut}
            title="Sign out"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              padding: '2px',
              display: 'flex',
            }}
          >
            <LogOut size={14} />
          </button>
        </div>
      )}
    </aside>
  )
}
