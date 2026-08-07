import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getClientSession } from '@/lib/auth/client-session-cookies'
import ClientLoginForm from './ClientLoginForm'

export default async function RootPage() {
  const supabase = createSupabaseServerClient()
  const [{ data: { user } }, clientSession] = await Promise.all([
    supabase.auth.getUser(),
    getClientSession(),
  ])

  if (user) redirect('/dashboard')
  if (clientSession) redirect('/portal')

  return <ClientLoginForm />
}
