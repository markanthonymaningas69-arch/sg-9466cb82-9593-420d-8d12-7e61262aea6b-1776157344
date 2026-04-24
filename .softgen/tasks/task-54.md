---
title: Subscription billing snapshot
status: in_progress
priority: high
type: feature
tags:
  - subscription
  - snapshot
  - database
  - stripe
created_by: agent
created_at: 2026-04-24
position: 54
---

## Notes
Store a final subscription pricing snapshot when the user selects a plan and uses checkout.

The snapshot must include user_id, plan_id, price_amount, currency_code, and country. Checkout should rely on these exact values instead of recalculating plan price from other sources during payment.

Implementation in progress:
- added `subscription_billing_snapshots` in Supabase with user, plan, amount, currency, country, billing cycle, Stripe session id, status, and features
- checkout now creates a pending immutable snapshot before creating the Stripe session
- verification now reads the stored snapshot and validates session currency and amount against it before activating the subscription

## Checklist
- [x] Inspect existing subscription-related database tables and current verification persistence
- [x] Add any required database fields or a dedicated snapshot table using Supabase
- [x] Update checkout and success handling to persist and read the final subscription snapshot
- [ ] Ensure active subscriptions keep their original snapshot even if the user later changes country

## Acceptance
Each subscription checkout stores an immutable plan snapshot with amount, currency, and country.
Billing uses the stored snapshot values instead of recalculating pricing at payment time.
Country changes do not retroactively change active subscription pricing.