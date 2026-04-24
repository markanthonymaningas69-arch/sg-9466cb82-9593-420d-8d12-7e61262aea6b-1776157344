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

## Checklist
- [ ] Inspect current country pricing pages, checkout API, verification flow, and any remaining alternate payment references
- [ ] Add shared Stripe billing helpers for currency normalization, smallest-unit conversion, and display formatting
- [ ] Enforce backend validation for amount, currency, and country-priced plan inputs before Stripe checkout is created
- [ ] Remove or stop using any remaining non-Stripe payment gateway paths in the subscription flow
- [ ] Validate checkout requests use exact country price and currency values without silent conversion

## Acceptance
All subscription payments use Stripe only.
Checkout creation blocks invalid or mismatched currency requests.
Country-specific pricing remains directly editable in the UAE and Philippines page files.