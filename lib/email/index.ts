import { Resend } from 'resend'
import { getSignUrl, formatTicketRef } from '@/lib/utils'

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

// ── Send approval link email ──────────────────────────────────
export async function sendApprovalEmail({
  recipientName,
  recipientEmail,
  approvalToken,
  projectName,
  clientName,
  targetType,
  targetTitle,
}: {
  recipientName: string
  recipientEmail: string
  approvalToken: string
  projectName: string
  clientName: string
  targetType: 'decision' | 'milestone'
  targetTitle: string
}) {
  const signUrl = getSignUrl(approvalToken)
  const typeLabel = targetType === 'decision' ? 'decision' : 'milestone'

  await sendEmail({
    from: FROM,
    to: recipientEmail,
    subject: `Your sign-off is needed — ${projectName}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
        <p style="font-size: 13px; color: #888; margin-bottom: 24px;">NuAIg · Aligned</p>

        <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">
          Your sign-off is needed
        </h1>

        <p style="font-size: 15px; color: #444; margin-bottom: 24px;">
          Hi ${recipientName}, a ${typeLabel} on the <strong>${projectName}</strong> project requires your formal approval.
        </p>

        <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
          <p style="font-size: 12px; color: #ea580c; margin: 0 0 4px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">
            ${typeLabel === 'decision' ? 'Decision' : 'Milestone'}
          </p>
          <p style="font-size: 15px; font-weight: 500; color: #7c2d12; margin: 0;">
            ${targetTitle}
          </p>
        </div>

        <a href="${signUrl}" style="display: inline-block; background: #ea580c; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 500; margin-bottom: 24px;">
          Review &amp; sign →
        </a>

        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />

        <p style="font-size: 12px; color: #999; line-height: 1.6;">
          This approval link was sent to <strong>${recipientEmail}</strong> on behalf of the ${projectName} project.
          By signing, you confirm that you are authorised to approve on behalf of ${clientName}.
          This action will be permanently logged against your name and email.
        </p>

        <p style="font-size: 12px; color: #bbb; margin-top: 8px;">
          If you did not expect this email, please ignore it or reply to let us know.
        </p>
      </div>
    `,
  })
}

// ── Send nudge reminder ───────────────────────────────────────
export async function sendNudgeEmail({
  recipientName,
  recipientEmail,
  approvalToken,
  projectName,
  targetTitle,
  nudgeCount,
}: {
  recipientName: string
  recipientEmail: string
  approvalToken: string
  projectName: string
  targetTitle: string
  nudgeCount: number
}) {
  const signUrl = getSignUrl(approvalToken)

  await sendEmail({
    from: FROM,
    to: recipientEmail,
    subject: `Reminder: sign-off still needed — ${projectName}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
        <p style="font-size: 13px; color: #888; margin-bottom: 24px;">NuAIg · Aligned</p>

        <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">
          Friendly reminder
        </h1>

        <p style="font-size: 15px; color: #444; margin-bottom: 16px;">
          Hi ${recipientName}, we're still waiting for your sign-off on the following item for <strong>${projectName}</strong>.
        </p>

        <div style="background: #fff8ec; border: 1px solid #fac775; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
          <p style="font-size: 15px; font-weight: 500; color: #412402; margin: 0;">
            ${targetTitle}
          </p>
        </div>

        <a href="${signUrl}" style="display: inline-block; background: #ea580c; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 500; margin-bottom: 24px;">
          Review &amp; sign →
        </a>

        <p style="font-size: 12px; color: #bbb; margin-top: 16px;">
          Reminder ${nudgeCount} of 3 · Sent to ${recipientEmail}
        </p>
      </div>
    `,
  })
}

// ── Ticket: confirmation to the client's contacts on creation ──
export async function sendTicketConfirmationEmail({
  toEmails,
  ticketId,
  refNumber,
  title,
  raisedByName,
}: {
  toEmails: string[]
  ticketId: string
  refNumber: number
  title: string
  raisedByName: string
}) {
  if (toEmails.length === 0) return
  const url = portalUrl(`/portal/tickets/${ticketId}`)

  await sendEmail({
    from: FROM,
    to: toEmails,
    subject: `Ticket received — ${formatTicketRef(refNumber)}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
        <p style="font-size: 13px; color: #888; margin-bottom: 24px;">NuAIg · Aligned</p>
        <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">We've got your ticket</h1>
        <p style="font-size: 15px; color: #444; margin-bottom: 16px;">
          Thanks ${raisedByName} — ${formatTicketRef(refNumber)} has been logged and routed to the right person.
        </p>
        <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
          <p style="font-size: 15px; font-weight: 500; color: #7c2d12; margin: 0;">${title}</p>
        </div>
        <a href="${url}" style="display: inline-block; background: #ea580c; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 500;">
          View ticket →
        </a>
      </div>
    `,
  })
}

