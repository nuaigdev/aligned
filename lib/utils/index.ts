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

// ── File size formatting ──────────────────────────────────────
export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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

// ── Ticket status/priority pill config ────────────────────────
export const TICKET_STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  open:        { label: 'Open',        bg: 'var(--info-bg)',    color: 'var(--info-text)' },
  in_progress: { label: 'In progress', bg: 'var(--warning-bg)', color: 'var(--warning-text)' },
  resolved:    { label: 'Resolved',    bg: 'var(--success-bg)', color: 'var(--success-text)' },
  closed:      { label: 'Closed',      bg: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' },
}

export const TICKET_PRIORITY_COLOR: Record<string, string> = {
  low: '#888780',
  medium: '#0C447C',
  high: '#633806',
  urgent: '#A32D2D',
}

// ── Ticket ref formatting ──────────────────────────────────────
// A client's short code is derived from their (already-unique) slug
// rather than a separate column — collisions between two clients'
// codes are harmless because ref_number itself comes from one global
// sequence (ticket_ref_seq), so the full string is always unique;
// the code is purely a traceability aid ("which client is this?").
export function ticketClientCode(slug: string): string {
  return slug.replace(/-/g, '').slice(0, 4).toUpperCase()
}

export function formatTicketRef(refNumber: number, clientCode?: string): string {
  const num = String(refNumber).padStart(4, '0')
  return clientCode ? `${clientCode}-${num}` : `#T-${num}`
}

// ── Client slug ────────────────────────────────────────────────
export function toSlug(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

// ── Portal login URL ───────────────────────────────────────────
// The client login now lives at the root of the app, not under /portal.
export function getPortalLoginUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return base
}

// ── Regex escaping ────────────────────────────────────────────
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
