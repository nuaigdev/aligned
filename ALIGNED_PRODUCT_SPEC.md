# Aligned — Full Product Specification
**Built by NuAIg · Internal project decision and milestone management platform**

---

## The Problem We're Solving

Clients say "we never agreed to that" or "we don't remember that decision."
Work gets implemented, then disputed. Delays happen and nobody knows whose fault it was.
Files are scattered across email threads. There is no single source of truth.

Aligned fixes this by creating a permanent, signed, auditable record of every decision
and milestone, shared between NuAIg and the client — with a clear chain of custody
for every approval.

---

## Product Name & Branding

- **Product name:** Aligned
- **Company:** NuAIg
- **Logo text:** "Aligned" with a brand purple accent on a letter or the dot
- **Tagline:** Every decision. Every milestone. Permanently on record.

---

## Tech Stack

| Layer | Tool | Notes |
|---|---|---|
| Framework | Next.js 14 (App Router) | Server Components by default |
| Database | Supabase (PostgreSQL) | Free tier |
| Auth | Supabase Auth | NuAIg team only |
| File Storage | Supabase Storage | Private buckets |
| Email | Resend | Free tier (3k/month) |
| PDF | @react-pdf/renderer | Signed record generation |
| Deployment | Vercel | Free tier |
| Styling | Tailwind CSS + inline styles | |

**No mobile support.** All routes show a "Desktop only" message on viewports
below 768px. This includes the client portal and the sign page. No exceptions.

---

## Three Distinct Surfaces

### 1. Internal Dashboard (`/dashboard/*`)
For the NuAIg team only. Requires Supabase Auth login.
Full read/write access to everything.

### 2. Client Portal (`/portal/[token]`)
For the client organisation. No login required.
Accessed via a permanent, bookmarkable URL with a long random token.
**Read-only. Cannot sign or approve anything from here.**
Shareable within the client organisation — the whole team can use one link.

### 3. Sign Page (`/sign/[approvalToken]`)
For named individuals at the client. Accessed only via email link.
One-time approval link tied to a specific person's name and email.
**This is the only place where signing happens.**

---

## Access & Identity Model

### NuAIg team
- Login via email + password (Supabase Auth)
- All team members can manage all projects
- Admin role can manage other team members

### Client portal access
- Permanent URL: `/portal/[token]` where token is 32 random bytes (hex)
- No login, no account, no password
- Read-only for everything
- Shareable — anyone at the client with the link can browse
- Can be revoked by regenerating the token (future feature)

### Client signing access
- Named individuals receive one-time email links: `/sign/[approvalToken]`
- Each link is tied to: recipient name + recipient email
- Link is unique per person per approval — three recipients = three different links
- **First person to sign locks the approval.** Others see confirmation of who signed.
- Once superseded, a link shows: "Signed by [Name] on [Date]" — cannot be used
- The sign page shows: "You are signing as [Name] ([email])"
- Disclaimer on sign page: "By signing, you confirm you are authorised to approve
  on behalf of [ClientName]. This will be permanently logged against your name,
  email, and timestamp. It cannot be undone."
- If recipient forwards their link to a colleague, the colleague's action still
  logs under the original recipient's name — responsibility is on the client

### Concern flag
- On the sign page, before signing, a recipient can raise a concern
- Small "Have a concern?" toggle reveals a text area
- Submitting a concern notifies the NuAIg team by email immediately
- Does NOT block or void the sign-off — it just creates a visible flag
- The concern is logged against the approval record permanently
- Recipient can "Send concern only" without signing, or sign with a concern attached

---

## Client Contact Management

### Two-level contact model

**Client level (default contacts)**
- Contacts set at the client organisation level
- Automatically inherited by every project for that client
- E.g. Sarah Chen and Raj Patel are Nexus Co. defaults — every Nexus project
  starts with them as contacts

**Project level (project-specific contacts)**
- Additional contacts added for one specific project only
- E.g. Priya Mehta added to Nexus Rebrand only, not other Nexus projects
- Displayed with "(this project)" label to distinguish from inherited contacts

**Former contacts**
- When a contact is removed, they are NOT deleted
- They are marked inactive with a `removed_at` timestamp
- All approvals they signed remain valid and attributed to them
- They appear in a "Former contacts" section in the UI, greyed out
- This protects against "my colleague who left signed that, so it doesn't count"

