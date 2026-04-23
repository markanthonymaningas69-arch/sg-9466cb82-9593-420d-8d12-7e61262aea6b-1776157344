---
title: Country-specific subscription flow
status: in_progress
priority: high
type: feature
tags:
  - subscription
  - billing
  - country
  - payments
created_by: agent
created_at: 2026-04-23
position: 31
---

## Notes
Build a country-specific subscription architecture so the subscription page behavior can change by selected account country. Philippines should activate a dedicated subscription experience with Peso currency and a non-Stripe payment path, while UAE keeps the current Stripe-based flow. The structure should make it easy to add more countries later.

GCash payment details have not been provided yet, so the Philippines payment action should be implemented in a configurable way and remain safe when no payment URL is configured.

Follow-up: switch the Philippines payment path from a generic manual link to a PayMongo-powered GCash checkout flow using environment variables. Use secure server-side handling only and keep the architecture ready for more country/payment providers later.

Latest feedback: after a successful PayMongo payment, the subscription is not being activated and the account remains in trial. Add the missing subscription persistence/verification flow and provide the webhook URL path for PayMongo configuration.

## Checklist
- [x] Add shared country payment/subscription configuration for future country expansion
- [x] Update subscription page to branch by active account country
- [x] Activate a Philippines-specific subscription experience with Peso display
- [x] Keep add-on numeric values the same and only switch currency presentation for Philippines
- [x] Route UAE users through the current payment flow and isolate Philippines from Stripe checkout
- [x] Validate the subscription page compiles cleanly
- [x] Add PayMongo configuration that reads secure environment variables
- [x] Create a server-side PayMongo checkout endpoint for Philippines GCash payments
- [x] Connect the Philippines subscription action to the PayMongo checkout flow
- [x] Revalidate the subscription flow after PayMongo integration
- [ ] Trace the successful PayMongo payment path and identify why the subscription record is not updated
- [ ] Add a server-side PayMongo webhook handler that activates the subscription after confirmed payment
- [ ] Update the subscription page to reflect successful PayMongo payments correctly
- [ ] Provide the webhook URL path the user should paste into PayMongo
- [ ] Revalidate the Philippines payment success flow

## Acceptance
When the active country is Philippines, the subscription page shows the Philippines-specific flow with Peso currency.
When the active country is UAE, the current subscription flow remains available.
The architecture supports adding more country-specific payment flows later without rewriting the page.