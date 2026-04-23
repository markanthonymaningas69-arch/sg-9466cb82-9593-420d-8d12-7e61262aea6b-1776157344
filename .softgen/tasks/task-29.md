---
title: Country-based pricing
status: done
priority: high
type: feature
tags:
  - pricing
  - billing
  - country
created_by: agent
created_at: 2026-04-23
position: 29
---

## Notes
Implement country-based pricing for supported countries. UAE keeps the existing pricing. Philippines should use Starter 299/month and Professional 499/month. Unsupported countries should not be allowed to continue account creation, and pricing-related flows should respect the selected or stored country.

Latest feedback: implement the exact pricing behavior now using the values the user specified.

## Checklist
- [x] Add country-aware pricing configuration for UAE and Philippines
- [x] Update pricing page display to use selected country pricing
- [x] Update subscription page totals to use the account country
- [x] Update checkout API flow to enforce supported countries and correct pricing
- [x] Validate pricing and billing flows
- [x] Verify the current UAE pricing values in the shared pricing config
- [x] Enforce Philippines monthly pricing: Starter 299, Professional 499
- [x] Verify pricing display and checkout use the same country-based values
- [x] Revalidate the billing flow after the pricing update

## Acceptance
UAE users see the existing pricing.
Philippines users see Starter 299/month and Professional 499/month.
Pricing shown in the app matches the selected or stored country.