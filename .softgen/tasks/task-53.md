---
title: Stripe-only country pricing flow
status: in_progress
priority: urgent
type: feature
tags:
  - subscription
  - stripe
  - billing
  - currency
created_by: agent
created_at: 2026-04-24
position: 53
---

## Notes
Enhance the subscription system so Stripe is the only payment gateway for all countries.

Country pricing remains editable in the country-specific subscription page files, but checkout must enforce strict currency matching and exact smallest-unit amounts before a Stripe session is created.

Current flow already has country pages for UAE and Philippines and uses Stripe checkout. The next change must remove any remaining alternative gateway logic and centralize billing safety checks.

Evidence gathered:
- `src/config/countrySubscription.ts` still exposed non-Stripe payment provider types
- `src/pages/api/stripe/checkout.ts` previously trusted request amounts and converted with a generic `amount * 100`
- `src/pages/api/stripe/verify.ts` previously activated subscriptions from Stripe totals without checking a stored billing snapshot

Implementation in progress:
- shared billing helpers now normalize subscription currency, format currency display, and convert to Stripe smallest units
- checkout now creates a billing snapshot before Stripe session creation
- checkout now blocks invalid currency, invalid amount, and amount mismatches before creating a session
- configuration is now Stripe-only for supported countries

## Checklist
- [x] Inspect current country pricing pages, checkout API, verification flow, and any remaining alternate payment references
- [x] Add shared Stripe billing helpers for currency normalization, smallest-unit conversion, and display formatting
- [x] Enforce backend validation for amount, currency, and country-priced plan inputs before Stripe checkout is created
- [x] Remove or stop using any remaining non-Stripe payment gateway paths in the subscription flow
- [ ] Validate checkout requests use exact country price and currency values without silent conversion

## Acceptance
All subscription payments use Stripe only.
Checkout creation blocks invalid or mismatched currency requests.
Country-specific pricing remains directly editable in the UAE and Philippines page files.