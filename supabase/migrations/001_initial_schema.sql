-- ============================================================
-- Aligned — Full Database Schema
-- Run this in your Supabase SQL editor or via CLI
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- CLIENTS
-- One client org can have many projects
-- ============================================================
create table clients (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  slug          text not null unique, -- used for display e.g. "Nexus Co."
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- CLIENT CONTACTS
-- Contacts exist at client level (default) or project level
-- ============================================================
create table client_contacts (
  id            uuid primary key default uuid_generate_v4(),
  client_id     uuid not null references clients(id) on delete cascade,
  project_id    uuid,                -- null = default contact for all projects
  name          text not null,
  email         text not null,
  is_active     boolean not null default true,
  removed_at    timestamptz,         -- set when contact is removed, kept for audit
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_contacts_client on client_contacts(client_id);
create index idx_contacts_project on client_contacts(project_id);

-- ============================================================
-- PROJECTS
-- ============================================================
create type project_status as enum (
  'active',
  'on_hold',
  'awaiting_client',
  'awaiting_team',
  'completed',
  'archived'
);

create table projects (
  id              uuid primary key default uuid_generate_v4(),
  client_id       uuid not null references clients(id) on delete cascade,
  name            text not null,
  description     text,
  status          project_status not null default 'active',
  portal_token    text not null unique default encode(gen_random_bytes(32), 'hex'),
  started_at      date,
  planned_end_at  date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_projects_client on projects(client_id);
create index idx_projects_portal_token on projects(portal_token);

-- Forward reference: add project_id FK to contacts after projects table exists
alter table client_contacts
  add constraint fk_contacts_project
  foreign key (project_id) references projects(id) on delete cascade;

-- ============================================================
-- MILESTONES
-- ============================================================
create type milestone_type as enum (
  'client_gate',   -- requires client sign-off
  'internal',      -- internal only, client can view
  'informational'  -- auto-notifies client, no action needed
);

create type milestone_status as enum (
  'not_started',
  'in_progress',
  'awaiting_signoff',
  'completed',
  'reopened'
);

create table milestones (
  id              uuid primary key default uuid_generate_v4(),
  project_id      uuid not null references projects(id) on delete cascade,
  title           text not null,
  description     text,
  type            milestone_type not null default 'internal',
  status          milestone_status not null default 'not_started',
  phase           text,             -- e.g. "Requirements", "UAT", "Go-live"
  due_date        date,
  completed_at    timestamptz,
  iteration       int not null default 1,  -- increments on regression
  parent_id       uuid references milestones(id), -- link to previous iteration
  delay_owner     text,             -- 'client' | 'team' | null
  delay_reason    text,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_milestones_project on milestones(project_id);

-- ============================================================
-- DECISIONS
-- ============================================================
create type decision_status as enum (
  'draft',
  'pending_approval',
  'approved',
  'amended'
);

create table decisions (
  id              uuid primary key default uuid_generate_v4(),
  project_id      uuid not null references projects(id) on delete cascade,
  ref_number      int not null,     -- auto-incremented per project e.g. D-008
  title           text not null,
  description     text,
  status          decision_status not null default 'draft',
  meeting_ref     text,             -- e.g. "Meeting #8"
  signed_at       timestamptz,
  signed_by_name  text,
  signed_by_email text,
  parent_id       uuid references decisions(id), -- for amendments
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(project_id, ref_number)
);

create index idx_decisions_project on decisions(project_id);

-- Auto-increment ref_number per project
create or replace function next_decision_ref(p_project_id uuid)
returns int language sql as $$
  select coalesce(max(ref_number), 0) + 1
  from decisions
  where project_id = p_project_id;
$$;

-- ============================================================
-- APPROVAL LINKS
-- One per recipient per decision/milestone
-- ============================================================
create type approval_target_type as enum ('decision', 'milestone');
create type approval_status as enum ('pending', 'signed', 'expired', 'superseded');

create table approval_links (
  id              uuid primary key default uuid_generate_v4(),
  project_id      uuid not null references projects(id) on delete cascade,
  target_type     approval_target_type not null,
  target_id       uuid not null,    -- decision.id or milestone.id
  token           text not null unique default encode(gen_random_bytes(32), 'hex'),
  recipient_name  text not null,
  recipient_email text not null,
  status          approval_status not null default 'pending',
  signed_at       timestamptz,
  concern_text    text,             -- filled if recipient raises a concern
  concern_raised_at timestamptz,
  nudge_count     int not null default 0,
  last_nudge_at   timestamptz,
  expires_at      timestamptz,
  created_at      timestamptz not null default now()
);

create index idx_approval_links_token on approval_links(token);
create index idx_approval_links_target on approval_links(target_type, target_id);
create index idx_approval_links_project on approval_links(project_id);

-- ============================================================
-- DOCUMENTS
-- ============================================================
create type document_shared_by as enum ('team', 'client');

create table documents (
  id              uuid primary key default uuid_generate_v4(),
  project_id      uuid not null references projects(id) on delete cascade,
  milestone_id    uuid references milestones(id) on delete set null,
  decision_id     uuid references decisions(id) on delete set null,
  name            text not null,
  storage_path    text not null,    -- Supabase Storage path
  file_type       text,             -- e.g. 'pdf', 'docx', 'png'
  file_size_bytes bigint,
  phase           text,             -- e.g. "Requirements", "UAT"
  shared_by       document_shared_by not null default 'team',
  uploaded_by     text,             -- name of uploader (internal team member)
  created_at      timestamptz not null default now()
);

create index idx_documents_project on documents(project_id);
create index idx_documents_milestone on documents(milestone_id);

-- ============================================================
-- MILESTONE SIGN-OFFS (audit log)
-- Separate from approval_links — this is the immutable record
-- ============================================================
create table milestone_signoffs (
  id              uuid primary key default uuid_generate_v4(),
  milestone_id    uuid not null references milestones(id) on delete cascade,
  approval_link_id uuid references approval_links(id),
  signed_by_name  text not null,
  signed_by_email text not null,
  signed_at       timestamptz not null default now(),
  ip_address      text,
  user_agent      text
);

create index idx_signoffs_milestone on milestone_signoffs(milestone_id);

-- ============================================================
-- INTERNAL TEAM USERS
-- Supabase Auth handles passwords — this extends the auth.users table
-- ============================================================
create table team_members (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  email       text not null unique,
  role        text not null default 'member', -- 'admin' | 'member'
  created_at  timestamptz not null default now()
);

-- ============================================================
-- UPDATED_AT TRIGGER (apply to all tables with updated_at)
-- ============================================================
create or replace function handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger clients_updated_at
  before update on clients
  for each row execute function handle_updated_at();

create trigger contacts_updated_at
  before update on client_contacts
  for each row execute function handle_updated_at();

create trigger projects_updated_at
  before update on projects
  for each row execute function handle_updated_at();

create trigger milestones_updated_at
  before update on milestones
  for each row execute function handle_updated_at();

create trigger decisions_updated_at
  before update on decisions
  for each row execute function handle_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- Internal team: full access via Supabase Auth session
-- Portal (client): read-only via portal_token, no auth session
-- Sign page: write via approval token, no auth session
-- ============================================================

alter table clients          enable row level security;
alter table client_contacts  enable row level security;
alter table projects         enable row level security;
alter table milestones       enable row level security;
alter table decisions        enable row level security;
alter table approval_links   enable row level security;
alter table documents        enable row level security;
alter table milestone_signoffs enable row level security;
alter table team_members     enable row level security;

-- Team members: full access to everything (authenticated users)
create policy "team_full_access_clients"
  on clients for all to authenticated using (true) with check (true);

create policy "team_full_access_contacts"
  on client_contacts for all to authenticated using (true) with check (true);

create policy "team_full_access_projects"
  on projects for all to authenticated using (true) with check (true);

create policy "team_full_access_milestones"
  on milestones for all to authenticated using (true) with check (true);

create policy "team_full_access_decisions"
  on decisions for all to authenticated using (true) with check (true);

create policy "team_full_access_approvals"
  on approval_links for all to authenticated using (true) with check (true);

create policy "team_full_access_documents"
  on documents for all to authenticated using (true) with check (true);

create policy "team_full_access_signoffs"
  on milestone_signoffs for all to authenticated using (true) with check (true);

create policy "team_members_own_record"
  on team_members for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Portal read access: anon can read project data via portal_token
-- These are used by API routes that validate the token server-side
-- and use the service role key — anon policies not needed for portal
-- The service role key bypasses RLS entirely, used only in server API routes

-- Approval signing: anon can read and update their specific approval link via token
-- Handled server-side with service role key in API routes

-- ============================================================
-- STORAGE BUCKETS
-- Create these in Supabase dashboard or via CLI
-- ============================================================
-- Run these separately in Supabase SQL editor:
--
-- insert into storage.buckets (id, name, public)
-- values ('project-documents', 'project-documents', false);
--
-- insert into storage.buckets (id, name, public)
-- values ('signed-records', 'signed-records', false);
--
-- Storage policies (authenticated team access):
-- create policy "team_upload_documents"
--   on storage.objects for insert to authenticated
--   with check (bucket_id = 'project-documents');
--
-- create policy "team_read_documents"
--   on storage.objects for select to authenticated
--   using (bucket_id in ('project-documents', 'signed-records'));
--
-- create policy "team_delete_documents"
--   on storage.objects for delete to authenticated
--   using (bucket_id = 'project-documents');

-- ============================================================
-- SEED: Initial admin user placeholder
-- Replace with your actual Supabase Auth user ID after signup
-- ============================================================
-- insert into team_members (id, name, email, role)
-- values ('your-supabase-auth-user-id', 'Your Name', 'you@nuaig.com', 'admin');
