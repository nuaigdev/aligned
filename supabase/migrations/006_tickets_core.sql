-- ============================================================
-- Aligned — Migration 006
-- Tickets — the core table
--
-- Ticketing is the new heart of the app: clients raise tickets,
-- the client's assigned Manager triages them, the Manager routes
-- work to their team. Modeled on Chronos's work_items, with
-- deliberate departures:
--
-- * client_id is the required scope — there is NO project level
--   for tickets. project_id is optional, purely for tying a
--   ticket to a specific engagement when useful.
-- * status is richer than Chronos's 3-lane board (not_started/
--   in_progress/done): this is client-facing support, not
--   internal work tracking, so open/in_progress/resolved/closed,
--   with a reopened_count bumped by trigger instead of Chronos's
--   plain 3 lanes.
-- * blocked_on is reused from Aligned's own milestones.delay_owner
--   concept (client vs team), not from Chronos, so the two
--   features read consistently.
-- * dual authorship: a ticket is raised by a team member OR by a
--   client (shared per-company login, so "client_name" is a
--   free-text "posting as" value, not a foreign key to an
--   individual account). Chronos never needs this because it only
--   ever has one profiles table.
-- * ref_number comes from a real sequence, not the racy
--   `max(ref_number)+1` pattern the original decisions.ref_number
--   used (see migration 012, which fixes that one too).
-- ============================================================

do $$ begin
  create type ticket_status as enum ('open', 'in_progress', 'resolved', 'closed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type ticket_priority as enum ('low', 'medium', 'high', 'urgent');
exception when duplicate_object then null;
end $$;

create sequence if not exists ticket_ref_seq;

create table if not exists tickets (
  id            uuid primary key default gen_random_uuid(),
  ref_number    int not null unique default nextval('ticket_ref_seq'),

  client_id     uuid not null references clients(id) on delete cascade,
  project_id    uuid references projects(id) on delete set null,

  title         text not null check (length(trim(title)) > 0),
  description   text,
  category      text not null default 'general',   -- editable list lives in app_settings.ticket_categories

  status        ticket_status not null default 'open',
  priority      ticket_priority not null default 'medium',
  blocked_on    text check (blocked_on in ('client', 'team')),

  position      double precision not null default 0,

  due_date      date,
  resolved_at   timestamptz,
  closed_at     timestamptz,
  reopened_count int not null default 0,

  created_by_team_member_id uuid references team_members(id) on delete set null,
  created_by_client_name    text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint tickets_single_author check (
    (created_by_team_member_id is not null and created_by_client_name is null)
    or (created_by_team_member_id is null and created_by_client_name is not null)
  )
);

create index if not exists idx_tickets_client      on tickets(client_id);
create index if not exists idx_tickets_project     on tickets(project_id);
create index if not exists idx_tickets_status      on tickets(status);
create index if not exists idx_tickets_priority    on tickets(priority);
create index if not exists idx_tickets_due_date    on tickets(due_date);
create index if not exists idx_tickets_created_by  on tickets(created_by_team_member_id);

drop trigger if exists tickets_updated_at on tickets;
create trigger tickets_updated_at
  before update on tickets
  for each row execute function handle_updated_at();

-- resolved_at/closed_at follow status in both directions, and a
-- ticket that bounces back out of resolved/closed bumps
-- reopened_count instead of losing the history the way clearing a
-- timestamp silently would.
create or replace function sync_ticket_status_timestamps()
returns trigger language plpgsql as $$
begin
  if new.status = 'resolved' and old.status is distinct from 'resolved' then
    new.resolved_at := now();
  end if;

  if new.status = 'closed' and old.status is distinct from 'closed' then
    new.closed_at := now();
  end if;

  if new.status in ('open', 'in_progress') and old.status in ('resolved', 'closed') then
    new.reopened_count := old.reopened_count + 1;
    new.resolved_at := null;
    new.closed_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tickets_status_sync on tickets;
create trigger trg_tickets_status_sync
  before update of status on tickets
  for each row execute function sync_ticket_status_timestamps();

-- ============================================================
-- Shared predicates — the single source of truth for "is this
-- person on the client's team", reused unchanged by the mention
-- filter (migration 009) and the RLS policies (migration 010) so
-- the two can never drift apart the way Chronos's CLAUDE.md warns
-- inline copies eventually do.
-- ============================================================

create or replace function get_ticket_client(p_ticket_id uuid)
returns uuid language sql security definer stable as $$
  select client_id from tickets where id = p_ticket_id;
$$;

create or replace function get_client_manager(p_client_id uuid)
returns uuid language sql security definer stable as $$
  select manager_id from clients where id = p_client_id;
$$;

-- True for: admins; the client's assigned Manager; or anyone whose
-- own manager_id is that client's Manager (i.e. on the Manager's
-- team). This is the ticket-visibility/assignment backbone.
create or replace function is_on_client_team(p_client_id uuid, p_user_id uuid)
returns boolean language sql security definer stable as $$
  select
    coalesce((select role = 'admin' from team_members where id = p_user_id), false)
    or get_client_manager(p_client_id) = p_user_id
    or (
      get_client_manager(p_client_id) is not null
      and (select manager_id from team_members where id = p_user_id) = get_client_manager(p_client_id)
    );
$$;
