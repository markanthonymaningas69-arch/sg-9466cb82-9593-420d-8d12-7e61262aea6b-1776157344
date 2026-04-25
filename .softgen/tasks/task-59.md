---
title: Weighted accomplishment dashboard summary
status: in_progress
priority: high
type: feature
tags:
  - dashboard
  - analytics
  - accomplishment
  - cost-weighted
created_by: agent
created_at: 2026-04-25
position: 59
---

## Notes
Enhance the GM dashboard so overall accomplishment is computed using cost-weighted project contribution instead of a simple average.

For each project, use:
- total project cost
- project accomplishment percent from SWA / Project Analytics

Required logic:
- total_cost = sum of all project costs
- project_weight = project_cost / total_cost
- weighted_contribution = project_weight × project_accomplishment_percent
- overall_accomplishment = sum of all weighted_contributions

Validation rules:
- if total cost is zero, overall accomplishment must return 0%
- if project accomplishment is missing, treat it as 0%

UI requirements:
- show a clean per-project summary table with project name, cost, weight, accomplishment, and contribution
- highlight the overall accomplishment percentage
- use the highlighted dashboard card as the click target for the weighted accomplishment breakdown
- optionally include a progress bar
- recalculate dynamically when project cost or accomplishment data changes

The implementation uses the existing GM dashboard project cost fallback and SWA accomplishment calculation already present in the app, then derives per-project weight and contribution values for display. The weighted breakdown is now opened from the highlighted Overall Accomplishment metric card.

Follow-up fix:
- remove the remaining duplicate on-page "Cost-Weighted Accomplishment Summary" section if it is still rendered in the dashboard body
- keep the weighted breakdown only inside the highlighted Overall Accomplishment card interaction

## Checklist
- [x] Inspect the current dashboard accomplishment calculation and related data sources
- [x] Replace overall accomplishment logic with cost-weighted computation
- [x] Add per-project summary rows for cost, weight, accomplishment, and contribution
- [x] Add highlighted overall accomplishment display and supporting visual cue
- [x] Make the highlighted Overall Accomplishment card open the weighted breakdown
- [x] Validate zero-cost and missing-accomplishment edge cases
- [x] Verify the dashboard updates correctly with live project data
- [ ] Remove the duplicate on-page weighted accomplishment summary block

## Acceptance
The main GM dashboard shows only the highlighted Overall Accomplishment card, not a second weighted summary section.
Clicking the highlighted card opens the weighted accomplishment breakdown.
