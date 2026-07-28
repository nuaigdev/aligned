import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import NewProjectForm from './NewProjectForm'

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: { client?: string }
}) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('team_members').select('role').eq('id', user.id).maybeSingle()
  // Server-side gate — the "New project" button is also hidden for
  // members, but that alone is not the security boundary.
  if (me?.role !== 'admin' && me?.role !== 'manager') redirect('/dashboard/projects')

  return <NewProjectForm defaultClientId={searchParams.client} />
}
