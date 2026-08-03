import { Resend } from 'resend'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { formatTicketRef } from '@/lib/utils'
import type { TicketEmailRecipient } from '@/lib/tickets/contacts'

const FROM = `${process.env.RESEND_FROM_NAME || 'NuAIg Aligned'} <${process.env.RESEND_FROM_EMAIL || 'noreply@nuaig.com'}>`

function portalUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${base}${path}`
}

// Constructed lazily, per call, so a missing RESEND_API_KEY never crashes
// module load (or the Next.js build's page-data-collection step) — it just
// means email sending quietly no-ops until the key is filled in.
let cachedResend: Resend | null | undefined

function getResend(): Resend | null {
  if (cachedResend !== undefined) return cachedResend
  cachedResend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
  return cachedResend
}

async function sendEmail(payload: Parameters<Resend['emails']['send']>[0]): Promise<{ ok: boolean; error?: string }> {
  const client = getResend()
  if (!client) {
    console.warn('[email] RESEND_API_KEY not set — skipping send:', (payload as any).subject)
    return { ok: false, error: 'not_configured' }
  }
  const { error } = await client.emails.send(payload)
  if (error) {
    console.error('[email] send failed:', error)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

type TicketEmailKind = 'confirmation' | 'reply' | 'resolved' | 'closed'

// Guards confirmation/resolved/closed against a double-fire (a double-click,
// a retried Server Action) — reply is deliberately excluded at the call
// sites below, since two distinct replies close together are legitimate.
async function wasRecentlySent(ticketId: string, kind: TicketEmailKind, withinMinutes: number): Promise<boolean> {
  const supabase = createServiceRoleClient()
  const since = new Date(Date.now() - withinMinutes * 60_000).toISOString()
  const { data } = await supabase
    .from('ticket_emails')
    .select('id')
    .eq('ticket_id', ticketId)
    .eq('kind', kind)
    .in('status', ['sent', 'partial'])
    .gte('created_at', since)
    .limit(1)
  return (data?.length ?? 0) > 0
}

async function logTicketEmail(
  ticketId: string,
  kind: TicketEmailKind,
  results: { email: string; ok: boolean; error?: string }[]
) {
  const failures = results.filter(r => !r.ok)
  const status = failures.length === 0 ? 'sent' : failures.length === results.length ? 'failed' : 'partial'
  const errorMessage = failures.length > 0 ? failures.map(f => `${f.email}: ${f.error}`).join('; ') : null

  const supabase = createServiceRoleClient()
  await supabase.from('ticket_emails').insert({
    ticket_id: ticketId,
    kind,
    recipient_emails: results.map(r => r.email),
    status,
    error_message: errorMessage,
  })
}

/**
 * Sends one personalized email per recipient (never a single shared
 * multi-`to` send, so each contact is greeted by name), then logs the
 * attempt to ticket_emails (migration 041) — but only when a real send was
 * attempted. If RESEND_API_KEY is unset, this is a pure, silent no-op: no
 * DB round trip, no log row, no idempotency check, exactly like before
 * (CLAUDE.md rule 11) — sending just starts working the moment the key is
 * set, with nothing else to flip.
 */
async function sendTicketEventEmails({
  ticketId,
  kind,
  recipients,
  idempotent,
  buildEmail,
}: {
  ticketId: string
  kind: TicketEmailKind
  recipients: TicketEmailRecipient[]
  idempotent: boolean
  buildEmail: (r: TicketEmailRecipient) => { subject: string; html: string }
}) {
  if (recipients.length === 0) return
  if (!getResend()) {
    console.warn(`[email] RESEND_API_KEY not set — skipping ${kind} email for ticket ${ticketId}`)
    return
  }
  if (idempotent && (await wasRecentlySent(ticketId, kind, 5))) return

  const results = await Promise.all(recipients.map(async r => {
    const { subject, html } = buildEmail(r)
    const res = await sendEmail({ from: FROM, to: r.email, subject, html })
    return { email: r.email, ...res }
  }))

  await logTicketEmail(ticketId, kind, results)
}

// ── Ticket: confirmation to the client's contacts on creation ──
// Recipients here are the effective contact list plus, per product
// decision, a copy to the client's assigned Manager.
export async function sendTicketConfirmationEmail({
  recipients,
  ticketId,
  refNumber,
  title,
  raisedByName,
  raisedByRole,
  clientCode,
}: {
  recipients: TicketEmailRecipient[]
  ticketId: string
  refNumber: number
  title: string
  raisedByName: string
  raisedByRole: 'client' | 'team'
  clientCode?: string
}) {
  const url = portalUrl(`/portal/tickets/${ticketId}`)
  const ref = formatTicketRef(refNumber, clientCode)
  const intro = raisedByRole === 'client'
    ? `Thanks — ${ref} has been logged and routed to the right person.`
    : `${raisedByName} at NuAIg has logged a new ticket for you — ${ref} has been routed to the right person.`

  await sendTicketEventEmails({
    ticketId, kind: 'confirmation', recipients, idempotent: true,
    buildEmail: r => ({
      subject: `Ticket received — ${ref}`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
          <p style="font-size: 13px; color: #888; margin-bottom: 24px;">NuAIg · Aligned</p>
          <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">We've got your ticket</h1>
          <p style="font-size: 15px; color: #444; margin-bottom: 16px;">
            Hi ${r.name}, ${intro}
          </p>
          <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
            <p style="font-size: 15px; font-weight: 500; color: #7c2d12; margin: 0;">${title}</p>
          </div>
          <a href="${url}" style="display: inline-block; background: #ea580c; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 500;">
            View ticket →
          </a>
        </div>
      `,
    }),
  })
}

