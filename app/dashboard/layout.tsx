import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import DashboardSidebar from '@/components/dashboard/Sidebar'

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
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-tertiary)' }}>
      <DashboardSidebar member={member} />
      <main style={{
        flex: 1,
        overflow: 'auto',
        padding: '24px',
      }}>
        {children}
      </main>
    </div>
  )
}
