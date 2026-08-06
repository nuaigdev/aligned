// ============================================================
// Aligned — Core Types
// These mirror the Supabase database schema exactly
// ============================================================

export type TeamRole = 'admin' | 'manager' | 'member'

export type ProjectStatus =
  | 'active'
  | 'on_hold'
  | 'awaiting_client'
  | 'awaiting_team'
  | 'completed'
  | 'archived'

export type DocumentSharedBy = 'team' | 'client'

// Richer than a simple 3-lane board on purpose — this is client-
// facing support, not internal work tracking.
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'
// 'internal' tickets belong to a client_id like any other ticket, but are
// never visible on that client's portal — raised by the team, about a
// client, kept in-house. See migration 033.
export type TicketType = 'client' | 'internal'
export type TicketBlockedOn = 'client' | 'team'

export type NotificationType =
  | 'ticket_assigned'
  | 'ticket_status_changed'
  | 'ticket_commented'
  | 'ticket_mentioned'
  | 'ticket_updated'
  | 'project_assigned'

export type ClientNotificationType =
  | 'ticket_replied'
  | 'ticket_resolved'
  | 'ticket_closed'

// ============================================================
// DATABASE ROW TYPES
// ============================================================

export interface TeamMember {
  id: string
  name: string
  email: string
  role: TeamRole
  manager_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  // Joined
  manager?: TeamMember
  reports?: TeamMember[]
}

/**
 * Client-facing row shape — deliberately excludes password_hash.
 * Anything that fetches a client for display in a component (team
 * or portal) should select this shape, never the raw DB row.
 */
export interface Client {
  id: string
  name: string
  slug: string
  manager_id: string | null
  login_id: string | null
  must_change_password: boolean
  last_login_at: string | null
  last_portal_seen_at: string | null
  created_at: string
  updated_at: string
  // Joined
  manager?: TeamMember
}

/**
 * Only ever read/written from server-side auth code
 * (lib/auth/client-session.ts, the credential-issuing action on the
 * client detail page). Never pass this to a client component.
 */
export interface ClientCredentials {
  id: string
  login_id: string | null
  password_hash: string | null
  must_change_password: boolean
}

export interface ClientContact {
  id: string
  client_id: string
  project_id: string | null   // null = default for all projects
  name: string
  email: string
  is_active: boolean
  removed_at: string | null
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  client_id: string
  name: string
  description: string | null
  status: ProjectStatus
  started_at: string | null
  planned_end_at: string | null
  created_at: string
  updated_at: string
}

export interface ProjectMember {
  id: string
  project_id: string
  team_member_id: string
  added_by: string | null
  added_at: string
  // Joined
  member?: TeamMember
}

export interface Document {
  id: string
  project_id: string | null
  ticket_id: string | null
  name: string
  storage_path: string
  file_type: string | null
  file_size_bytes: number | null
  phase: string | null
  shared_by: DocumentSharedBy
  uploaded_by: string | null
  created_at: string
}

// ============================================================
// TICKETS
// ============================================================

/**
 * A ticket is authored by exactly one of a team member OR a client
 * (dual authorship, enforced by a DB CHECK constraint) — the client
 * side is a free-text "posting as" name since client login is one
 * shared credential per company, not per contact.
 */
export interface Ticket {
  id: string
  ref_number: number
  client_id: string
  project_id: string | null
  title: string
  description: string | null
  category: string
  ticket_type: TicketType
  status: TicketStatus
  priority: TicketPriority
  // Team-only planning priority, independent of `priority` — see
  // migration 042. Never shown to the client, never client-editable.
  internal_priority: TicketPriority | null
  blocked_on: TicketBlockedOn | null
  position: number
  due_date: string | null
  resolved_at: string | null
  closed_at: string | null
  reopened_count: number
  created_by_team_member_id: string | null
  created_by_client_name: string | null
  created_at: string
  updated_at: string
  // Joined
  client?: Client
  project?: Project
  creator?: TeamMember
  assignees?: TicketAssignee[]
  comment_count?: number
}

export interface TicketAssignee {
  id: string
  ticket_id: string
  team_member_id: string
  assigned_by: string | null
  assigned_at: string
  // Joined
  member?: TeamMember
  assigner?: TeamMember
}

export interface TicketComment {
  id: string
  ticket_id: string
  body: string
  edited_at: string | null
  mentioned_team_member_ids: string[]
  created_by_team_member_id: string | null
  created_by_client_name: string | null
  visible_to_client: boolean
  created_at: string
  updated_at: string
  // Joined
  author?: TeamMember
  mentions?: TeamMember[]
}

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
}

// Kanban lane order, left to right.
export const TICKET_LANES: TicketStatus[] = ['open', 'in_progress', 'resolved', 'closed']

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}

// ============================================================
// NOTIFICATIONS — team side (real Supabase Auth sessions) and
// client side (client_notifications, scoped by client_id since the
// portal login is shared per company — see migration 032)
// ============================================================

export interface AppNotification {
  id: string
  team_member_id: string
  type: NotificationType
  title: string
  body: string | null
  ticket_id: string | null
  link_path: string | null
  is_read: boolean
  created_at: string
}

export interface ClientNotificationRow {
  id: string
  client_id: string
  type: ClientNotificationType
  title: string
  body: string | null
  link_path: string | null
  is_read: boolean
  created_at: string
}

// ============================================================
// APP SETTINGS
// ============================================================

export interface AppSetting<T = unknown> {
  key: string
  value: { value: T }
  updated_at: string
}

// ============================================================
// JOINED / ENRICHED TYPES
// Used in UI components with related data
// ============================================================

export interface ProjectWithClient extends Project {
  client: Client
}

export interface ClientWithProjects extends Client {
  projects: Project[]
  contacts: ClientContact[]
}

// ============================================================
// API / FORM TYPES
// ============================================================

export interface CreateClientInput {
  name: string
  slug: string
  manager_id?: string
}

export interface CreateProjectInput {
  client_id: string
  name: string
  description?: string
  started_at?: string
  planned_end_at?: string
}

export interface UploadDocumentInput {
  project_id: string
  name: string
  phase?: string
  shared_by: DocumentSharedBy
  ticket_id?: string
}

export interface CreateTicketInput {
  client_id: string
  project_id?: string
  title: string
  description?: string
  category?: string
  ticket_type?: TicketType
  priority?: TicketPriority
  due_date?: string
  assignee_ids?: string[]
  // Exactly one of these is filled in by the caller (team page vs portal page)
  created_by_team_member_id?: string
  created_by_client_name?: string
}

export interface CreateTicketCommentInput {
  ticket_id: string
  body: string
  mentioned_team_member_ids?: string[]
  created_by_team_member_id?: string
  created_by_client_name?: string
}

// ============================================================
// PORTAL TYPES (client-facing)
// Strips sensitive internal fields. The portal is session-based
// (client login), not token-based — see lib/auth/client-session.ts.
// ============================================================

export interface PortalTicket {
  id: string
  ref_number: number
  title: string
  description: string | null
  category: string
  status: TicketStatus
  priority: TicketPriority
  blocked_on: TicketBlockedOn | null
  due_date: string | null
  resolved_at: string | null
  created_by_client_name: string | null
  created_at: string
  comment_count?: number
}
