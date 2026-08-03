-- ============================================================
-- Aligned — Migration 040
-- Remove Milestones, Decisions, and Approvals entirely
--
-- The product is Ticketing only now. Milestones/Decisions/the
-- standalone project-level Documents panel had been paused (routes
-- redirecting, code left on disk) since the pivot to Ticketing —
-- this migration is the follow-through: the app code for all three
-- has been deleted outright (not just unreached), so the schema
-- behind them comes out too. This is destructive and not reversible
-- — any existing milestone, decision, sign-off, or approval-link
-- data is permanently gone after this runs.
--
-- What is NOT touched, because tickets and general documents still
-- depend on it:
--   - documents (ticket attachments use it — only milestone_id/
--     decision_id, the two paused-feature-only columns, come off)
--   - notifications.link_path / client_notifications (general
--     infrastructure — ticket_resolved/ticket_replied already use it)
--   - clients, projects, project_members, tickets, ticket_comments,
--     ticket_assignees, client_contacts — untouched
--   - the 'project-documents' storage bucket — untouched
--
-- Drop order matters (FK dependencies): documents' two columns
-- first (they're the only things outside the milestone/decision/
-- approval cluster referencing into it), then milestone_signoffs
-- (references both milestones and approval_links), then decisions
-- (references milestones via milestone_id), then approval_links,
-- then milestones, then the enum types, then the two decision-ref
-- helper functions, which are now orphaned.
-- ============================================================

alter table documents drop column if exists milestone_id;
alter table documents drop column if exists decision_id;

drop table if exists milestone_signoffs;
drop table if exists decisions;
drop table if exists approval_links;
drop table if exists milestones;

drop type if exists milestone_type;
drop type if exists milestone_status;
drop type if exists decision_status;
drop type if exists approval_target_type;
drop type if exists approval_status;

drop function if exists next_decision_ref(uuid);
drop function if exists assign_decision_ref();

-- ============================================================
-- documents RLS — drop the admin/manager "standalone document"
-- policies (migration 029, narrowed to ticket_id is null by
-- migration 038). With the standalone Documents panel gone, no code
-- path ever inserts a document with ticket_id null anymore, so these
-- policies are unreachable dead weight. documents_select_all and the
-- three documents_ticket_attachment_* policies (migration 038) are
-- untouched — ticket attachments keep working exactly as before.
-- ============================================================

drop policy if exists "documents_insert_admin_or_manager" on documents;
drop policy if exists "documents_update_admin_or_manager" on documents;
drop policy if exists "documents_delete_admin_or_manager" on documents;

-- ============================================================
-- Storage — the 'signed-records' bucket was reserved for a signed-
-- record PDF export that was never built (@react-pdf/renderer has
-- been removed from package.json). Nothing ever wrote to it, so it's
-- safe to remove, but Supabase blocks a direct SQL DELETE on
-- storage.buckets ("Direct deletion from storage tables is not
-- allowed. Use the Storage API instead.") — this migration only
-- narrows the read policy below; delete the bucket itself from the
-- Supabase dashboard (Storage → signed-records → delete) or via the
-- Storage API/CLI as a separate manual step.
-- ============================================================

drop policy if exists "team_read_documents" on storage.objects;
create policy "team_read_documents"
  on storage.objects for select to authenticated
  using (bucket_id = 'project-documents');