### Sending approval links
- When sending an approval, NuAIg selects recipients from the project's contact list
- Cannot type a free email — must be a configured contact
- Can select one or multiple contacts for the same approval
- Each selected contact gets their own unique link

---

## Projects

### Project fields
- Name
- Client (linked to a client record)
- Description (optional)
- Status: Active / Awaiting client / Awaiting team / On hold / Completed / Archived
- Start date
- Planned end date
- Portal token (auto-generated, used for the client portal URL)

### Project status
The status is set manually by the NuAIg team to reflect the current state.
"Awaiting client" = ball is in the client's court.
"Awaiting team" = ball is in NuAIg's court.
This drives the delay tracking visible to both sides.

### Portal link
Every project has one permanent portal link shown prominently in the project header.
NuAIg can copy it and share with the client at any time.

---

## Milestones

Milestones are the backbone of project tracking. They show the full lifecycle of the
project in a timeline, including regressions (e.g. UAT failing and going back to dev).

### Milestone types

| Type | Who owns it | Client can see? | Client must act? |
|---|---|---|---|
| `client_gate` | Shared | Yes | Yes — sign-off required |
| `internal` | NuAIg | Yes (read-only) | No |
| `informational` | NuAIg | Yes | No — just notified |

### Milestone statuses
- Not started
- In progress
- Awaiting sign-off (client gate only, approval link sent)
- Completed
- Reopened (regression)

### Milestone fields
- Title
- Description
- Type (client_gate / internal / informational)
- Phase (e.g. "Initiation", "Requirements", "Design", "Development", "UAT", "Go-live")
- Due date
- Completed date (auto-set when signed or marked complete)
- Delay owner: client / team / null
- Delay reason (text)
- Sort order
- Iteration number (starts at 1, increments on regression)
- Parent ID (links to previous iteration when a milestone is re-opened)

### Regression handling
When a phase needs to repeat (e.g. UAT fails, goes back to development):
- NuAIg marks the UAT milestone as "Reopened"
- A new iteration is created (UAT Cycle 2) with `iteration: 2` and `parent_id` pointing
  to UAT Cycle 1
- The old record is NEVER deleted — it stays in the timeline
- The timeline visibly shows: UAT Cycle 1 → regression note → Dev Cycle 2 → UAT Cycle 2
- Regression note shows who triggered it, the date, and the reason
- Delay ownership can be attributed: if bugs were caused by scope creep from the client,
  delay_owner = 'client'. If they were NuAIg bugs, delay_owner = 'team'

### Milestone sign-off
- Only `client_gate` milestones require client sign-off
- NuAIg sends the approval link to one or more client contacts
- First to sign locks the milestone as Completed
- The sign-off creates an immutable audit record: name, email, timestamp, IP, user agent
- This audit record cannot be deleted or edited, ever
- Client sees the milestone as "Awaiting signature — check your email" on the portal

### Phases (suggested, configurable)
- Initiation
- Requirements
- Design
- Development
- Testing (internal)
- UAT
- Go-live

---

## Decisions

Decisions are the other core record type. Any agreement made during a meeting,
call, or conversation that changes, confirms, or scopes the project.

### Decision fields
- Auto-incremented reference number per project (e.g. D-001, D-008)
- Title (short description of the decision)
- Description (full context, what was decided and why)
- Status: Draft / Pending approval / Approved / Amended
- Meeting reference (e.g. "Meeting #8") — free text
- Signed at (timestamp)
- Signed by name + email (set when approved)
- Parent ID (for amendments — links amendment to the original decision)

### Decision workflow
1. NuAIg creates a decision record (can be draft initially)
2. NuAIg sends approval links to selected client contacts
3. Status changes to "Pending approval"
4. First contact to sign → decision locked as "Approved", others get "Superseded"
5. The decision record permanently shows: who signed, when

### Amendments
- A signed decision cannot be edited
- If it needs to change, NuAIg creates an amendment decision
- The amendment links back to the original via `parent_id`
- The original decision shows an "Amended by D-012" badge
- Both the original and the amendment require sign-off
- This preserves the full audit trail of how decisions evolved

### Decision numbering
- Auto-incremented per project (not global)
- Displayed as #D-001, #D-002 etc.
- Never reused, never deleted

---

## Documents

