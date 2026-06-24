# Data Model — AI Subprise

## email_accounts
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| user_id | uuid | nullable until auth sprint |
| email_address | text | required |
| label | text | Personal / Work / Custom |
| colour | text | hex colour string, 1 of 10 presets |
| created_at | timestamptz | default now() |

## ai_tools
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | nullable until auth sprint |
| name | text | required |
| logo_url | text | user-supplied URL or auto-fetched |
| category | text | LLM, Image Gen, Video Gen, Audio, Coding, Productivity, Other |
| status | text | Free \| Paid \| Trial |
| billing_type | text | Monthly \| Yearly \| Lifetime — null if Free/Trial |
| trial_expiry_date | date | null unless status = Trial |
| is_favourite | boolean | default false |
| is_archived | boolean | default false |
| notes | text | freeform |
| created_at | timestamptz | |

## tool_email_links
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | nullable until auth sprint |
| tool_id | uuid FK | → ai_tools(id) cascade delete |
| email_account_id | uuid FK | → email_accounts(id) cascade delete |
| slot_order | integer | 1 = primary, 2 = secondary, 3 = tertiary |
| created_at | timestamptz | |

## AI Fields (future)
If category or tool name is auto-suggested: store `value`, `source` (e.g. `clearbit`), `confidence` (0–1 numeric), `review_status` (default `unreviewed`).

## RLS
- v1: permissive read + write for all tables (demo-first)
- Sprint 3: replace with `auth.uid() = user_id` owner policies