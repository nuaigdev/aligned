import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import TeamManager from './TeamManager'

export const dynamic = 'force-dynamic'

export default async function TeamPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/nuaig-login')

  const { data: me } = await supabase.from('team_members').select('role').eq('id', user.id).maybeSingle()
  // Server-side gate — the nav item is also hidden from non-admins, but that
  // alone is not the security boundary. A member/manager landing on this
  // URL directly gets bounced.
  if (me?.role !== 'admin') redirect('/dashboard')

  const { data: members } = await supabase
    .from('team_members')
    .select('*')
    .order('name')

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>Team</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
          {members?.length ?? 0} team member{(members?.length ?? 0) === 1 ? '' : 's'} · admin only
        </p>
      </div>

      <TeamManager initialMembers={members ?? []} currentUserId={user.id} />
    </div>
  )
}
