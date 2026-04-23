---
title: Project Manager workspace layout
status: in_progress
priority: high
type: feature
tags:
  - schedule
  - layout
  - gantt
  - project-manager
created_by: agent
created_at: 2026-04-23
position: 44
---

## Notes
Redesign the Project Manager module into a full-height planning workspace. The main schedule views must use the maximum available vertical space, while Task Configuration moves into a dedicated right-side panel similar to Primavera or MS Project.

The workspace must minimize top spacing, keep the toolbar compact, prevent whole-page scrolling, and support responsive behavior where the right-side panel becomes a slide-over drawer on smaller screens.

Follow-up fix:
- remove the blocking dark screen effect when the right-side task configuration panel is shown on desktop
- keep drawer overlay behavior only for smaller screens where the panel becomes a slide-over

## Checklist
- [x] Audit the current Project Manager page layout and shared app shell constraints
- [x] Build a full-height workspace shell with compact toolbar and internal panel scrolling
- [x] Move Task Configuration into a right-side panel with show/hide behavior and task-driven opening
- [x] Expand the main view area dynamically when the configuration panel is hidden
- [x] Ensure responsive behavior uses a right-side drawer on smaller screens
- [x] Validate scrolling, resizing, and overall layout behavior across List, Gantt, Calendar, and S-Curve views
- [ ] Remove the blocking dark overlay from the desktop side panel while preserving mobile drawer behavior

## Acceptance
Project Manager uses a full-height planning workspace with the main view occupying the maximum available vertical area.
Task Configuration appears in a dedicated right-side panel on desktop and a slide-over drawer on smaller screens.
The page uses internal panel scrolling instead of whole-page scrolling.