-- ============================================================
-- Aligned — Migration 031
-- Milestones: percentage weight
--
-- Each milestone is assigned the percentage of the project it
-- represents, so overall project progress can be computed as the sum
-- of percentages for completed milestones rather than a flat
-- completed/total count. The 100%-total cap across a project's
-- milestones is enforced in the UI (lib has no Server Action layer
-- for milestones today — RLS from migration 029 already restricts
-- who can write these rows to admin/manager).
-- ============================================================

alter table milestones add column if not exists percentage integer not null default 0;

do $$ begin
  alter table milestones add constraint milestones_percentage_range check (percentage >= 0 and percentage <= 100);
exception when duplicate_object then null;
end $$;
