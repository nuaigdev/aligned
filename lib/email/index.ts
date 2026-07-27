import { Resend } from 'resend'
import { getSignUrl } from '@/lib/utils'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = `${process.env.RESEND_FROM_NAME || 'NuAIg Aligned'} <${process.env.RESEND_FROM_EMAIL || 'noreply@nuaig.com'}>`

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

  await resend.emails.send({
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

        <div style="background: #f5f4ff; border: 1px solid #afa9ec; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
          <p style="font-size: 12px; color: #534ab7; margin: 0 0 4px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">
            ${typeLabel === 'decision' ? 'Decision' : 'Milestone'}
          </p>
          <p style="font-size: 15px; font-weight: 500; color: #26215c; margin: 0;">
            ${targetTitle}
          </p>
        </div>

        <a href="${signUrl}" style="display: inline-block; background: #534ab7; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 500; margin-bottom: 24px;">
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

  await resend.emails.send({
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

        <a href="${signUrl}" style="display: inline-block; background: #534ab7; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 500; margin-bottom: 24px;">
          Review &amp; sign →
        </a>

        <p style="font-size: 12px; color: #bbb; margin-top: 16px;">
          Reminder ${nudgeCount} of 3 · Sent to ${recipientEmail}
        </p>
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
  await resend.emails.send({
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
