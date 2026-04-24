---
title: Stripe transaction logging
status: in_progress
priority: high
type: feature
tags:
  - subscription
  - logging
  - transactions
  - stripe
created_by: agent
created_at: 2026-04-24
position: 55
---

## Notes
Log all Stripe subscription transactions with user_id, plan_id, amount, currency, Stripe session ID, and country.

The logging should happen through the existing checkout and verification flow so successful billing records are consistent with the active subscription state.

Implementation in progress:
- added `stripe_subscription_transactions` in Supabase
- Stripe verification now inserts a transaction log tied to the immutable snapshot
- logged values use the snapshot amount, currency, country, and Stripe session id instead of recalculating from other sources

## Checklist
- [x] Inspect current subscription success flow and available transaction storage tables
- [x] Add database support for Stripe transaction logging if missing
- [x] Persist Stripe session identifiers and transaction records on successful checkout verification
- [ ] Validate logged values match the stored subscription snapshot exactly

## Acceptance
Successful subscription payments create transaction logs with the Stripe session ID and billing snapshot values.
Logged currency and amount match the exact subscription snapshot used for checkout.
The success flow activates the subscription and stores the Stripe transaction reference.