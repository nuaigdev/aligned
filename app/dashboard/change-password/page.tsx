import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import ChangePasswordForm from './ChangePasswordForm'

export default async function DashboardChangePasswordPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/nuaig-login')

  const { data: member } = await supabase.from('team_members').select('must_change_password').eq('id', user.id).maybeSingle()

  return <ChangePasswordForm forced={member?.must_change_password ?? false} />
}