Documents are attached to projects, phases, milestones, or decisions.
They are a reference library — not signed, just attributed.

### Document fields
- Name
- Phase (e.g. "Requirements", "UAT")
- Linked milestone (optional)
- Linked decision (optional)
- Shared by: "team" (NuAIg) or "client" (the client organisation)
- Uploaded by (NuAIg team member name, for team-uploaded docs)
- File type, file size
- Storage path (Supabase Storage)
- Upload date

### Document display
- Organised by phase in both the dashboard and the portal
- Two filter pills: "By NuAIg" and "By [ClientName]" (e.g. "By Nexus Co.")
- The client name is used, not the word "client" — always specific
- No signing on documents — attribution only
- Both NuAIg and the client can download any document on the project
- NuAIg can upload documents on behalf of the client (marked as "By [ClientName]")

### Document types typically uploaded
- SOW (Statement of Work)
- SRS (Software Requirements Specification)
- PDD (Product Definition Document)
- SDD (System Design Document)
- UAT Test Plan
- Meeting summaries
- Design mockups, wireframes
- Brand assets
- Signed records (auto-generated PDFs after sign-offs)

### Signed records (auto-generated)
When a decision or milestone is signed:
- A PDF is automatically generated containing: project name, decision/milestone title,
  description, who signed, their email, timestamp, and the Aligned logo
- The PDF is stored in the `signed-records` Supabase Storage bucket
- It appears in the document vault automatically, tagged to the relevant milestone/decision
- Both NuAIg and the client can download it

---

## Delay Tracking

### How it works
Delays are tracked at the milestone level via `delay_owner` and `delay_reason`.
When a milestone passes its due date or a regression occurs, NuAIg sets:
- `delay_owner`: 'client' or 'team'
- `delay_reason`: plain text explanation

### What this produces
- The timeline shows a delay indicator on the relevant milestone
- The project overview shows total days delayed, split by client vs team
- The client portal shows delays visibly — "11-day delay · Client" — without being
  accusatory. It's framed as factual record-keeping, not blame
- If a client ever disputes a timeline, NuAIg can show the delay log as evidence

### Framing
Language in the UI uses "ball in court" framing:
- "Awaiting client" not "client is late"
- "11 days — client side" not "client caused 11-day delay"
- This keeps the relationship healthy while the record is objective

---

## Nudge System

### How it works
- When an approval link is pending and hasn't been acted on after 3 days, the system
  sends a reminder email to the recipient
- Maximum 3 nudges per approval link
- Nudge emails are friendly — "Friendly reminder, we're still waiting..."
- After 3 nudges, no more automatic emails (NuAIg can follow up manually)
- The dashboard shows nudge count on pending approvals
- Triggered by a daily cron job at 9am via Vercel Cron (`/api/nudge` route)
- Cron is protected by `CRON_SECRET` environment variable

---

## NuAIg Internal Dashboard — Full Feature List

### Overview page (`/dashboard`)
- Count of active projects, projects awaiting client, total pending approvals
- List of recent projects with status dots and last updated date
- Quick navigation to any project

### Projects list (`/dashboard/projects`)
- All projects with status, client name, start date, planned end date
- Status colour dot (green = active, amber = awaiting client, etc.)
- One-click to project detail
- "New project" button

### New project form (`/dashboard/projects/new`)
- Select client from dropdown
- Project name, description
- Start date, planned end date
- Creates project with auto-generated portal token

### Project detail hub (`/dashboard/projects/[projectId]`)
- Project name, client, status pill
- Client portal link with one-click copy button
- Stats: overall progress %, milestones done/total, decisions count, pending approvals
- Progress bar
- Quick nav cards to Milestones, Decisions, Documents

### Milestones page (`/dashboard/projects/[projectId]/milestones`)
- Full timeline of all milestones, grouped by phase
- Create new milestone (type, title, description, phase, due date)
- Edit milestone details
- Mark internal milestones as complete
- For client_gate milestones: "Send for sign-off" button
  - Opens modal to select recipients from project contacts
  - Sends approval emails, updates milestone status to "Awaiting sign-off"
- Reopen a milestone (triggers regression flow)
  - Prompts for: delay owner, delay reason, new iteration title
  - Creates new iteration, keeps old record
- Delete draft milestones only (cannot delete completed or signed milestones)

