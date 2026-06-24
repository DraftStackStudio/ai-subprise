# Agentic Layer — AI Subprise

v1 is fully manual — no autonomous actions. This doc sets the safe boundary for future automation.

## Risk Levels & Actions

### Low Risk — Auto-execute (no approval needed)
- Fetch tool logo from Clearbit/favicon by domain name
- Suggest category from tool name keyword matching
- Flag trial tools expiring within 7 days (read-only badge)

### Medium Risk — Show draft, user confirms
- Bulk-import tools from CSV: preview parsed rows before insert
- Auto-assign a colour tag to a new email account based on label (e.g. Work → amber)

### High Risk — Always requires explicit approval
- Bulk delete all archived tools
- Re-link a tool to a different email account (overwrite existing links)

### Critical — Human only, never automated
- Delete an email account (cascades to all tool links)
- Purge all user data

## Named Tools (approved, v1)
- `fetch_tool_logo(domain: string) → url` — Clearbit Logo API
- `suggest_category(tool_name: string) → category` — local keyword map

## Audit Log Fields
| Field | Type |
|---|---|
| id | uuid |
| user_id | uuid |
| action | text (e.g. `tool.created`, `tool.archived`, `link.added`) |
| object_type | text |
| object_id | uuid |
| payload | jsonb |
| created_at | timestamptz |

## v1 vs Later
- **v1:** Logo fetch + category suggestion only
- **Later:** CSV bulk import with preview, inbox scanning agent (high-risk, approval-gated)