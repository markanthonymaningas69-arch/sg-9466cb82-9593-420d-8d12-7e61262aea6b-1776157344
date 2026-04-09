---
title: "Adjust BOM indirect costs layout and fix labor calculations"
status: in_progress
priority: high
type: feature
tags:
  - bom
  - accounting
  - layout
  - calculations
created_by: agent
created_at: 2026-04-09T20:51:10Z
position: 1
---

## Notes
This task updates the Bill of Materials screen to:
1. Remove the redundant "Print to PDF" button.
2. Place the "Add Indirect Cost" action directly under the Total Direct Cost summary for better UX.
3. Fix labor cost calculations, especially percentage-based labor, so they correctly use the scope's material totals and persist to Supabase.

## Checklist
- [ ] Remove the Print to PDF button from the BOM page so it no longer appears under Grand Total.
- [ ] Reposition the "Add Indirect Cost" button to appear below the Total Direct Cost summary card.
- [ ] Ensure material totals use either stored total_cost or quantity × unit_cost so percentage labor has the correct base.
- [ ] Persist material total_cost on create/update and verify labor costs (percentage and unit cost) update scope and BOM totals correctly.