### Decisions page (`/dashboard/projects/[projectId]/decisions`)
- All decisions in reverse chronological order
- Decision reference, title, status, meeting ref, signed by
- Create new decision (title, description, meeting ref)
- Send for approval button (select recipients, same as milestones)
- Create amendment (links to original, requires its own sign-off)
- Export all decisions as PDF (the full decision log for the project)

### Documents page (`/dashboard/projects/[projectId]/documents`)
- Files grouped by phase
- Upload file: select phase, milestone/decision link (optional), set shared_by
  (NuAIg or client — NuAIg can upload on behalf of client)
- Download any file
- Delete file (with confirmation, only if not linked to a signed record)
- Filter by phase or by shared_by
- Signed record PDFs appear here automatically after any sign-off

### Clients list (`/dashboard/clients`)
- All client organisations
- Name, number of active projects, number of contacts
- "New client" button

### Client detail + contacts (`/dashboard/clients/[clientId]`)
- Client name, project list with status dots
- Default contacts section: name, email, role label, active/inactive status
- Add default contact
- Remove contact (marks inactive, retains in audit)
- Project-level contacts: shown per project with inherited defaults greyed out
- Add project-specific contact
- Former contacts section: removed contacts with removal date

---

## Client Portal — Full Feature List

The portal URL is: `/portal/[token]`
No login. Read-only. Shareable within the client org.
All pending sign-offs show "Check your email" — no action possible from here.

### Portal overview tab
- Pending sign-offs banner (if any): "X items awaiting your sign-off — check your email"
- 4 stat cards: Overall progress %, Milestones done, Decisions signed, Awaiting sign-off
- Progress bar with phase labels (Initiation → Requirements → Design → Dev → UAT → Go-live)
  Each phase colours based on completion state
- Recent milestones (last 5): shows status, type label, date, pending email note if awaiting
- Recent decisions (last 3): ref number, title, status

### Portal milestones tab
- Full timeline of all milestones
- Internal milestones shown but labelled "Internal" — no detail beyond title and status
- Client gate milestones show full detail including what sign-off means
- Pending sign-offs show: "Approval link sent to s***@nexus.com · Check your email"
  (email is masked — shows first char + *** + @domain)
- Completed milestones show: signed by name, date
- Regressions visible: "UAT Cycle 1 → regression → Dev Cycle 2" with dates and reason
- Delay indicators: "11-day delay · Client side" or "4-day delay · Team side"

### Portal decisions tab
- All decisions in reverse chronological order
- Reference number, title, status
- Signed decisions: "Signed by Sarah Chen · 2 May 2025 at 11:14"
- Pending decisions: "Approval link sent to r***@nexus.com · Check your email"
- Amended decisions show: "Amended by #D-012" badge
- No ability to create, edit, or action anything

### Portal documents tab
- All documents grouped by phase
- Two filter buttons: "All", "By NuAIg", "By [ClientName]"
- Each document shows: name, file type icon, date shared, who shared it (by name, not "team")
- Download button for every document (generates a short-lived signed URL from Supabase Storage)
- No upload, no delete, no rename

---

## Sign Page — Full Feature List

The sign URL is: `/sign/[approvalToken]`
Accessed only via email. One-time link per person.

### States of the sign page

**Pending (can sign)**
- Aligned logo + project name
- Type badge: "Decision approval" or "Milestone sign-off"
- Title of the decision or milestone
- Full description
- Date sent + sent by NuAIg
- Attached documents list (if any) with view links
- Disclaimer box (amber): full authorisation warning with client name
- Identity box: "You are signing as [Name] ([email])" with initials avatar
- Note: "This link was sent directly to [email]. If you are not [Name], do not proceed."
- Concern toggle: "Have a concern before signing? Add a note"
  - Reveals text area when clicked
  - "Send concern only" button — sends concern to NuAIg team, does NOT sign
  - "Confirm & sign" button — signs the approval (with or without concern text)
- Footer: "This is a secure sign-off link for [email] only."

**Already signed (by this person)**
- Green confirmation box: "✓ Already signed"
- "Signed by [Name] on [Date at Time]"
- No action buttons

**Superseded (someone else signed first)**
- Amber information box: "This item has already been signed"
- "Signed by [Other Name] on [Date at Time]"
- No action buttons

**Expired (if expiry is set)**
- Neutral box: "This approval link has expired"
- "Please contact NuAIg to request a new link"

