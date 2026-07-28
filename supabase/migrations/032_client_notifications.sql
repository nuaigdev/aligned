-- ============================================================
-- Aligned — Migration 032
-- Real client-facing notifications + generic notification links
--
-- notifications.link_path lets a team notification point somewhere
-- other than a ticket (a decision, a milestone) — NotificationBell.tsx
-- prefers it over the ticket_id-derived href when present.
--
-- client_notifications mirrors the team notifications table exactly,
-- scoped by client_id instead of team_member_id — the shared login
-- means there's no individual to have a *personal* read state, but
-- the whole company shares one notification list, same as the whole
-- team currently shares visibility into team_members. Only ever
-- written/read via the service-role client (the client session isn't
-- a Supabase Auth principal — see CLAUDE.md's portal architecture
-- notes), so RLS here is enabled with no policies at all: a deliberate
-- deny-by-default, not an oversight.
-- ============================================================

alter table notifications add column if not exists link_path text;

create table if not exists client_notifications (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text,
  link_path   text,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists idx_client_notifications_client on client_notifications(client_id, created_at desc);

alter table client_notifications enable row level security;
