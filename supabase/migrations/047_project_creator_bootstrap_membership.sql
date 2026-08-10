-- ============================================================
-- NuAIg Assist — Migration 047
-- Fix: project creator silently not added to project_members
--
-- can_manage_project_members() (migration 038) allows an insert when
-- the caller is an admin, the client's assigned Manager, or already a
-- project member. That last branch is a chicken-and-egg problem for a
-- brand-new project: the creator isn't a member yet (that's exactly
-- what the insert is trying to establish), so a manager who is NOT
-- also the client's assigned Manager was silently blocked by RLS from
-- adding themselves as createProject's first project_members insert
-- ran (lib/projects/actions.ts never checked that insert's error
-- either, so this failed with no visible error at all).
--
-- Fix: allow the bootstrap case — inserting into an EMPTY project's
-- member list is allowed for anyone who could have created the
-- project in the first place (admin or manager, matching
-- projects_insert_admin_or_manager). Once the project has at least
-- one member, this branch stops applying and normal membership rules
-- take back over.
-- ============================================================

create or replace function can_manage_project_members(p_project_id uuid, p_user_id uuid)
returns boolean language sql security definer stable as $$
  select
    coalesce((select role = 'admin' from team_members where id = p_user_id), false)
    or get_client_manager((select client_id from projects where id = p_project_id)) = p_user_id
    or is_project_member(p_project_id, p_user_id)
    or (
      not exists (select 1 from project_members where project_id = p_project_id)
      and coalesce((select role in ('admin', 'manager') from team_members where id = p_user_id), false)
    );
$$;
