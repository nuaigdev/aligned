-- ============================================================
-- Aligned — Migration 023
-- Documents: project_id becomes optional
--
-- documents.project_id was NOT NULL from the original schema, back
-- when every document hung off a project. Tickets broke that
-- assumption — a ticket's project_id is itself optional (migration
-- 006), so a document attached to a project-less ticket had nowhere
-- valid to put a required project_id. Relaxes the constraint;
-- ticket-only attachments now carry ticket_id with project_id null.
-- ============================================================

alter table documents
  alter column project_id drop not null;
