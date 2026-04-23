---
title: Country-aware account creation
status: done
priority: high
type: feature
tags:
  - auth
  - signup
  - country
created_by: agent
created_at: 2026-04-23
position: 28
---

## Notes
Add country selection to account creation so users can be isolated in the database by country. Only UAE and Philippines are supported. If the selected country is not UAE or Philippines, account creation must not proceed and should show "The selected Country is out of Service". Save the selected country in profiles for downstream pricing and access rules.

## Checklist
- [x] Add country selector to the registration form
- [x] Block signup for unsupported countries with the required out-of-service message
- [x] Persist the selected country to the profiles table
- [x] Validate the signup flow and error handling

## Acceptance
Users can select a country during account creation.
Unsupported countries show "The selected Country is out of Service" and do not create an account.
The selected country is stored in the user's profile for later filtering and pricing.