-- ============================================================
-- Aligned — Migration 042
-- Ticket internal priority
--
-- `tickets.priority` is the priority as set by whoever raised the
-- ticket — when that's the client (created_by_client_name is set),
-- it's their call and the team no longer gets to silently overwrite
-- it (enforced in updateTicket(), lib/tickets/team-actions.ts, not
-- here — RLS still allows the write since a client-Manager/admin
-- override is a legitimate escape hatch, same pattern as the
-- ticket_type freeze in migration 034). `internal_priority` is a
-- separate, always-team-editable field for the team's own planning
-- use — never shown to the client, never touched by portal code.
-- ============================================================

alter table tickets
  add column if not exists internal_priority ticket_priority;