// ── Ticket: a team member replied ─────────────────────────────
export async function sendTicketReplyEmail({
  toEmails,
  ticketId,
  refNumber,
  title,
  replyBody,
  actorName,
}: {
  toEmails: string[]
  ticketId: string
  refNumber: number
  title: string
  replyBody: string
  actorName: string
}) {
  if (toEmails.length === 0) return
  const url = portalUrl(`/portal/tickets/${ticketId}`)

  await sendEmail({
    from: FROM,
    to: toEmails,
    subject: `New reply on ${formatTicketRef(refNumber)} — ${title}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
        <p style="font-size: 13px; color: #888; margin-bottom: 24px;">NuAIg · Aligned</p>
        <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">${actorName} replied</h1>
        <p style="font-size: 13px; color: #888; margin-bottom: 16px;">${formatTicketRef(refNumber)} · ${title}</p>
        <div style="background: #f9f9f8; border: 1px solid #eee; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px; white-space: pre-wrap; font-size: 14px; color: #333;">${replyBody}</div>
        <a href="${url}" style="display: inline-block; background: #ea580c; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 500;">
          Reply on the portal →
        </a>
      </div>
    `,
  })
}

// ── Ticket: resolved ───────────────────────────────────────────
export async function sendTicketResolvedEmail({
  toEmails,
  ticketId,
  refNumber,
  title,
}: {
  toEmails: string[]
  ticketId: string
  refNumber: number
  title: string
}) {
  if (toEmails.length === 0) return
  const url = portalUrl(`/portal/tickets/${ticketId}`)

  await sendEmail({
    from: FROM,
    to: toEmails,
    subject: `Resolved — ${formatTicketRef(refNumber)}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
        <p style="font-size: 13px; color: #888; margin-bottom: 24px;">NuAIg · Aligned</p>
        <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">Marked as resolved</h1>
        <div style="background: #eaf3de; border: 1px solid #b7d99a; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
          <p style="font-size: 12px; color: #3b6d11; margin: 0 0 4px; font-weight: 600; text-transform: uppercase;">${formatTicketRef(refNumber)}</p>
          <p style="font-size: 15px; font-weight: 500; color: #1a1918; margin: 0;">${title}</p>
        </div>
        <p style="font-size: 13px; color: #666; margin-bottom: 16px;">If this doesn't look resolved to you, just reply on the portal to reopen the conversation.</p>
        <a href="${url}" style="display: inline-block; background: #ea580c; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 500;">
          View ticket →
        </a>
      </div>
    `,
  })
}

// ── Notify team of a concern raised ──────────────────────────
export async function sendConcernNotification({
  projectName,
  raisedByName,
  raisedByEmail,
  targetTitle,
  concernText,
  teamEmail,
}: {
  projectName: string
  raisedByName: string
  raisedByEmail: string
  targetTitle: string
  concernText: string
  teamEmail: string
}) {
  await sendEmail({
    from: FROM,
    to: teamEmail,
    subject: `Concern raised on ${projectName} — review needed`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
        <p style="font-size: 13px; color: #888; margin-bottom: 24px;">NuAIg · Aligned</p>

        <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">
          Concern raised
        </h1>

        <p style="font-size: 15px; color: #444; margin-bottom: 16px;">
          <strong>${raisedByName}</strong> (${raisedByEmail}) has raised a concern on <strong>${projectName}</strong> before signing.
        </p>

        <div style="background: #fff8ec; border: 1px solid #fac775; border-radius: 8px; padding: 16px 20px; margin-bottom: 16px;">
          <p style="font-size: 12px; color: #854f0b; margin: 0 0 6px; font-weight: 600;">Item</p>
          <p style="font-size: 14px; font-weight: 500; color: #412402; margin: 0 0 12px;">${targetTitle}</p>
          <p style="font-size: 12px; color: #854f0b; margin: 0 0 6px; font-weight: 600;">Concern</p>
          <p style="font-size: 14px; color: #412402; margin: 0;">${concernText}</p>
        </div>

        <p style="font-size: 12px; color: #999;">
          Log in to Aligned to review and respond.
        </p>
      </div>
    `,
  })
}
