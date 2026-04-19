---
title: Stripe Integration
status: in_progress
priority: high
type: feature
tags: [billing, stripe, backend]
created_by: agent
created_at: 2026-04-19T10:40:00Z
position: 14
---

## Notes
The user has a Stripe account and wants to connect the existing billing/subscription system to Stripe.
Packages `@stripe/stripe-js` and `stripe` are already installed.

## Checklist
- [ ] Add `stripe_customer_id` and `stripe_subscription_id` to the `subscriptions` table.
- [ ] Create `src/pages/api/stripe/checkout.ts` to handle creating checkout sessions.
- [ ] Create `src/pages/api/stripe/portal.ts` to handle creating billing portal sessions.
- [ ] Create `src/pages/api/stripe/webhook.ts` to handle Stripe webhooks and update DB.
- [ ] Update `src/pages/pricing.tsx` to redirect to the Stripe Checkout API endpoint.
- [ ] Update `src/pages/subscription.tsx` to redirect to the Stripe Portal API endpoint.

## Acceptance
- The database schema supports Stripe references.
- API endpoints for Stripe are fully implemented.
- Pricing page successfully directs users to Stripe Checkout.
- Subscription page allows users to manage their billing via Stripe Portal.