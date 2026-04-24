---
title: Country-specific subscription pages
status: todo
priority: high
type: feature
tags:
  - subscription
  - billing
  - stripe
created_by: agent
created_at: 2026-04-24
position: 51
---

## Notes
Separate the subscription page per country (initially UAE and Philippines).
Keep ONLY Stripe as the payment method. Remove local payment providers from these flows.
Prices and currencies must be directly editable in the respective country files (e.g. UAE page handles AED, PH page handles PHP).

## Checklist
- [ ] Inspect current `subscription.tsx` and `src/pages/api/stripe/checkout.ts`
- [ ] Update `api/stripe/checkout.ts` to support dynamic `price_data` so prices can be edited from the frontend files
- [ ] Move/Convert `src/pages/subscription.tsx` into a country selector (or redirect page)
- [ ] Create `src/pages/subscription/uae.tsx` with UAE pricing (AED) and Stripe integration
- [ ] Create `src/pages/subscription/ph.tsx` with PH pricing (PHP) and Stripe integration
- [ ] Verify Stripe checkout works with the dynamic pricing and currency
- [ ] Clean up any unused PayMongo references in the new subscription flows

## Acceptance
User can visit /subscription and select UAE or Philippines.
Each country page has its own editable pricing and currency.
Payment uses Stripe exclusively for all countries.