import { getSessionClient } from '@/lib/portal/session-guard'
import { createServiceRoleClient } from '@/lib/supabase/server'
import NewPortalTicketForm from './NewPortalTicketForm'

export const dynamic = 'force-dynamic'

export default async function NewPortalTicketPage() {
  const client = await getSessionClient()
  const supabase = createServiceRoleClient()

  const [{ data: projects }, { data: setting }] = await Promise.all([
    supabase.from('projects').select('id, name').eq('client_id', client.id).order('name'),
    supabase.from('app_settings').select('value').eq('key', 'ticket_client_can_set_priority').maybeSingle(),
  ])

  const canSetPriority = (setting?.value as any)?.value ?? true

  return (
    <div>
      <h1 style={{ fontSize: '20px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 4px' }}>New ticket</h1>
      <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: '0 0 20px' }}>
        Tell us what's going on — we'll route it to the right person.
      </p>
      <NewPortalTicketForm projects={projects ?? []} canSetPriority={canSetPriority} />
    </div>
  )
}
