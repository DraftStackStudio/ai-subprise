# Security — AI Subprise

## Secret Handling
- Supabase `service_role` key never exposed to the browser — server-side only
- Only `anon` public key used in the Next.js client
- Logo fetch (Clearbit) done server-side via Next.js API route; no third-party API keys in frontend

## Permission Model
- **v1 (demo):** RLS v1 permissive policies — all rows readable and writable without auth; safe for demo only
- **Sprint 3 (lock-down):** Replace with `auth.uid() = user_id` policies on all tables; every insert sets `user_id = auth.uid()`; users see only their own data
- No row is ever readable by another user post-lock-down

## Approved Tools Rule
Agents and server actions may only call explicitly named, scoped functions (`fetch_tool_logo`, `suggest_category`). No `eval`, no dynamic SQL, no `run_any` patterns.

## Audit Principle
- Every meaningful write action (create/update/delete/archive) appends a row to `audit_logs`
- Audit rows are insert-only — no update or delete policy on `audit_logs`
- Agent actions include `agent: true` in the payload

## Data Sensitivity
- v1 stores no passwords, no payment details, no email credentials
- Email addresses stored are user-typed labels only — no OAuth tokens, no inbox access