// ── Ticket: a team member replied ─────────────────────────────
// Not idempotency-guarded — two distinct replies close together (each with
// its own body) are legitimate, not a double-fire.
export async function sendTicketReplyEmail({
  recipients,
  ticketId,
  refNumber,
  title,
  replyBody,
  actorName,
  clientCode,
}: {
  recipients: TicketEmailRecipient[]
  ticketId: string
  refNumber: number
  title: string
  replyBody: string
  actorName: string
  clientCode?: string
}) {
  const url = portalUrl(`/portal/tickets/${ticketId}`)
  const ref = formatTicketRef(refNumber, clientCode)

  await sendTicketEventEmails({
    ticketId, kind: 'reply', recipients, idempotent: false,
    buildEmail: r => ({
      subject: `New reply on ${ref} — ${title}`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
          <p style="font-size: 13px; color: #888; margin-bottom: 24px;">NuAIg · Aligned</p>
          <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">${actorName} replied</h1>
          <p style="font-size: 14px; color: #444; margin-bottom: 4px;">Hi ${r.name},</p>
          <p style="font-size: 13px; color: #888; margin-bottom: 16px;">${ref} · ${title}</p>
          <div style="background: #f9f9f8; border: 1px solid #eee; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px; white-space: pre-wrap; font-size: 14px; color: #333;">${replyBody}</div>
          <a href="${url}" style="display: inline-block; background: #ea580c; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 500;">
            Reply on the portal →
          </a>
        </div>
      `,
    }),
  })
}

// ── Ticket: resolved ───────────────────────────────────────────
export async function sendTicketResolvedEmail({
  recipients,
  ticketId,
  refNumber,
  title,
  clientCode,
}: {
  recipients: TicketEmailRecipient[]
  ticketId: string
  refNumber: number
  title: string
  clientCode?: string
}) {
  const url = portalUrl(`/portal/tickets/${ticketId}`)
  const ref = formatTicketRef(refNumber, clientCode)

  await sendTicketEventEmails({
    ticketId, kind: 'resolved', recipients, idempotent: true,
    buildEmail: r => ({
      subject: `Resolved — ${ref}`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
          <p style="font-size: 13px; color: #888; margin-bottom: 24px;">NuAIg · Aligned</p>
          <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">Marked as resolved</h1>
          <p style="font-size: 14px; color: #444; margin-bottom: 16px;">Hi ${r.name},</p>
          <div style="background: #eaf3de; border: 1px solid #b7d99a; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
            <p style="font-size: 12px; color: #3b6d11; margin: 0 0 4px; font-weight: 600; text-transform: uppercase;">${ref}</p>
            <p style="font-size: 15px; font-weight: 500; color: #1a1918; margin: 0;">${title}</p>
          </div>
          <p style="font-size: 13px; color: #666; margin-bottom: 16px;">If this doesn't look resolved to you, just reply on the portal to reopen the conversation.</p>
          <a href="${url}" style="display: inline-block; background: #ea580c; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 500;">
            View ticket →
          </a>
        </div>
      `,
    }),
  })
}

// ── Ticket: closed without ever being resolved ─────────────────
// Only fired when a ticket jumps straight to `closed` without passing
// through `resolved` first (sync_ticket_status_timestamps, migration 006,
// sets resolved_at/closed_at independently, so this path is possible) — if
// it went through resolved first, the client already got that email and a
// second one for the same ticket would just be noise. See the caller in
// lib/tickets/team-actions.ts.
export async function sendTicketClosedEmail({
  recipients,
  ticketId,
  refNumber,
  title,
  clientCode,
}: {
  recipients: TicketEmailRecipient[]
  ticketId: string
  refNumber: number
  title: string
  clientCode?: string
}) {
  const url = portalUrl(`/portal/tickets/${ticketId}`)
  const ref = formatTicketRef(refNumber, clientCode)

  await sendTicketEventEmails({
    ticketId, kind: 'closed', recipients, idempotent: true,
    buildEmail: r => ({
      subject: `Closed — ${ref}`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
          <p style="font-size: 13px; color: #888; margin-bottom: 24px;">NuAIg · Aligned</p>
          <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">Ticket closed</h1>
          <p style="font-size: 14px; color: #444; margin-bottom: 16px;">Hi ${r.name},</p>
          <div style="background: #f1efe8; border: 1px solid #ddd8c8; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
            <p style="font-size: 12px; color: #5f5e5a; margin: 0 0 4px; font-weight: 600; text-transform: uppercase;">${ref}</p>
            <p style="font-size: 15px; font-weight: 500; color: #1a1918; margin: 0;">${title}</p>
          </div>
          <p style="font-size: 13px; color: #666; margin-bottom: 16px;">This ticket has been closed. If you have more to add, just reply on the portal to reopen it.</p>
          <a href="${url}" style="display: inline-block; background: #ea580c; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 500;">
            View ticket →
          </a>
        </div>
      `,
    }),
  })
}
