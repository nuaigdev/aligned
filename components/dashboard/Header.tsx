'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { createBrowserClient } from '@/lib/supabase/client'
import { getInitials } from '@/lib/utils'
import { LayoutDashboard, FolderOpen, Users, LogOut, Ticket, UserCog } from 'lucide-react'
import { Logo } from '@/components/Logo'
import NotificationBell from './NotificationBell'
import TicketSearch from './TicketSearch'

interface Props {
  member: { name: string; email: string; role: string } | null
}

const NAV = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/tickets', label: 'Tickets', icon: Ticket },
  { href: '/dashboard/projects', label: 'Projects', icon: FolderOpen },
  { href: '/dashboard/clients', label: 'Clients', icon: Users },
]

const ADMIN_NAV = { href: '/dashboard/team', label: 'Team', icon: UserCog, exact: false }

export default function DashboardHeader({ member }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createBrowserClient()
  const nav = member?.role === 'admin' ? [...NAV, ADMIN_NAV] : NAV

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header style={{
      height: '58px',
      flexShrink: 0,
      background: 'var(--bg-primary)',
      borderBottom: '0.5px solid var(--border-default)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      gap: '36px',
    }}>
      <Logo size={26} wordmarkSize={16} />

      <nav style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, height: '100%' }}>
        {nav.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                height: '100%',
                padding: '0 12px',
                fontSize: '13px',
                fontWeight: active ? 500 : 400,
                color: active ? '#EA580C' : 'var(--text-secondary)',
                textDecoration: 'none',
                transition: 'color .12s',
              }}
            >
              <Icon size={15} />
              {label}
              {active && (
                <motion.div
                  layoutId="dashboard-nav-underline"
                  style={{ position: 'absolute', left: '4px', right: '4px', bottom: 0, height: '2px', background: '#EA580C', borderRadius: '2px 2px 0 0' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              )}
            </Link>
          )
        })}
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <TicketSearch />
        <NotificationBell />

        {member && (
          <Link
            href="/dashboard/profile"
            title="Profile"
            style={{ display: 'flex', alignItems: 'center', gap: '9px', textDecoration: 'none' }}
          >
            <div style={{
              width: '30px', height: '30px', borderRadius: '50%',
              background: 'var(--brand-50)', color: 'var(--brand-800)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: 500, flexShrink: 0,
            }}>
              {getInitials(member.name)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
                {member.name}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{member.role}</div>
            </div>
          </Link>
        )}

        <button
          onClick={handleSignOut}
          title="Sign out"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-tertiary)',
            padding: '4px',
            display: 'flex',
          }}
        >
          <LogOut size={15} />
        </button>
      </div>
    </header>
  )
}
