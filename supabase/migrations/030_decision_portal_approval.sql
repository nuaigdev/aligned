-- ============================================================
-- Aligned — Migration 030
-- Decisions: portal-native approve/decline/hold
--
-- Decisions move off the email/token approval flow (which milestones
-- still use) onto a direct-in-portal action, since the client now has
-- a real session there. 'declined' and 'on_hold' are new terminal/
-- non-terminal statuses: approved and declined can never be changed
-- again; on_hold can later be approved or declined ("accept later").
--
-- signed_by_name/signed_at are reused for the approved case (keeps
-- the existing "Signed by X" display working team-side); decline/hold
-- get their own client_decision_comment/client_decided_by_name/
-- decided_at columns since "signed" doesn't apply to them.
--
-- milestone_id lets a decision be tied to a stage, same concept as
-- documents.milestone_id already supports.
-- ============================================================

alter type decision_status add value if not exists 'declined';
alter type decision_status add value if not exists 'on_hold';

alter table decisions add column if not exists milestone_id uuid references milestones(id) on delete set null;
alter table decisions add column if not exists client_decision_comment text;
alter table decisions add column if not exists client_decided_by_name text;
alter table decisions add column if not exists decided_at timestamptz;

create index if not exists idx_decisions_milestone on decisions(milestone_id);
