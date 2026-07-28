-- ============================================================
-- Aligned — Migration 026
-- Live ticket comments on the dashboard
--
-- Team members are real Supabase Auth sessions, so unlike the
-- client portal they can use genuine Realtime — this adds
-- ticket_comments to the publication so TicketComments.tsx can
-- subscribe to new rows instead of requiring a page refresh
-- (RLS from migration 010 still governs what each subscriber
-- actually receives).
-- ============================================================

do $$ begin
  alter publication supabase_realtime add table ticket_comments;
exception when duplicate_object then null;
end $$;
