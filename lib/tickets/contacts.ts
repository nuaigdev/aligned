import type { SupabaseClient } from '@supabase/supabase-js'

export interface TicketEmailRecipient {
  name: string
  email: string
}

/**
 * The effective contact list for emailing about a ticket — client-level
 * defaults union project-level additions for the ticket's own project (if
 * it has one). Mirrors CLAUDE.md's Contact management rule; the two
 * previous call sites (team-actions.ts, portal-actions.ts) each only ever
 * looked at client-level defaults, silently missing anyone added for a
 * specific project.
 */
export async function getTicketContactRecipients(
  supabase: SupabaseClient,
  clientId: string,
  projectId: string | null
): Promise<TicketEmailRecipient[]> {
  let query = supabase
    .from('client_contacts')
    .select('name, email')
    .eq('client_id', clientId)
    .eq('is_active', true)

  query = projectId
    ? query.or(`project_id.is.null,project_id.eq.${projectId}`)
    : query.is('project_id', null)

  const { data } = await query

  const seen = new Set<string>()
  const recipients: TicketEmailRecipient[] = []
  for (const c of data ?? []) {
    const key = c.email.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    recipients.push({ name: c.name, email: c.email })
  }
  return recipients
}

/**
 * The client's assigned Manager, if active — gets a copy of every ticket
 * email sent to that client's contacts (a team member with a real inbox,
 * not just the in-app notification they already get).
 */
export async function getManagerContact(
  supabase: SupabaseClient,
  managerId: string | null | undefined
): Promise<TicketEmailRecipient | null> {
  if (!managerId) return null
  const { data } = await supabase
    .from('team_members')
    .select('name, email, is_active')
    .eq('id', managerId)
    .maybeSingle()
  if (!data?.is_active) return null
  return { name: data.name, email: data.email }
}

/** Contacts plus the client's Manager (if any), deduplicated by email. */
export function withManagerCopy(
  contacts: TicketEmailRecipient[],
  manager: TicketEmailRecipient | null
): TicketEmailRecipient[] {
  if (!manager) return contacts
  if (contacts.some(c => c.email.toLowerCase() === manager.email.toLowerCase())) return contacts
  return [...contacts, manager]
}
