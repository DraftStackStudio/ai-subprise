# Intelligence Layer — AI Subprise

## What's Messy at Input
- Users may not know a tool's category → needs suggestion
- Trial expiry dates are easy to forget → needs surfacing
- Logo URLs require manual lookup → can be fetched by domain

## Auto-Structure (Rule-Based, v1)
```json
{
  "tool_name": "Runway ML",
  "inferred_category": "Video Generation",
  "inferred_category_source": "name_keyword_match",
  "inferred_category_confidence": 0.85,
  "inferred_category_review_status": "unreviewed",
  "logo_url": "https://logo.clearbit.com/runwayml.com",
  "logo_source": "clearbit_domain",
  "logo_confidence": 0.9,
  "logo_review_status": "unreviewed"
}
```

## Events to Track
- Tool added (status, category, email count)
- Trial expiry date set
- Tool archived
- Favourite toggled
- Filter used (which filter type)

## Scoring Rules (v1, rule-based)
- **Expiry urgency score** = `(trial_expiry_date - today)` in days; highlight ≤ 7 days
- **Coverage score** per email = tools linked / total tools (shows which email is most used)

## What Gets Ranked / Surfaced
- Trial tools expiring within 7 days → banner on dashboard
- Recently added tools → "Recently Added" section
- Email account with most tools → highlighted in email accounts list

## v1 vs Later
- **v1:** Rule-based urgency flag, domain logo fetch, keyword category suggestion
- **Later:** LLM-powered category inference, inbox scanning for auto-detection, spending estimation