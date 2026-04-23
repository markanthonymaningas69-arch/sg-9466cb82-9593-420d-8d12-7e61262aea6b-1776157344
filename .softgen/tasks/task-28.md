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

Follow-up feedback: the signup screen currently shows the email field twice, and the country selector should show Asian country choices together with UAE and Australia while keeping the support rules intact.

Latest feedback: replace the country dropdown with a selector that allows typing and filters choices by the typed starting letters, keep the country field blank by default, and remove suggestion placeholders from the full name and email inputs.

## Checklist
- [x] Add country selector to the registration form
- [x] Block signup for unsupported countries with the required out-of-service message
- [x] Persist the selected country to the profiles table
- [x] Validate the signup flow and error handling
- [x] Remove the duplicated email input from the registration form
- [x] Update the country selector choices to show Asian countries, UAE, and Australia
- [x] Replace the country field with a searchable type-to-filter selector
- [x] Make the country field blank by default
- [x] Remove placeholder suggestions from the full name and email inputs
- [x] Revalidate the signup form behavior

## Acceptance
Users can select a country during account creation.
Unsupported countries show "The selected Country is out of Service" and do not create an account.
The selected country is stored in the user's profile for later filtering and pricing.