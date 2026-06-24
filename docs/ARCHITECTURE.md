# Architecture — AI Subprise

## Stack
- **Frontend:** Next.js 14 (App Router) — Vercel
- **Database + Auth:** Supabase (Postgres, RLS, Supabase Auth in Sprint 3)
- **Styling:** Tailwind CSS + shadcn/ui
- **Storage:** Supabase Storage (tool logos, optional)

## Build Order
**Now:** Tables → CRUD forms → tools table with filters → dashboard cards
**Next:** Auth + per-user RLS → trial expiry alerts → CSV import
**Later:** Inbox integrations → AI auto-detection → notifications → team sharing

## Key User Action — Step by Step
1. User opens app (no login) → seed demo tools render immediately
2. User clicks "Add Tool" → form captures name, category, logo URL, status, billing, expiry, notes
3. User selects 1–3 email accounts from their saved list (colour-tagged)
4. On save: `ai_tools` row inserted → `tool_email_links` rows inserted per selected email
5. Dashboard re-queries aggregates; new tool appears at top of table with correct colour chips
6. User filters by "Trial" → table shows only trial tools with expiry dates highlighted

## Layer Plan
1. **Data first** — tables, relationships, RLS policies, seed data
2. **App logic** — CRUD actions, filter/search logic, favourite/archive toggles, count aggregates
3. **Smart features** — trial expiry warnings (rule: expiry ≤ 7 days), later AI auto-categorisation

## Core Runs Without AI
Every feature in v1 is pure user input + Postgres queries. No AI dependency. Smart features are additive.