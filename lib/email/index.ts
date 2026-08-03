import { Resend } from 'resend'
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

async function sendEmail(payload: Parameters<Resend['emails']['send']>[0]) {
  const client = getResend()
  if (!client) {
    console.warn('[email] RESEND_API_KEY not set — skipping send:', (payload as any).subject)
    return
  }
  await client.emails.send(payload)
}

// ── Ticket: confirmation to the client's contacts on creation ──
// One personalized email per recipient (not a single multi-`to` send) so
// each one is greeted by name — recipients here are the effective contact
// list plus, per product decision, a copy to the client's assigned Manager.
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
  if (recipients.length === 0) return
  const url = portalUrl(`/portal/tickets/${ticketId}`)
  const ref = formatTicketRef(refNumber, clientCode)
  const intro = raisedByRole === 'client'
    ? `Thanks — ${ref} has been logged and routed to the right person.`
    : `${raisedByName} at NuAIg has logged a new ticket for you — ${ref} has been routed to the right person.`

  await Promise.all(recipients.map(r => sendEmail({
    from: FROM,
    to: r.email,
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
  })))
}

// ── Ticket: a team member replied ─────────────────────────────
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
  if (recipients.length === 0) return
  const url = portalUrl(`/portal/tickets/${ticketId}`)
  const ref = formatTicketRef(refNumber, clientCode)

  await Promise.all(recipients.map(r => sendEmail({
    from: FROM,
    to: r.email,
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
  })))
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
  if (recipients.length === 0) return
  const url = portalUrl(`/portal/tickets/${ticketId}`)
  const ref = formatTicketRef(refNumber, clientCode)

  await Promise.all(recipients.map(r => sendEmail({
    from: FROM,
    to: r.email,
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
  })))
}
