---
title: Site Personnel purchase and deliveries form
status: done
priority: high
type: feature
tags: [site-personnel, deliveries, purchasing, form]
created_by: agent
created_at: 2026-04-26T15:04:37 UTC
position: 76
---

## Notes
Update the Site Personnel surface by renaming the Deliveries module to Purchase & Deliveries. Replace the current record form fields with: Site Purchase/Delivery toggle, Select Scope, Select Material, Quantity, Unit, Unit Cost, Amount auto-calculated, Supplier, Delivery/Purchase Date, and Notes optional. If the record comes from Delivery, remove the costing fields because the amount is already recorded from accounting.

## Checklist
- [x] Review the Site Personnel page, delivery tab component, related service layer, and database schema for the current deliveries record flow
- [x] Rename the visible Deliveries label to Purchase & Deliveries on the affected Site Personnel surface
- [x] Update the record form to support Site Purchase vs Delivery mode with the requested fields and conditional costing behavior
- [x] Update persistence and list rendering so the new fields save and display correctly
- [x] Validate the Site Personnel flow builds cleanly after the changes
- [x] Remove the Delivery option from the Add Record form so users can only input Site Purchase entries
- [x] Keep the tab label as Site Purchase & Deliveries while preserving existing records display
- [x] Compress the vertical spacing in the Site Purchase modal so the form is denser
- [x] Add a receipt number input and persist it with Site Purchase records
- [x] Add an Others option to Select Material and show a manual input when selected
- [ ] Allow direct manual material entry when the needed material is not present in the list

## Acceptance
The Site Personnel module shows Purchase & Deliveries instead of Deliveries.
The add record form contains the requested fields and auto-calculates Amount for Site Purchase entries.
Delivery entries hide costing inputs so users do not enter duplicate accounting amounts.