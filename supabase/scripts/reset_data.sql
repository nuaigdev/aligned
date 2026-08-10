-- ============================================================
-- NuAIg Assist — Data reset script (NOT a schema migration)
--
-- Wipes all business/demo data and resets the ticket ref_number
-- counter back to 1, while leaving team accounts (team_members, and
-- the underlying auth.users Supabase Auth manages — never touched
-- here) completely alone.
--
-- This intentionally lives outside supabase/migrations/: that folder
-- is schema history, replayed in order to bootstrap a fresh project
-- (see CLAUDE.md's Database setup section) — a one-off data wipe
-- doesn't belong in that numbered sequence. Run this manually, once,
-- in the Supabase SQL editor whenever you want a clean slate.
--
-- Destructive and not reversible. Every client, project, ticket,
-- comment, attachment, and notification is gone after this runs.
-- ============================================================

truncate table
  client_notifications,
  ticket_emails,
  notifications,
  documents,
  ticket_comments,
  ticket_assignees,
  tickets,
  project_members,
  projects,
  client_logins,
  client_contacts,
  clients,
  auth_signup_trigger_errors
restart identity cascade;

-- app_settings is deliberately left alone above — it's live app
-- configuration (e.g. ticket_client_can_set_priority), not demo
-- content; wiping it changes app behavior, not just resets data.
-- Uncomment if you really want that reset too (re-seed via migration
-- 017's INSERT afterward, or re-run migration 017 itself):
-- truncate table app_settings restart identity cascade;

-- tickets.ref_number is generated from a manually-created sequence
-- (ticket_ref_seq, migration 006), not a SERIAL/IDENTITY column, so
-- TRUNCATE ... RESTART IDENTITY above doesn't reach it — that's why
-- a plain truncate never reset the counter. Reset it explicitly.
alter sequence ticket_ref_seq restart with 1;
