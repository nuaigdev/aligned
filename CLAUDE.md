# Aligned — CLAUDE.md

This file gives Claude Code full context to continue building Aligned.
Read this entirely before making any changes.

---

## What this product is

Aligned is an internal project management platform built by **NuAIg** for managing
client projects. The core problem it solves: clients say "we never agreed to that" or
"we don't remember that decision." This platform creates an auditable, signed record of
every decision and milestone, with a read-only portal for clients.

---

## Key design decisions (do not change without good reason)

### Access model — three distinct surfaces

| Surface | Who | How accessed | Can sign? |
|---|---|---|---|
| `/dashboard/*` | NuAIg team | Supabase Auth (email + password) | N/A |
| `/portal/[token]` | Client org | Permanent token URL (no login) | **No** |
| `/sign/[approvalToken]` | Named individual | One-time email link | **Yes** |

The portal is **read-only**. Clients cannot sign anything from the portal.
Signing only happens via email links sent to named recipients.
This is intentional and must not be changed.

### Documents — no signing, just attribution

Documents are tagged as shared **"By NuAIg"** or **"By [ClientName]"**.
There is no signing on documents. Formal approval happens at the milestone and
decision level, not on individual files.

### Approval flow — first signer locks it

When multiple recipients receive approval links for the same decision/milestone,
the **first person to sign locks it**. All other pending links are marked `superseded`.
Others who open their link see who already signed, with timestamp.

### Mobile — blocked entirely

The platform displays a "Desktop only" message on viewports below 768px.
This applies to ALL routes including the portal and sign page.
Do not remove the mobile block from `app/layout.tsx`.

### Milestone types

- `client_gate` — requires client sign-off before project can proceed
- `internal` — NuAIg owns it, client can view but no action needed
- `informational` — auto-notifies client, no action

Regression (e.g. UAT fails, goes back to dev) is handled by re-opening a milestone
and incrementing `iteration`. The old iteration is kept in history with `parent_id`.
Do not delete milestone records — always create new iterations.

### Contact management

Contacts exist at two levels:
1. **Client level** (`project_id = null`) — default contacts inherited by all projects
2. **Project level** (`project_id = <id>`) — additions for a specific project

When sending approval links, always pick from the project's effective contact list
(client defaults + project-specific additions).

---

## Tech stack

| Layer | Tool | Notes |
|---|---|---|
| Framework | Next.js 14 (App Router) | Server Components where possible |
| Database | Supabase (PostgreSQL) | See migration file |
| Auth | Supabase Auth | Team only — clients don't have accounts |
| Storage | Supabase Storage | Buckets: `project-documents`, `signed-records` |
| Email | Resend | See `lib/email/index.ts` |
| PDF | @react-pdf/renderer | For signed record generation (not yet built) |
| Deployment | Vercel | Free tier |
| Styling | Tailwind CSS + inline styles | See design system below |

---

## Environment variables

Copy `.env.local.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   ← never expose to client
RESEND_API_KEY=
RESEND_FROM_EMAIL=
RESEND_FROM_NAME=NuAIg Aligned
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_COMPANY_NAME=NuAIg
NEXTAUTH_SECRET=
CRON_SECRET=                 ← for nudge API route
```

---

## Database setup

Run `supabase/migrations/001_initial_schema.sql` in your Supabase SQL editor.

Then create storage buckets manually in the Supabase dashboard:
- `project-documents` (private)
- `signed-records` (private)

Then create your first team member:
1. Sign up via Supabase Auth dashboard (Authentication > Users > Add user)
2. Copy the generated UUID
3. Insert into `team_members`: `INSERT INTO team_members (id, name, email, role) VALUES ('uuid-here', 'Your Name', 'you@nuaig.com', 'admin');`

---

## Project structure

```
app/
  dashboard/              ← NuAIg team views (auth required)
    page.tsx              ← Overview / home
    layout.tsx            ← Sidebar layout
    clients/              ← Client list + client detail
    projects/             ← Project list + project detail
      [projectId]/
        page.tsx          ← Project hub (stats, quick nav)
        milestones/       ← Milestone management (TODO)
        decisions/        ← Decision management (TODO)
        documents/        ← Document vault (TODO)
        contacts/         ← Project contact management (TODO)

  portal/[token]/         ← Client read-only view
    page.tsx              ← Overview tab
    milestones/           ← Full milestone list (TODO)
    decisions/            ← Full decision list (TODO)
    documents/            ← Document vault with download (TODO)

  sign/[approvalToken]/   ← Sign-off page (email link destination)
    page.tsx              ← Server: validates token, shows state
    SignForm.tsx           ← Client: handles sign submission

  api/
    approvals/
      send/route.ts       ← POST: send approval emails to recipients
      sign/route.ts       ← POST: process a signature
      concern/route.ts    ← POST: log a concern from sign page
    nudge/route.ts        ← GET: cron job for nudge reminders

components/
  dashboard/
    Sidebar.tsx           ← Nav sidebar (built)
  portal/                 ← Portal-specific components (TODO)
  shared/                 ← Shared across dashboard + portal (TODO)

lib/
  supabase/client.ts      ← Browser, server, and service role clients
  email/index.ts          ← Resend email helpers
  pdf/                    ← PDF generation (TODO)
  utils/index.ts          ← Formatting, helpers

types/index.ts            ← All TypeScript types (mirrors DB schema)
middleware.ts             ← Auth guard for /dashboard routes
```

