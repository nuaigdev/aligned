# Aligned — Full Product Specification
**Built by NuAIg · Internal client ticketing platform**

---

## The Problem We're Solving

Client issues and requests were scattered across email threads, Slack DMs, and
whoever happened to pick up the phone — no single record of what was raised, who's
working it, or whether it actually got resolved. Aligned fixes this by giving each
client a portal to raise and track tickets, and giving NuAIg's team a shared,
searchable, auditable thread for every one of them.

*(Aligned originally also covered a Milestones/Decisions/Documents/e-signature
layer — a formal, signed record of project decisions and stage sign-offs. That
scope was cut. The schema, routes, and email templates for it were removed
outright in migration `040`; this document describes the product as it exists
today, not that earlier version. See `CLAUDE.md` rule 14 if you're wondering
whether to bring any of it back.)*

---

## Product Name & Branding

- **Product name:** Aligned
- **Company:** NuAIg
- **Logo:** orange gradient mark (see `logo.png` / `.brand-wordmark` in `globals.css`)
- **Tagline:** Every client ticket — tracked, triaged, and closed out.

---

## Tech Stack

| Layer | Tool | Notes |
|---|---|---|
| Framework | Next.js 14 (App Router) | Server Components by default |
| Database | Supabase (PostgreSQL) | See `supabase/migrations/` |
| Auth | Supabase Auth | NuAIg team only |
| File Storage | Supabase Storage | `project-documents` bucket (ticket attachments) |
| Email | Resend | Ticket confirmation / reply / resolved |
| Deployment | Vercel | |
| Styling | Tailwind CSS + inline styles | Inline `style={{}}` is the real convention — see `CLAUDE.md` |

**No mobile support.** All routes show a "Desktop only" message on viewports
below 768px, including the client portal. No exceptions.

---

## Two Distinct Surfaces

### 1. Internal Dashboard (`/dashboard/*`)
For the NuAIg team. Requires Supabase Auth login. Any active team member can view
and search every ticket; acting on one (commenting, reassigning, attaching a file)
requires being on that ticket's project team, being the client's assigned Manager, or
being an admin.

### 2. Client Portal (`/portal/*`)
For the client organisation. One shared login per company (`clients.login_id` +
password, not per-contact) — see Access & Identity Model below. Clients raise
tickets, comment, and watch their status. There is no signing or formal-approval
step anywhere in the product; the portal is a ticketing surface, not an
e-signature one.

---

## Access & Identity Model

### NuAIg team
- Login via email + password (Supabase Auth)
- `team_members.role` is `admin | manager | member`
- Admins manage other team members; a Manager's "team" is whoever's
  `manager_id` points at them
- Ticket *visibility* is open to any active team member; ticket *action rights*
  (comment, reassign, attach files) are scoped to the ticket's project team,
  the client's assigned Manager, or an admin — see `CLAUDE.md`'s Ticketing
  section for the full model

### Client portal access
- One shared login per client company: a login id + password, issued from the
  client's dashboard page, never a per-project token
- Session is a `jose`-signed JWT cookie (`lib/auth/client-session*.ts`) — not a
  Supabase Auth session, so Postgres RLS can't see it; portal Server Actions
  authorize manually against the session's `clientId`
- Can raise tickets, comment, watch status — cannot sign or approve anything,
  because there's nothing in the product left to sign

---

## Tickets

Tickets are the entire product. A client raises one from the portal (optionally
against a project); the assigned project's team triages, comments, and resolves it.

### Ticket fields
- Reference number (`ref_number`, global sequence — displayed as `CODE-017`,
  where `CODE` is derived from the client's slug)
- Client (required), Project (optional)
- Title, description, category
- `ticket_type`: `client` (visible on the portal) or `internal` (team-only,
  never shown to the client — see below)
- Status: `open | in_progress | resolved | closed`, plus a `reopened_count`
  bumped whenever a resolved/closed ticket moves back to open/in_progress
- Priority: `low | medium | high | urgent`
- `blocked_on`: `client` or `team`, nullable — who the ticket is waiting on
- Due date, resolved/closed timestamps
- Author: exactly one of a team member or a client's free-text "posting as" name
  (the shared client login has no individual account to attribute to)

### `ticket_type` — client vs internal
- A **client-raised** ticket is always `ticket_type = 'client'` and can never be
  reclassified — it's permanently visible on that client's portal
- A **team-raised** ticket can be created as either `client` or `internal`, and
  can be flipped between the two later
- An `internal` ticket, and every comment on it, is never visible on the portal
  — enforced by a DB trigger, not just the UI, so a client can't see internal
  notes even by inspecting network responses

### Who can act on a ticket
A project has an explicit team roster (`project_members`). Being on a ticket's
project team — or being the client's assigned Manager, or an admin, or the
ticket's creator/assignee — is what grants comment/reassign/attach rights.
Being a plain team member elsewhere in the org does not. Any active team member
can still *view* or *search* any ticket regardless of project membership —
action rights and visibility are deliberately different rules.

### Comments and mentions
- Comments follow the same dual-authorship rule as tickets
- A team member can mark a comment "visible to client" — that's what actually
  reaches the client's inbox (an internal note doesn't, even on a client ticket)
