---
title: HR rates-driven staff management
status: in_progress
priority: high
type: feature
tags:
  - hr
  - personnel
  - rates
  - staff
  - database
created_by: agent
created_at: 2026-04-23
position: 45
---

## Notes
Enhance the Human Resource – Personnel Management module so the Rates tab becomes the master source for adding personnel in the Staff tab.

The staff creation flow must require selecting an active position from the rates catalog, auto-fill category and pay fields from that position, and store both the rate catalog reference and a rate snapshot for historical consistency.

The implementation must support future labor costing, S-Curve labor costing, and payroll use cases. Only active positions should be selectable. Position names in the rates catalog must be unique. The Staff form should clearly show that the rate is sourced from the HR Rates Catalog.

## Checklist
- [ ] Inspect the current HR rates and staff module structure, services, and database schema
- [ ] Update database structure to support master rate catalog rules, position references, and rate snapshots on staff records
- [ ] Update rates catalog logic to enforce unique active position master data and expose active selectable positions
- [ ] Update Staff form to use a searchable grouped position dropdown sourced from active rates
- [ ] Auto-fill category and rate fields from the selected position and prevent invalid manual entry
- [ ] Persist position_id and rate_snapshot when creating or updating staff
- [ ] Validate the HR workflow end to end and confirm it supports downstream labor costing integrations

## Acceptance
Staff can only be created by selecting an active position from the Rates tab.
Selecting a position auto-fills category and rate details from the HR Rates Catalog.
Saved staff records keep both the linked position reference and a historical rate snapshot.