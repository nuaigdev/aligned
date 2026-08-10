-- ============================================================
-- NuAIg Assist — Migration 046
-- Managers can create clients
--
-- Migration 025 drew the line at "only admins add clients; admins
-- and managers add projects" — that first half is now a confirmed
-- product decision to loosen: a manager can already create a project
-- (and gets auto-added to it, along with the client's assigned
-- Manager, as of migration 042's era of changes), so gating client
-- creation one rung higher than that was just inconsistent. Mirrors
-- projects_insert_admin_or_manager exactly.
-- ============================================================

drop policy if exists "clients_insert_admin_only" on clients;
drop policy if exists "clients_insert_admin_or_manager" on clients;
create policy "clients_insert_admin_or_manager" on clients
  for insert to authenticated
  with check (coalesce((select role in ('admin', 'manager') from team_members where id = auth.uid()), false));