- `@mention`ing in a comment is restricted to people on the client's team
  (broader than project membership — mentioning isn't a security boundary the
  way acting on a ticket is)

---

## Client Contact Management

### Two-level contact model

**Client level (default contacts)**
- Contacts set at the client organisation level
- Inherited by every project for that client

**Project level (project-specific contacts)**
- Additional contacts added for one specific project only

**Former contacts**
- When a contact is removed, they are NOT deleted — marked inactive with a
  `removed_at` timestamp, shown greyed out in a "Former contacts" section

### What contacts are used for
- The portal's "posting as" name picker — cosmetic attribution when a client
  raises a ticket or comments, not an auth boundary (the shared login is)
- The recipient list for ticket email (`lib/email/index.ts`) — a ticket's
  *effective* contact list is the client's defaults plus any contacts added
  specifically to that ticket's project

---

## Projects

### Project fields
- Name, Client (linked), Description (optional)
- Status: Active / Awaiting client / Awaiting team / On hold / Completed / Archived
- Start date, planned end date

### Project team (`project_members`)
Every project has an explicit roster of team members, managed from the
project hub by anyone already on the project, the client's assigned Manager,
or an admin. This roster is what drives ticket action rights (see Tickets,
above) — it replaced an earlier "any team member can act on any client's
tickets" model.

### Project status
Set manually by the NuAIg team. "Awaiting client" = ball is in the client's
court; "Awaiting team" = ball is in NuAIg's. Purely informational — there is no
delay-tracking or timeline feature attached to it (that was part of the removed
Milestones feature).

---

## NuAIg Internal Dashboard — Full Feature List

### Overview page (`/dashboard`)
- Stat tiles: tickets assigned to you, open, urgent, resolved this week
- "Needs your attention" — urgent and unassigned tickets, scoped to your
  projects (same display filter as the Tickets page, not an RLS restriction)
- "Assigned to me" ticket list
- Tickets-by-status breakdown
- Projects shortcut list (scoped to your own projects) and a unified recent
  activity stream (tickets + projects, scoped the same way)

### Tickets board (`/dashboard/tickets`)
- Kanban and list views, grouped/sorted, filterable
- Stat cards: open, in progress, urgent, unassigned (scoped to your projects
  by default — admins see everything)
