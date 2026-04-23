---
title: Country-aware account creation
status: in_progress
priority: high
type: feature
tags:
  - auth
  - registration
  - country
  - pricing
created_by: agent
created_at: 2026-04-23
position: 28
---

## Notes
Add a required country selector to account creation so users can be segmented by country in the database. Supported countries are UAE and Philippines only. If the selected country is not UAE or Philippines, account creation must be blocked with the exact message: "The selected Country is out of Service". Persist the selected country to the database for the created user.

## Checklist
- [ ] Inspect the current signup flow and profile persistence
- [ ] Update the registration form to require a country selection
- [ ] Block signup for unsupported countries with the exact out-of-service message
- [ ] Save the selected country for supported users in the database
- [ ] Validate the registration flow end to end

## Acceptance
Users must choose a country during account creation.
Signup succeeds only for UAE and Philippines.
Unsupported countries show "The selected Country is out of Service" and do not create an account.