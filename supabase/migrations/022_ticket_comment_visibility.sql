-- ============================================================
-- Aligned — Migration 022
-- Internal notes vs client-visible replies
--
-- Team comments on a ticket are internal by default — the client
-- portal never shows them unless a team member explicitly marks a
-- comment as a reply to the client. This is the standard support-
-- tool pattern (Zendesk/Intercom-style "internal note" vs "public
-- reply"), made explicit here as its own column rather than
-- overloading the existing @-mention system, so the rule is a
-- simple boolean check anywhere it's needed instead of "does this
-- comment happen to mention a magic client sentinel."
--
-- Client-authored comments (created_by_client_name is set) don't
-- need this flag to be true to be visible to that same client —
-- the portal query treats "authored by the client" and
-- "visible_to_client = true" as two separate ways in, both handled
-- in application code (app/portal/(app)/tickets/[id]/page.tsx),
-- same as everywhere else the portal bypasses RLS and enforces
-- scoping itself.
-- ============================================================

alter table ticket_comments
  add column if not exists visible_to_client boolean not null default false;

create index if not exists idx_ticket_comments_visible_to_client
  on ticket_comments(ticket_id, visible_to_client);
