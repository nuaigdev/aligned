-- ============================================================
-- Aligned — Migration 041
-- Ticket email audit log
--
-- Every attempted ticket email (confirmation/reply/resolved/closed) gets
-- one row here, written by the service-role client from lib/email/index.ts
-- regardless of which surface (dashboard or portal) triggered the send —
-- same as client_notifications (migration 032). Two things this backs:
--
--   1. Traceability — "did the client actually get told about this" now
--      has an answer, matching the audit-trail instinct the rest of the
--      product already has for tickets themselves.
--   2. Idempotency — lib/email/index.ts checks this table for a recent
--      'sent'/'partial' row of the same (ticket_id, kind) before firing a
--      confirmation/resolved/closed email again, so a double-click or a
--      retried Server Action can't double-send. Reply emails are
--      deliberately NOT deduped this way — two distinct replies close
--      together are legitimate, not a double-fire.
--
-- Rows are never written when RESEND_API_KEY is unset — lib/email/index.ts
-- treats "not configured" as a pure no-op (console.warn only, per
-- CLAUDE.md rule 11), not an attempted send, so nothing is logged and the
-- idempotency check never blocks the first real send once a key is added.
-- ============================================================

create table if not exists ticket_emails (
  id                uuid primary key default gen_random_uuid(),
  ticket_id         uuid not null references tickets(id) on delete cascade,
  kind              text not null,               -- 'confirmation' | 'reply' | 'resolved' | 'closed'
  recipient_emails  text[] not null,
  status            text not null,                -- 'sent' | 'partial' | 'failed'
  error_message     text,
  created_at        timestamptz not null default now()
);

create index if not exists idx_ticket_emails_ticket_kind on ticket_emails(ticket_id, kind, created_at desc);

alter table ticket_emails enable row level security;

-- Read access matches the "any active team member, full access" READ
-- model every other table in this app uses. No insert/update/delete
-- policy for the authenticated role — every write is service-role only.
drop policy if exists "ticket_emails_select_all" on ticket_emails;
create policy "ticket_emails_select_all"
  on ticket_emails for select to authenticated using (true);
