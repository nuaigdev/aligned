'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireTeamRole } from '@/lib/auth/team-role-guard'
import { hashPassword, generateTempPassword } from '@/lib/auth/client-session'
import { sendClientLoginCredentialsEmail } from '@/lib/email/index'
import { EMAIL_PATTERN } from '@/lib/tickets/contacts'

export async function setClientManager(
  clientId: string,
  managerId: string | null
): Promise<{ ok: true } | { error: string }> {
  const check = await requireTeamRole(['admin', 'manager'])
  if ('error' in check) return check

  const supabase = createSupabaseServerClient()
  const { error } = await supabase.from('clients').update({ manager_id: managerId }).eq('id', clientId)
  if (error) return { error: error.message }

  revalidatePath(`/dashboard/clients/${clientId}`)
  return { ok: true }
}

/**
 * `emailed` is false whenever the credential mail didn't actually go out
 * — RESEND_API_KEY unset, or Resend rejected it — which is why the
 * plaintext password is still returned either way and still revealed
 * on screen. That reveal is the fallback path, not dead UI.
 */
type IssuedCredential = { password: string; emailed: boolean }

/**
 * Creates a new named login for this client. `loginId` is the person's
 * email address (migration 049): it's what they sign in with *and* the
 * address every ticket email for this client goes to, so there's no
 * second contact list to keep in sync.
 *
 * Returns the plaintext password exactly once — only the hash is ever
 * persisted, and it cannot be retrieved again after this call returns.
 * A client can have any number of these — each is independent (own
 * address, own password) and all see the exact same client-scoped
 * portal data.
 */
export async function createClientLogin(
  clientId: string,
  loginId: string,
  contactName: string
): Promise<IssuedCredential | { error: string }> {
  const check = await requireTeamRole(['admin', 'manager'])
  if ('error' in check) return check

  const email = loginId.trim().toLowerCase()
  if (!email) return { error: "Enter the contact's email address." }
  if (!EMAIL_PATTERN.test(email)) return { error: 'That doesn’t look like a valid email address.' }
  if (!contactName.trim()) return { error: "Give this login the contact's name." }

  const supabase = createSupabaseServerClient()
  const password = generateTempPassword()
  const passwordHash = await hashPassword(password)

  const { error } = await supabase
    .from('client_logins')
    .insert({
      client_id: clientId,
      contact_name: contactName.trim(),
      login_id: email,
      password_hash: passwordHash,
      must_change_password: true,
      created_by: check.id,
    })

  if (error) {
    if (error.code === '23505') return { error: 'That email already has a portal login.' }
    return { error: error.message }
  }

  const { data: client } = await supabase.from('clients').select('name').eq('id', clientId).maybeSingle()
  const sent = await sendClientLoginCredentialsEmail({
    contactName: contactName.trim(),
    clientName: client?.name ?? 'your account',
    loginEmail: email,
    password,
    kind: 'created',
  })

  revalidatePath(`/dashboard/clients/${clientId}`)
  return { password, emailed: sent.ok }
}

/** Resets one login's password — the other logins on this client are untouched. */
export async function resetClientLoginPassword(
  clientLoginId: string
): Promise<IssuedCredential | { error: string }> {
  const check = await requireTeamRole(['admin', 'manager'])
  if ('error' in check) return check

  const supabase = createSupabaseServerClient()
  const password = generateTempPassword()
  const passwordHash = await hashPassword(password)

  const { data, error } = await supabase
    .from('client_logins')
    .update({ password_hash: passwordHash, must_change_password: true })
    .eq('id', clientLoginId)
    .select('client_id, contact_name, login_id, clients(name)')
    .single()

  if (error) return { error: error.message }

  // A login issued before migration 049 has a slug, not an address, so
  // there's nowhere to send the new password — the on-screen reveal is
  // the only channel for those until they're reissued against an email.
  const sent = EMAIL_PATTERN.test(data.login_id)
    ? await sendClientLoginCredentialsEmail({
        contactName: data.contact_name,
        clientName: (data.clients as any)?.name ?? 'your account',
        loginEmail: data.login_id,
        password,
        kind: 'reset',
      })
    : { ok: false }

  revalidatePath(`/dashboard/clients/${data.client_id}`)
  return { password, emailed: sent.ok }
}

/** Deactivates one login — it can no longer sign in, but its history (past comments/tickets) is untouched. */
export async function revokeClientLogin(clientLoginId: string): Promise<{ ok: true } | { error: string }> {
  const check = await requireTeamRole(['admin', 'manager'])
  if ('error' in check) return check

  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('client_logins')
    .update({ is_active: false })
    .eq('id', clientLoginId)
    .select('client_id')
    .single()

  if (error) return { error: error.message }
  revalidatePath(`/dashboard/clients/${data.client_id}`)
  return { ok: true }
}
