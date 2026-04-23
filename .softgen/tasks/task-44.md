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

## Checklist
- [ ] Audit the current Project Manager page layout and shared app shell constraints
- [ ] Build a full-height workspace shell with compact toolbar and internal panel scrolling
- [ ] Move Task Configuration into a right-side panel with show/hide behavior and task-driven opening
- [ ] Expand the main view area dynamically when the configuration panel is hidden
- [ ] Ensure responsive behavior uses a right-side drawer on smaller screens
- [ ] Validate scrolling, resizing, and overall layout behavior across List, Gantt, Calendar, and S-Curve views

## Acceptance
Project Manager uses a full-height planning workspace with the main view occupying the maximum available vertical area.
Task Configuration appears in a dedicated right-side panel on desktop and a slide-over drawer on smaller screens.
The page uses internal panel scrolling instead of whole-page scrolling.