import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import DashboardHeader from '@/components/dashboard/Header'
import { NotificationsProvider } from '@/hooks/useNotifications'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('team_members')
    .select('name, email, role')
    .eq('id', user.id)
    .single()

  return (
    <NotificationsProvider teamMemberId={user.id}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg-tertiary)' }}>
        <DashboardHeader member={member} />
        <main style={{
          flex: 1,
          overflow: 'auto',
          padding: '24px',
        }}>
          {children}
        </main>
      </div>
    </NotificationsProvider>
  )
}
