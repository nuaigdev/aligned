-- ============================================================
-- Aligned — Migration 019
-- Storage buckets + policies
--
-- Previously this was commented-out SQL you had to paste into the
-- dashboard by hand. For a from-scratch project it's just as safe
-- to run live: bucket rows and storage.objects policies are regular
-- tables/RLS, idempotent via ON CONFLICT / DROP POLICY IF EXISTS
-- like everything else in this folder.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('project-documents', 'project-documents', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('signed-records', 'signed-records', false)
on conflict (id) do nothing;

drop policy if exists "team_upload_documents" on storage.objects;
create policy "team_upload_documents"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'project-documents');

drop policy if exists "team_read_documents" on storage.objects;
create policy "team_read_documents"
  on storage.objects for select to authenticated
  using (bucket_id in ('project-documents', 'signed-records'));

drop policy if exists "team_delete_documents" on storage.objects;
create policy "team_delete_documents"
  on storage.objects for delete to authenticated
  using (bucket_id = 'project-documents');

-- The portal (client) uploads/downloads exclusively through server
-- actions using the service-role client (signed URLs, 1hr expiry
-- per CLAUDE.md), so no anon/client storage.objects policy is
-- needed — same bypass-RLS model as the rest of the portal.
