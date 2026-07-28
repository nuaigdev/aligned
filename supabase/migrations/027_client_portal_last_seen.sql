-- ============================================================
-- Aligned — Migration 027
-- Client portal "new activity" indicator
--
-- The client login is one shared credential per company, so there's
-- no individual to mark things "read" for (see CLAUDE.md's
-- Notifications section) — but a single last-visit timestamp per
-- client is enough to drive a simple unread-activity blip in the
-- portal header: compare this against the latest team-side ticket
-- activity for that client.
-- ============================================================

alter table clients add column if not exists last_portal_seen_at timestamptz;
