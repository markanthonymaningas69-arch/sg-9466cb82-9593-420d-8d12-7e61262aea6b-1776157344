---
title: Simplify BOM labor cost layout to single-line
status: done
priority: medium
type: feature
tags: ["bom", "labor", "ui", "layout"]
created_by: agent
created_at: 2026-04-10T19:24:02Z
position: 3
---

## Notes
The current Labor Cost section on the BOM page stacks multiple rows of labels and inputs, making the UI feel busy. The user wants the labor cost controls simplified into a single-line layout per scope while keeping the existing calculation behavior (percentage-based and unit-cost-based).

Target: `src/pages/bom/[projectId].tsx`, in the "Labor Cost" area under each scope.

## Checklist
- [x] Replace the multi-row labor form layout with a single compact horizontal row per scope
- [x] Keep the method toggle (% of materials vs By Unit Cost) but present it inline with the inputs
- [x] For percentage method, show one numeric input (percentage) plus a small read-only material total hint
- [x] For unit-cost method, show quantity, unit selector, and rate inputs on the same row using placeholders instead of full labels
- [x] Keep Save and Cancel buttons on the same row aligned with the inputs
- [x] Ensure the layout remains usable on small screens via flex-wrap while still appearing as “one line” on desktop
- [x] Run a project error check after changes