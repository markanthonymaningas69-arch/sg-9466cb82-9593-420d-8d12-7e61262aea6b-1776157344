---
title: Country-based currency engine
status: done
priority: high
type: feature
tags:
  - currency
  - country
  - pricing
created_by: agent
created_at: 2026-04-23
position: 30
---

## Notes
Apply a country-based currency engine across the system. When the active country is Philippines, user-facing currency values across modules should display in Peso. UAE should keep the current currency behavior. The implementation should use the active country already stored for the account and be reusable across pages instead of repeating custom formatters.

## Checklist
- [x] Inspect how the app currently formats currency across pricing and operational modules
- [x] Add a shared country-aware currency formatter/engine
- [x] Connect the formatter to the active account country
- [x] Update key modules and shared layouts to use the shared formatter
- [x] Validate the affected pages compile cleanly

## Acceptance
When the active country is Philippines, currency values in the system display in Peso.
When the active country is UAE, existing currency display remains unchanged.
Currency formatting is handled by a shared reusable engine instead of page-by-page duplication.