---

## Email Notifications

All emails sent from: `NuAIg Aligned <noreply@yourdomain.com>`

### Approval request email
- Sent when: NuAIg sends an approval link
- To: each selected recipient individually
- Subject: "Your sign-off is needed — [Project Name]"
- Content: project name, decision/milestone title (in a highlighted box),
  "Review & sign" CTA button, authorisation note at bottom
- Each recipient gets their own unique link

### Nudge reminder email
- Sent when: approval still pending after 3 days, up to 3 times
- To: same recipient as original
- Subject: "Reminder: sign-off still needed — [Project Name]"
- Content: friendly tone, decision/milestone title, "Review & sign" button
- Shows nudge count: "Reminder 1 of 3"

### Concern notification email
- Sent when: a recipient submits a concern on the sign page
- To: NuAIg team email
- Subject: "Concern raised on [Project Name] — review needed"
- Content: who raised it, their email, which item, the full concern text
- NuAIg team then decides how to handle it before the client signs (or doesn't)

---

## Audit Trail & Data Integrity

### What cannot be deleted
- Signed decisions
- Signed milestones and their sign-off records
- Approval link records (once signed or superseded)
- Former contacts
- Signed record PDFs

### What cannot be edited after signing
- Decision title, description, ref number
- Milestone title once sign-off is recorded
- Any field in a `milestone_signoffs` record

### What is permanently logged on every sign-off
- Name of signer (as set in the contact record)
- Email of signer
- Timestamp (ISO 8601, stored in UTC)
- IP address
- User agent (browser/device)
- The specific approval link token used

### Amendment trail
When a signed decision changes:
- Original decision stays as-is, status changes to "Amended"
- New amendment decision created, linked via parent_id
- Amendment requires its own sign-off
- UI shows the full chain: D-005 → Amended by D-008

---

## Database Schema Summary

### Tables
- `clients` — client organisations
- `client_contacts` — contacts at client or project level
- `projects` — one per engagement, has portal_token
- `milestones` — timeline items, typed and phased
- `decisions` — numbered per project, amendment chain via parent_id
- `approval_links` — one per recipient per approval, has unique token
- `documents` — files in Supabase Storage, linked to project/phase/milestone/decision
- `milestone_signoffs` — immutable audit log of every milestone sign-off
- `team_members` — extends Supabase Auth users

### Key constraints
- `approval_links.token` — unique, 32 random bytes hex
- `projects.portal_token` — unique, 32 random bytes hex
- `decisions(project_id, ref_number)` — unique pair (ref numbers per project)
- All sign-off records have RLS disabled for direct inserts (service role only)
- Team members have full RLS access via authenticated session
- Portal and sign routes use service role key server-side (never exposed to browser)

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
NEXTAUTH_SECRET
CRON_SECRET                      ← protects the nudge cron endpoint
```

---

## What Is Already Built (in the zip)

- Full database schema with RLS (`supabase/migrations/001_initial_schema.sql`)
- All TypeScript types (`types/index.ts`)
- Supabase client helpers — browser, server, service role (`lib/supabase/client.ts`)
- Auth middleware — protects `/dashboard`, allows portal and sign routes
- Mobile block — all routes blocked below 768px
- Login page
- Dashboard layout with sidebar navigation
- Dashboard overview page
- Projects list page
- Project detail hub page
- Client portal layout (token validation)
- Client portal overview page
- Sign page — server (validates state) + client form (handles submission)
- API: send approval links (`/api/approvals/send`)
- API: sign an approval (`/api/approvals/sign`)
- API: raise a concern (`/api/approvals/concern`)
- API: nudge cron (`/api/nudge`)
- Email templates — approval request, nudge reminder, concern notification
- Global CSS with full design system tokens
- Utility functions

## What Needs To Be Built Next (in order)

1. Clients list page
2. Client detail + contact management page
3. New project form
4. Milestones management page (dashboard) + send for sign-off modal
5. Decisions management page (dashboard) + send for approval modal
6. Document upload + vault (dashboard)
7. Portal: milestones tab
8. Portal: decisions tab
9. Portal: documents tab with download URLs
10. PDF generation for signed records (auto-attach to documents)
11. Vercel cron config (`vercel.json`) for nudge job
12. Decision export as PDF (full decision log)