- "New ticket" — project picker only offers your own projects (every project,
  for an admin or a client's Manager); `client_id` is derived from the chosen
  project
- Universal ticket search lives in the header (not this page) — reachable from
  anywhere, matches a client code and/or ticket number as a case-insensitive
  prefix, ranks an identifier match above a title match

### Ticket detail (`/dashboard/tickets/[id]`)
- Full comment thread, properties panel (status/priority/assignees/blocked-on/
  due date), attachments
- Read-only for a team member who can't act on this ticket's project: no
  composer, properties render as static pills, no upload/delete

### Projects list (`/dashboard/projects`)
- Scoped to your own projects (admins/managers with clients they manage see
  more) — status, client name, ticket count
- "New project" button (admin/manager only)

### Project detail hub (`/dashboard/projects/[projectId]`)
- Project name, client, status pill, portal-login shortcut
- Project team panel (add/remove members)
- Ticket stats + an embedded ticket board scoped to this project

### Clients list (`/dashboard/clients`)
- All client organisations, project count
- "New client" button (admin/manager only)

### Client detail + contacts (`/dashboard/clients/[clientId]`)
- Client name, project list
- Manager assignment + portal login issuance (admin only)
- Default contacts (client-level) and former contacts

---

## Client Portal — Full Feature List

The portal is reached via `/portal/login` (shared company login), not a
bookmarkable token URL.

### Portal hub (`/portal`)
- Ticket scorecards
- "Your projects" list

### Portal projects (`/portal/projects/[projectId]`)
- That project's ticket list

### Portal tickets (`/portal/tickets`, `/portal/tickets/new`, `/portal/tickets/[id]`)
- List, raise a new one (optional project pick, "posting as" contact picker),
  full detail + comment thread
- A ticket marked `internal` by the team is never visible here, at the list or
  detail level
- The persistent "New ticket" button lives in the portal header, not
  duplicated per page

---

## Email Notifications

Sent via Resend from `NuAIg Aligned <RESEND_FROM_EMAIL>` (`lib/email/index.ts`). All
four are ticket-triggered; there is no other email category in the product. Every one
is personalized — one send per recipient, addressed by name, never a shared multi-`to`
email — and goes to the ticket's effective contact list (client defaults + that
ticket's project-level additions) plus a copy to the client's assigned Manager.
There is deliberately no non-production guard: setting `RESEND_API_KEY` in any
environment makes that environment send real email to real client contacts.

### Ticket confirmation
- Sent when: a ticket is created for the client — whether the client raised it
  themselves on the portal, a team member logged it on their behalf, or a
  team-raised ticket is reclassified from internal to client (their first
  chance to see it)
- To: the ticket's effective contacts + the client's Manager
- Content: ticket reference + title, link to the portal ticket

### Team reply
- Sent when: a team member marks a comment "visible to client"
- To: the ticket's effective contacts + the client's Manager
- Content: who replied, the reply body, link to the portal ticket
- Not idempotency-guarded — distinct replies close together are legitimate

### Resolved
- Sent when: a ticket's status changes to `resolved`
- To: the ticket's effective contacts + the client's Manager
- Content: ticket reference + title, link to the portal ticket

### Closed (without ever being resolved)
- Sent when: a ticket's status changes straight to `closed` without ever
  passing through `resolved` first — if it was resolved first, the client
  already got that email and a second one would be noise
- To: the ticket's effective contacts + the client's Manager
- Content: ticket reference + title, link to the portal ticket

### Delivery log
Every attempted send (confirmation/reply/resolved/closed) is logged to
`ticket_emails` (migration 041) — recipients, status (`sent`/`partial`/`failed`),
and error detail on failure. Confirmation/resolved/closed also check this table
before firing, so a double-click or a retried Server Action can't double-send the
same event for the same ticket. Nothing is logged, and no such check runs, when
`RESEND_API_KEY` is unset.

---

## Audit Trail

There is no formal sign-off or immutable-record concept in the product anymore
— that was the removed Milestones/Decisions layer. What Aligned still keeps as
a durable record:
- Every ticket comment, with author and timestamp, kept forever (comments can
  be edited but not silently — `edited_at` is tracked)
- Every attempted ticket email, in `ticket_emails` (see above)
- `reopened_count` on a ticket, so a ticket that bounced back and forth still
  shows that history
- In-app notifications (team side) and ticket emails (client side) as a
  record of who was told what, when

---

## Database Schema Summary

### Tables (Ticketing-relevant)
- `clients` — client organisations
- `client_contacts` — contacts at client or project level
- `projects` — one per engagement
- `project_members` — a project's team roster, drives ticket action rights
- `tickets` — the core record; dual-authored, typed (`client`/`internal`)
- `ticket_comments` — dual-authored, `visible_to_client` flag, `@mention` support
- `ticket_assignees` — many team members per ticket
- `documents` — files in Supabase Storage; ticket attachments use `ticket_id`
- `team_members` — extends Supabase Auth users
- `notifications` / `client_notifications` — team in-app / client email triggers
- `ticket_emails` — audit log of every attempted ticket email + idempotency guard

### Key constraints
- `tickets.ref_number` — unique, from a single global sequence
- `tickets_single_author` / `ticket_comments_single_author` — exactly one of a
  team-member id or a client free-text name
- Team members have full RLS read access via authenticated session; acting on
  a ticket is gated by `can_edit_ticket()`
- Portal routes use the service role key server-side (never exposed to the
  browser) and authorize manually against the session's `clientId`

---

## Environment Variables Required

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY        ← server only, never expose to client
RESEND_API_KEY
RESEND_FROM_EMAIL
RESEND_FROM_NAME                 = NuAIg Aligned
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_COMPANY_NAME         = NuAIg
NEXTAUTH_SECRET                  ← signs the client portal session JWT
```

---

## What Is Built

See `CLAUDE.md`'s "What is built vs TODO" section — it's kept current there
rather than duplicated here, since that file is read on every session and this
one isn't.
