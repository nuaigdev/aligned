import type { SupabaseClient } from '@supabase/supabase-js'

export interface TicketEmailRecipient {
  name: string
  email: string
}

/** Rejects an obviously-unsendable address before it reaches Resend. */
export const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * Who gets emailed about a ticket on the client's side: every active
 * portal login for that client.
 *
 * Since migration 049 a login's `login_id` *is* the person's email
 * address, which makes client_logins the single source of truth for both
 * "who can sign in" and "who gets told about a ticket" — the two can no
 * longer drift apart. The old source, `client_contacts`, was a second
 * separately managed list and is no longer read anywhere (see that
 * migration's header).
 *
 * Note this is client-wide, not project-scoped: every login already sees
 * every one of the client's tickets in the portal, so scoping the email
 * narrower than the access would be arbitrary.
 */
export async function getTicketClientRecipients(
  supabase: SupabaseClient,
  clientId: string
): Promise<TicketEmailRecipient[]> {
  const { data } = await supabase
    .from('client_logins')
    .select('contact_name, login_id')
    .eq('client_id', clientId)
    .eq('is_active', true)

  const seen = new Set<string>()
  const recipients: TicketEmailRecipient[] = []
  for (const login of data ?? []) {
    const email = login.login_id.toLowerCase()
    // A login issued before migration 049 holds a slug, not an address —
    // there is nothing to send to, so skip it rather than handing Resend
    // a guaranteed bounce.
    if (!EMAIL_PATTERN.test(email) || seen.has(email)) continue
    seen.add(email)
    recipients.push({ name: login.contact_name, email })
  }
  return recipients
}

/**
 * The client's assigned Manager, if active — gets a copy of every ticket
 * email sent to that client's logins (a team member with a real inbox,
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

/** Client logins plus the client's Manager (if any), deduplicated by email. */
export function withManagerCopy(
  contacts: TicketEmailRecipient[],
  manager: TicketEmailRecipient | null
): TicketEmailRecipient[] {
  if (!manager) return contacts
  if (contacts.some(c => c.email.toLowerCase() === manager.email.toLowerCase())) return contacts
  return [...contacts, manager]
}
