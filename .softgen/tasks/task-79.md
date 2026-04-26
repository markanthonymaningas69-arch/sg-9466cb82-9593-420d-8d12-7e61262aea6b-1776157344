---
title: Linked site warehouse material ledger
status: in_progress
priority: high
type: feature
tags: [site-warehouse, site-personnel, purchases, usage, inventory]
created_by: agent
created_at: 2026-04-26T16:16:13 UTC
position: 79
---

## Notes
Link the Site Purchase & Deliveries records and Usage records to the Site Warehouse so warehouse balances reflect actual site-level material movement. The warehouse logic must aggregate total restock material from Site Purchase records, total usage from Usage records, and compute remaining materials plus missing/excess status per material.

## Checklist
- [ ] Review the Site Warehouse tab, Material Usage tab, Site Purchase & Deliveries tab, service layer, and database schema for current material record sources
- [ ] Define how Site Purchase restocks and Usage deductions map into a single warehouse material balance dataset
- [ ] Update the service layer so Site Warehouse can load aggregated totals for restock, usage, remaining, and missing/excess values
- [ ] Validate the linked warehouse data flow against the existing saved records

## Acceptance
Site Warehouse reflects total restock quantities from Site Purchase records.
Site Warehouse reflects total usage quantities from Usage records.
Each warehouse material row shows remaining quantity and whether it is missing or excess.