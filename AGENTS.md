## UI/UX constraints

- Do NOT add horizontal scroll/sliders to tables. If columns don't fit, ask before choosing a layout solution.
- Do NOT reorder or shift existing table columns without being asked.
- Match existing dark theme styling (colors, pill shapes, spacing) — don't introduce new visual patterns without checking first.

## Table alignment

- On ANY table with expandable multi-account rows (Favourites, Linked, and any future pages with this pattern):
  - Every column in expanded sub-rows (account name/email, plan pill, status, action links) must horizontally align under their respective column headers — matching single-account rows.
  - Row height must match standard rows exactly (54px) — no extra vertical padding on expanded sub-rows.
- This pattern has regressed multiple times across different pages. After any change touching these tables, verify BOTH alignment and row height, not just one or the other.
