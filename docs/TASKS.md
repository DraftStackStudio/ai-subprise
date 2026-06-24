# Tasks & Sprints — AI Subprise

## Sprint 1 — Database + Core CRUD (Demo-First)
**Goal:** Every form persists to Supabase; app renders seed data without login.

- [ ] Apply migration SQL (email_accounts, ai_tools, tool_email_links + RLS v1 policies)
- [ ] Seed 4 demo email accounts and 6 demo AI tools with links
- [ ] Add / Edit / Delete Email Account form (address, label, colour picker from 10 presets)
- [ ] Add / Edit / Delete AI Tool form (name, logo URL, category, status, billing type, trial expiry, notes)
- [ ] Favourite toggle and Archive toggle — persist to DB
- [ ] Link email accounts to a tool (multi-select, up to 3, ordered slots)
- [ ] Loading, empty, and error states on all forms and lists

**Definition of Done:** A new email account and a new AI tool can be created, linked, edited, and deleted; changes survive a page refresh.

---

## Sprint 2 — Dashboard + Tools Table ✅ v1 Functional
**Goal:** Full working product — the success scenario is completable end-to-end.

- [ ] Notion-style layout: left sidebar (Email Accounts list, nav links) + main area
- [ ] Dashboard summary cards: Total Tools, Email Accounts, Paid, Trial, Free, Favourites, Recently Added
- [ ] AI tools table: logo, name, category, linked email chips (colour-coded), status badge, billing, trial expiry, favourite star, archived badge
- [ ] Live search by tool name
- [ ] Filters: category, linked email, status (Free/Paid/Trial), active/archived
- [ ] Email accounts sidebar: shows name, colour dot, linked tool count
- [ ] Verify full scenario: add email → add tool → link email → view in table → filter by Trial

**Definition of Done:** A user with zero prior data can add 3 email accounts and 5 tools in under 5 minutes and answer "which email is linked to X?" instantly.

---

## Sprint 3 — Lock It Down (Auth + Per-User Isolation)
**Goal:** Each user sees only their own data.

- [ ] Enable Supabase Auth (email + password)
- [ ] Sign up / Log in / Log out pages
- [ ] Replace permissive RLS policies with `auth.uid() = user_id` owner policies on all tables
- [ ] All inserts set `user_id = auth.uid()`
- [ ] Unauthenticated requests redirect to /login
- [ ] /demo route keeps seed data publicly visible

**Definition of Done:** Two separate logged-in users cannot see each other's tools or email accounts.

---

## Sprint 4 — Trial Alerts + Polish
**Goal:** Surface expiring trials; improve onboarding and usability.

- [ ] Trial expiry banner: tools expiring within 7 days highlighted in dashboard
- [ ] Sort tools table by trial expiry (soonest first)
- [ ] CSV bulk import with parsed preview before insert
- [ ] Auto-fetch tool logo via Clearbit by domain (server-side API route)
- [ ] Mobile-responsive layout
- [ ] Empty-state screens (no tools yet, no email accounts yet)
- [ ] Audit log table (insert on every create/update/archive/delete)

**Definition of Done:** A user sees a warning for any trial expiring within a week without manually checking dates.

---

## Gantt (Sprint → Feature)
```
Sprint 1  |  DB schema · Email CRUD · Tool CRUD · Tool-email links
Sprint 2  |  Dashboard cards · Tools table · Search · Filters  ← v1 functional
Sprint 3  |  Auth · Sign up/in · Per-user RLS · /demo route
Sprint 4  |  Expiry alerts · CSV import · Logo fetch · Mobile · Audit log
```