import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import NewClientForm from './NewClientForm'

export default async function NewClientPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/nuaig-login')

  const { data: me } = await supabase.from('team_members').select('role').eq('id', user.id).maybeSingle()
  // Server-side gate — the "New client" button is also hidden from
  // plain members, but that alone is not the security boundary.
  if (me?.role !== 'admin' && me?.role !== 'manager') redirect('/dashboard/clients')

  return <NewClientForm />
}
