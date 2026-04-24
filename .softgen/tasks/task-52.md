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

Evidence gathered:
- `src/pages/subscription.tsx` still linked manually to `/subscription/uae` and `/subscription/ph`
- `src/config/countrySubscription.ts` still had Philippines configured for PayMongo
- no existing `navigator.language` detection was present in the codebase

Implementation:
- `/subscription` now auto-detects country from browser locale and timezone
- supported detections route to UAE or Philippines automatically
- unsupported detections fall back safely to the Philippines subscription page
- Philippines config now matches the Stripe-only flow used by UAE

Follow-up bug:
- disable the Proceed to Checkout button when no plan or billable items are selected so users cannot trigger an empty checkout error

## Checklist
- [x] Inspect the current subscription root page and country pages
- [x] Identify available country or locale detection sources already present in the app
- [x] Replace the manual region selector with automatic country routing
- [x] Keep UAE and Philippines pages directly editable for pricing and currency
- [ ] Disable checkout when no plan or add-ons are selected
- [ ] Validate the subscription flow and fallback behavior

## Acceptance
Users are not asked to manually choose a country on the subscription page.
The subscription page automatically routes supported users to the correct country-specific page.
Proceed to Checkout stays disabled until a valid plan or billable items are selected.
UAE and Philippines pricing remain editable in their own page files.