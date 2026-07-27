-- ============================================================
-- Aligned — Migration 016
-- Notifications — team side only
--
-- Direct port of Chronos's notifications table + Realtime pattern.
-- Team members get real in-app notifications because they're real
-- Supabase Auth sessions; clients (shared per-company login, no
-- individual session to mark "read" against) get email instead —
-- see lib/email/index.ts and the ticket notification templates.
--
-- Rows are inserted by the acting team member's own session on
-- behalf of the recipient (same model Chronos uses — the actor
-- creates the notification row for someone else), so INSERT is
-- open to any authenticated team member; SELECT/UPDATE are
-- restricted to the recipient's own rows.
-- ============================================================

create table if not exists notifications (
  id             uuid primary key default gen_random_uuid(),
  team_member_id uuid not null references team_members(id) on delete cascade,
  type           text not null,
  title          text not null,
  body           text,
  ticket_id      uuid references tickets(id) on delete cascade,
  is_read        boolean not null default false,
  created_at     timestamptz not null default now()
);

create index if not exists idx_notifications_team_member on notifications(team_member_id, created_at desc);
create index if not exists idx_notifications_ticket      on notifications(ticket_id);

alter table notifications enable row level security;

drop policy if exists "Recipients view own notifications"   on notifications;
drop policy if exists "Team members create notifications"   on notifications;
drop policy if exists "Recipients update own notifications" on notifications;

create policy "Recipients view own notifications"
  on notifications for select
  using (team_member_id = auth.uid());

create policy "Team members create notifications"
  on notifications for insert
  with check (auth.role() = 'authenticated');

create policy "Recipients update own notifications"
  on notifications for update
  using (team_member_id = auth.uid())
  with check (team_member_id = auth.uid());

grant select, insert, update on notifications to authenticated;

do $$ begin
  alter publication supabase_realtime add table notifications;
exception when duplicate_object then null;
end $$;
