-- ============================================================
-- Aligned — Migration 044
-- Protect client-uploaded ticket attachments from deletion by
-- lower-privileged team members.
--
-- documents_ticket_attachment_delete (migration 038) gates deletion
-- on can_edit_ticket() alone — any project member. That's fine for
-- attachments the team itself uploaded, but a client's attachment
-- shouldn't be removable by an ordinary teammate: only an admin can
-- (confirmed product decision — not extended to the client's
-- assigned Manager the way other overrides are). The client
-- themselves can still remove their own attachment, but that goes
-- through the portal's service-role Server Action
-- (deletePortalAttachment, lib/tickets/portal-actions.ts), which
-- bypasses RLS entirely per this app's portal architecture (see
-- CLAUDE.md rule 4) — this policy only governs the authenticated
-- team-side client.
-- ============================================================

drop policy if exists "documents_ticket_attachment_delete" on documents;
create policy "documents_ticket_attachment_delete" on documents
  for delete to authenticated
  using (
    ticket_id is not null
    and can_edit_ticket(ticket_id, auth.uid())
    and (
      shared_by <> 'client'
      or coalesce((select role = 'admin' from team_members where id = auth.uid()), false)
    )
  );
