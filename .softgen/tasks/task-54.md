---
title: Subscription billing snapshot
status: todo
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

## Checklist
- [ ] Inspect existing subscription-related database tables and current verification persistence
- [ ] Add any required database fields or a dedicated snapshot table using Supabase
- [ ] Update checkout and success handling to persist and read the final subscription snapshot
- [ ] Ensure active subscriptions keep their original snapshot even if the user later changes country

## Acceptance
Each subscription checkout stores an immutable plan snapshot with amount, currency, and country.
Billing uses the stored snapshot values instead of recalculating pricing at payment time.
Country changes do not retroactively change active subscription pricing.