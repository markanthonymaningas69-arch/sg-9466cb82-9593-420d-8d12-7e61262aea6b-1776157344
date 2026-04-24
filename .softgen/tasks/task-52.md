---
title: Automatic country subscription routing
status: in_progress
priority: high
type: feature
tags:
  - subscription
  - routing
  - country
  - stripe
created_by: agent
created_at: 2026-04-24
position: 52
---

## Notes
Remove the manual region selection from the subscription page.

The subscription flow should automatically choose the correct country-specific page based on the user's country. Initial supported countries remain UAE and Philippines.

Keep Stripe as the only payment method. Pricing must remain directly editable in each respective country file.

If the app cannot reliably detect a supported country, use a safe fallback path from the existing subscription flow instead of showing a broken experience.

## Checklist
- [ ] Inspect the current subscription root page and country pages
- [ ] Identify available country or locale detection sources already present in the app
- [ ] Replace the manual region selector with automatic country routing
- [ ] Keep UAE and Philippines pages directly editable for pricing and currency
- [ ] Validate the subscription flow and fallback behavior

## Acceptance
Users are not asked to manually choose a country on the subscription page.
The subscription page automatically routes supported users to the correct country-specific page.
UAE and Philippines pricing remain editable in their own page files.