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
- optionally include a progress bar
- recalculate dynamically when project cost or accomplishment data changes

The implementation must use real project data already available in the app and keep the dashboard readable in both light and dark mode.

## Checklist
- [ ] Inspect the current dashboard accomplishment calculation and related data sources
- [ ] Replace overall accomplishment logic with cost-weighted computation
- [ ] Add per-project summary rows for cost, weight, accomplishment, and contribution
- [ ] Add highlighted overall accomplishment display and supporting visual cue
- [ ] Validate zero-cost and missing-accomplishment edge cases
- [ ] Verify the dashboard updates correctly with live project data