---

## What is built vs TODO

### Built
- [x] Database schema (full, with RLS)
- [x] TypeScript types
- [x] Supabase client helpers (browser, server, service role)
- [x] Auth middleware
- [x] Mobile block
- [x] Login page
- [x] Dashboard layout + sidebar
- [x] Dashboard overview page
- [x] Projects list page
- [x] Project detail page (hub)
- [x] Client portal layout (token validation)
- [x] Client portal overview page
- [x] Sign page (server + client form)
- [x] API: send approvals
- [x] API: sign approval
- [x] API: raise concern
- [x] API: nudge cron
- [x] Email templates (approval, nudge, concern)

### TODO (build in this order)
- [ ] Clients list page (`app/dashboard/clients/page.tsx`)
- [ ] Client detail + contact management (`app/dashboard/clients/[clientId]/page.tsx`)
- [ ] New project form (`app/dashboard/projects/new/page.tsx`)
- [ ] Milestones management page (dashboard)
- [ ] Decisions management page (dashboard)
- [ ] Document upload + vault (dashboard)
- [ ] Send approval UI (modal/dialog on milestone/decision pages)
- [ ] Portal: milestones tab
- [ ] Portal: decisions tab
- [ ] Portal: documents tab (with signed download URLs)
- [ ] PDF generation for signed records
- [ ] Vercel cron config for nudge (`vercel.json`)

---

## Design system

The UI matches the mockups designed in the planning phase. Key rules:

**Colors**
- Brand purple: `#534AB7` (primary actions, active nav, links)
- Brand light: `#EEEDFE` (backgrounds, pills)
- Success: green `#3B6D11` / `#EAF3DE`
- Warning: amber `#633806` / `#FAEEDA`
- Danger: red `#A32D2D` / `#FCEBEB`
- Info: blue `#0C447C` / `#E6F1FB`
- Page bg: `#F1EFE8`
- Card bg: `#ffffff`
- Border: `rgba(0,0,0,0.1)` (0.5px)

**Typography**
- Font: Geist Sans (loaded via `geist` package)
- Body: 13-14px
- Labels/meta: 11-12px
- Page titles: 22px, weight 500
- No 600 or 700 weight — use 500 for bold

**Components**
- Cards: white bg, `border: 0.5px solid rgba(0,0,0,0.1)`, `border-radius: 10px`
- Pills/badges: 10px text, 2px/8px padding, 10px border-radius
- Buttons: brand purple for primary, light border for secondary
- No shadows, no gradients on UI chrome

**Layout**
- Dashboard: fixed sidebar (220px) + scrollable main
- Portal: centered column, max-width 860px
- Consistent 24px page padding

---

## Pill status reference (use consistently)

| State | Background | Text color |
|---|---|---|
| Completed / Signed | `#EAF3DE` | `#3B6D11` |
| Awaiting / Pending | `#FAEEDA` | `#633806` |
| Internal | `#F1EFE8` | `#888780` |
| Client sign-off | `#EEEDFE` | `#3C3489` |
| Info / Notified | `#E6F1FB` | `#0C447C` |
| Not started | `#F1EFE8` | `#888780` |

---

## Important rules for Claude Code

1. **Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client.** It is used only in
   API routes and server-only code. Always check before adding it to any client component.

2. **Portal routes use service role client** (to bypass RLS and access project data
   via token). Dashboard routes use the authenticated server client.

3. **Don't add auth to portal or sign routes.** They are intentionally public.
   Security comes from the token being hard to guess (32 random bytes).

4. **Always use `createServiceRoleClient()` in API routes** that handle sign-offs,
   since these are called by unauthenticated users (client recipients).

5. **Use Server Components by default.** Only add `'use client'` when you need
   interactivity (forms, onClick, useState, etc.).

6. **Keep the sign page simple and trustworthy.** It's what clients see when they
   receive an email. No clutter, no extra navigation, clear identity confirmation.

7. **Milestone regressions: never delete, always iterate.** Set `parent_id` to the
   previous milestone, increment `iteration`, set status back to `in_progress`.

8. **Document uploads go to Supabase Storage** `project-documents` bucket.
   Use the service role client in the upload API route. Store the `storage_path`
   in the `documents` table. Generate signed URLs on the fly for downloads (1hr expiry).

9. **The nudge cron** (`/api/nudge`) requires `Authorization: Bearer <CRON_SECRET>`
   header. Set `CRON_SECRET` in env. Configure in `vercel.json` for production.

10. **Company name is NuAIg.** In all UI copy, emails, and labels, use "NuAIg" not
    "Momentum Studio" or any placeholder. The client's company name comes from the
    `clients.name` field in the database.
