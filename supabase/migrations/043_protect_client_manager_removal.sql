-- ============================================================
-- Aligned — Migration 043
-- Protect the client's assigned Manager from being removed off a
-- project's roster by a lower-privileged teammate.
--
-- can_manage_project_members() (migration 038) deliberately lets any
-- existing project member add/remove people — that's still correct
-- for ordinary membership changes. But it means a plain 'member' can
-- currently remove the client's assigned Manager from the project
-- team entirely, which shouldn't be a member-level action. Carve out
-- just that one case: removing the row that IS the client's Manager
-- now requires admin.
-- ============================================================

create or replace function can_remove_project_member(p_project_id uuid, p_target_team_member_id uuid, p_user_id uuid)
returns boolean language sql security definer stable as $$
  select case
    when get_client_manager((select client_id from projects where id = p_project_id)) = p_target_team_member_id
      then coalesce((select role = 'admin' from team_members where id = p_user_id), false)
    else can_manage_project_members(p_project_id, p_user_id)
  end;
$$;

drop policy if exists "project_members_delete" on project_members;
create policy "project_members_delete"
  on project_members for delete to authenticated
  using (can_remove_project_member(project_id, team_member_id, auth.uid()));
