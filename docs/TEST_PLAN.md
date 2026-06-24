# Test Plan — AI Subprise

## Success Scenario (Manual Walkthrough)
1. Open app root `/` — seed demo tools table renders; no login prompt.
2. Click **Add Email Account** → enter `test@work.com`, label `Work`, colour `amber` → Save.
   - ✅ New row appears in sidebar with amber dot and label "Work"; tool count = 0.
3. Click **Add AI Tool** → enter name `Claude`, category `LLM`, logo URL, status `Paid`, billing `Monthly`, no trial expiry.
   - Select `test@work.com` as primary email → Save.
   - ✅ Claude appears in tools table with amber chip; dashboard "Paid" count increments by 1.
4. Click **Add AI Tool** → name `Runway ML`, category `Video Generation`, status `Trial`, expiry `2025-08-03`, link `aitest2024@gmail.com`.
   - ✅ Tool appears in table with red email chip and trial expiry date.
5. Type `Runway` in search box → ✅ Only Runway ML visible in table.
6. Clear search; apply filter **Status = Trial** → ✅ Only trial tools shown.
7. Apply filter **Email = test@work.com** → ✅ Only Claude shown.
8. Click favourite star on Claude → ✅ Star fills; dashboard "Favourites" count increments.
9. Click **Archive** on Runway ML → ✅ Tool moves to archived; active count decrements.
10. Switch filter to **Archived** → ✅ Runway ML reappears with archived badge.

## Empty State Tests
- Delete all tools → table shows "No AI tools yet. Add your first tool." CTA.
- Delete all email accounts → sidebar shows "No email accounts yet. Add one to get started."

## Error State Tests
- Submit Add Tool form with no name → ✅ Inline validation error "Tool name is required".
- Submit Add Email form with invalid email format → ✅ "Enter a valid email address".
- Simulate Supabase offline (disable network) → ✅ Toast error "Could not save. Please try again."

## Edge Cases
- Add a tool with no email linked → ✅ Renders in table with empty email chip area.
- Add 3 email accounts to one tool → ✅ All 3 colour chips shown.
- Attempt to add a 4th email link to one tool → ✅ "Maximum 3 email accounts per tool" message shown.
- Trial expiry date in the past → ✅ Expiry cell renders in red.