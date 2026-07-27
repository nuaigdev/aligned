// ============================================================
// Aligned — Core Types
// These mirror the Supabase database schema exactly
// ============================================================

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

// ============================================================
// DATABASE ROW TYPES
// ============================================================

export interface Client {
  id: string
  name: string
  slug: string
  created_at: string
  updated_at: string
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
  portal_token: string
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
  project_id: string
  milestone_id: string | null
  decision_id: string | null
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

export interface TeamMember {
  id: string
  name: string
  email: string
  role: 'admin' | 'member'
  created_at: string
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
}

// ============================================================
// PORTAL TYPES (client-facing, read-only)
// Strips sensitive internal fields
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
