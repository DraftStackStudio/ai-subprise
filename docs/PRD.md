# Product Requirements — AI Subprise

## Problem
Power users of AI tools sign up across dozens of services using multiple email addresses. Over time they lose track of which email is linked to each tool, whether they're on a free, paid, or trial plan, and where charges are coming from.

## Target User
AI enthusiasts, prompt engineers, content creators, freelancers, and students managing 10–50+ AI tools across 2–5 email accounts.

## Core Objects
- **Email Account** — address, label, colour tag, linked-tool count
- **AI Tool** — name, logo, category, status, billing type, trial expiry, favourite flag, active/archived flag, notes
- **Tool-Email Link** — joins a tool to one or more email accounts (up to 3), ordered by slot

## MVP Checklist (v1 Must-Haves)
- [ ] Add / edit / delete email accounts with colour tags
- [ ] Add / edit / delete AI tools with all fields
- [ ] Link up to 3 email accounts per tool
- [ ] Set status: Free, Paid, Trial; billing type for Paid; expiry date for Trial
- [ ] Favourite and Archive toggles
- [ ] Dashboard summary cards (totals per status, favourites, recent tools)
- [ ] Searchable, filterable tools table (name, category, email, status, archived)
- [ ] App renders with seed data — no login required in v1

## Non-Goals (v1)
Gmail/Outlook integration, AI-powered detection, billing reminders, team sharing, password storage, browser extension, non-AI software.

## Success Scenario
A user with 30 AI tools opens the app, adds their 3 email accounts with colour tags, adds ChatGPT linked to their personal email as Paid/Monthly, adds Runway linked to their test email as Trial expiring 2025-08-03, then filters the table by "Trial" status and immediately sees both trial tools with their expiry dates and linked email colour chips — without touching their inbox.