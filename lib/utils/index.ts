import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'

// ── Tailwind class merger ─────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Date formatting ───────────────────────────────────────────
export function formatDate(date: string | null | undefined): string {
  if (!date) return '—'
  return format(new Date(date), 'd MMM yyyy')
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return '—'
  return format(new Date(date), 'd MMM yyyy, HH:mm')
}

export function formatRelative(date: string | null | undefined): string {
  if (!date) return '—'
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

// ── Decision ref formatting ───────────────────────────────────
export function formatDecisionRef(refNumber: number): string {
  return `#D-${String(refNumber).padStart(3, '0')}`
}

// ── File size formatting ──────────────────────────────────────
export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Email masking (for portal display) ───────────────────────
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return email
  const masked = local[0] + '***'
  return `${masked}@${domain}`
}

// ── Project progress calculation ─────────────────────────────
export function calculateProgress(
  completed: number,
  total: number
): number {
  if (total === 0) return 0
  return Math.round((completed / total) * 100)
}

// ── Status display helpers ────────────────────────────────────
export const PROJECT_STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  on_hold: 'On hold',
  awaiting_client: 'Awaiting client',
  awaiting_team: 'Awaiting team',
  completed: 'Completed',
  archived: 'Archived',
}

export const MILESTONE_STATUS_LABELS: Record<string, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  awaiting_signoff: 'Awaiting sign-off',
  completed: 'Completed',
  reopened: 'Reopened',
}

export const DECISION_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Pending approval',
  approved: 'Approved',
  amended: 'Amended',
}

// ── Initials from name ────────────────────────────────────────
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// ── Generate portal URL ───────────────────────────────────────
export function getPortalUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${base}/portal/${token}`
}

// ── Generate sign URL ─────────────────────────────────────────
export function getSignUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${base}/sign/${token}`
}
