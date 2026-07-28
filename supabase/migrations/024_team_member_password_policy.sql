-- ============================================================
-- Aligned — Migration 024
-- Team members: forced password change on first login
--
-- Mirrors the client portal's must_change_password flow (migration
-- 003) for team accounts. New accounts created via createTeamMember
-- get a generated temp password and must_change_password = true;
-- existing accounts default to false so nobody already using the
-- app gets locked out by this rollout.
-- ============================================================

alter table team_members add column if not exists must_change_password boolean not null default false;
