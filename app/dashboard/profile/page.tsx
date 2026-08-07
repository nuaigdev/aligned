import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import ProfileForm from './ProfileForm'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/nuaig-login')

  const { data: member } = await supabase.from('team_members').select('name, email, role').eq('id', user.id).maybeSingle()
  if (!member) redirect('/nuaig-login')

  return (
    <div style={{ maxWidth: '480px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>Profile</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>{member.email}</p>
      </div>

      <ProfileForm name={member.name} />
    </div>
  )
}
