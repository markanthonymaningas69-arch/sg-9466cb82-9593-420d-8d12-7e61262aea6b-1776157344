---
title: Dashboard project start date column
status: done
priority: high
type: feature
tags:
  - dashboard
  - projects
  - site-personnel
  - reporting
created_by: agent
created_at: 2026-04-25
position: 63
---

## Notes
Update the Dashboard "Project Portfolio Status" table so the current "Status" column becomes "Date Started".

The displayed date must come from Site Personnel data, specifically the earliest date on which labor cost started for that project. The dashboard should no longer show the project status value in that column.

Keep the change scoped to the dashboard table and the data loading required to compute the first labor-cost date per project.

## Checklist
- [x] Inspect the dashboard table and current project portfolio data loading
- [x] Verify where Site Personnel labor cost records and dates are stored
- [x] Replace the Status column with a Date Started column in the dashboard table
- [x] Compute the date from the earliest labor-cost entry per project
- [x] Validate the dashboard for lint, type, CSS, and runtime issues

## Acceptance
The Project Portfolio Status table shows Date Started instead of Status.
Each project's Date Started reflects the earliest labor cost date from Site Personnel data when available.
Projects without labor cost activity show a clear fallback value.