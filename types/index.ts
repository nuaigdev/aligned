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

export type MilestoneType = 'client_gate' | 'internal' | 'informational'

export type MilestoneStatus =
  | 'not_started'
  | 'in_progress'
  | 'awaiting_signoff'
  | 'completed'
  | 'reopened'

export type DecisionStatus = 'draft' | 'pending_approval' | 'approved' | 'amended'

export type ApprovalTargetType = 'decision' | 'milestone'

export type ApprovalStatus = 'pending' | 'signed' | 'expired' | 'superseded'

export type DocumentSharedBy = 'team' | 'client'

// Richer than a simple 3-lane board on purpose — this is client-
// facing support, not internal work tracking.
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TicketBlockedOn = 'client' | 'team'

export type NotificationType =
  | 'ticket_assigned'
  | 'ticket_status_changed'
  | 'ticket_commented'
  | 'ticket_mentioned'
  | 'ticket_updated'

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

export interface Milestone {
  id: string
  project_id: string
  title: string
  description: string | null
  type: MilestoneType
  status: MilestoneStatus
  phase: string | null
  due_date: string | null
  completed_at: string | null
  iteration: number
  parent_id: string | null
  delay_owner: 'client' | 'team' | null
  delay_reason: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Decision {
  id: string
  project_id: string
  ref_number: number
  title: string
  description: string | null
  status: DecisionStatus
  meeting_ref: string | null
  signed_at: string | null
  signed_by_name: string | null
  signed_by_email: string | null
  parent_id: string | null
  created_at: string
  updated_at: string
}

export interface ApprovalLink {
  id: string
  project_id: string
  target_type: ApprovalTargetType
  target_id: string
  token: string
  recipient_name: string
  recipient_email: string
  status: ApprovalStatus
  signed_at: string | null
  concern_text: string | null
  concern_raised_at: string | null
  nudge_count: number
  last_nudge_at: string | null
  expires_at: string | null
  created_at: string
}

export interface Document {
  id: string
  project_id: string | null
  milestone_id: string | null
  decision_id: string | null
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

export interface MilestoneSignoff {
  id: string
  milestone_id: string
  approval_link_id: string | null
  signed_by_name: string
  signed_by_email: string
  signed_at: string
  ip_address: string | null
  user_agent: string | null
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
  status: TicketStatus
  priority: TicketPriority
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
// NOTIFICATIONS (team-side only — clients get email instead)
// ============================================================

export interface AppNotification {
  id: string
  team_member_id: string
  type: NotificationType
  title: string
  body: string | null
  ticket_id: string | null
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

export interface ProjectWithStats extends ProjectWithClient {
  total_milestones: number
  completed_milestones: number
  pending_approvals: number
  total_decisions: number
  signed_decisions: number
  days_delayed_client: number
  days_delayed_team: number
}

export interface MilestoneWithSignoffs extends Milestone {
  signoffs: MilestoneSignoff[]
  approval_links: ApprovalLink[]
  documents: Document[]
}

export interface DecisionWithApprovals extends Decision {
  approval_links: ApprovalLink[]
  documents: Document[]
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

export interface CreateMilestoneInput {
  project_id: string
  title: string
  description?: string
  type: MilestoneType
  phase?: string
  due_date?: string
  sort_order?: number
}

export interface CreateDecisionInput {
  project_id: string
  title: string
  description?: string
  meeting_ref?: string
}

export interface SendApprovalInput {
  project_id: string
  target_type: ApprovalTargetType
  target_id: string
  recipients: Array<{ name: string; email: string }>
}

export interface SignApprovalInput {
  token: string
  concern_text?: string
}

export interface UploadDocumentInput {
  project_id: string
  name: string
  phase?: string
  shared_by: DocumentSharedBy
  milestone_id?: string
  decision_id?: string
  ticket_id?: string
}

export interface CreateTicketInput {
  client_id: string
  project_id?: string
  title: string
  description?: string
  category?: string
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

export interface PortalProject {
  id: string
  name: string
  status: ProjectStatus
  started_at: string | null
  planned_end_at: string | null
  client_name: string
  team_name: string   // NuAIg
  progress_pct: number
}

export interface PortalMilestone {
  id: string
  title: string
  description: string | null
  type: MilestoneType
  status: MilestoneStatus
  phase: string | null
  due_date: string | null
  completed_at: string | null
  iteration: number
  delay_owner: 'client' | 'team' | null
  // Approval info — shows who signed, not the token
  signoff?: {
    signed_by_name: string
    signed_by_email: string
    signed_at: string
  }
  // Pending approval — shows email it was sent to (masked)
  pending_approval_sent_to?: string  // e.g. "s***@nexus.com"
}

export interface PortalDecision {
  id: string
  ref_number: number
  title: string
  description: string | null
  status: DecisionStatus
  meeting_ref: string | null
  signed_at: string | null
  signed_by_name: string | null
  created_at: string
  // Pending recipients (masked emails only)
  pending_sent_to?: string[]
}

export interface PortalDocument {
  id: string
  name: string
  file_type: string | null
  file_size_bytes: number | null
  phase: string | null
  shared_by: DocumentSharedBy
  shared_by_label: string  // "By NuAIg" or "By [ClientName]"
  created_at: string
  download_url?: string   // signed URL, short-lived
}

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
