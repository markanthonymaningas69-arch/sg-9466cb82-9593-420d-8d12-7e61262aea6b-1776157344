---
title: Dependency schedule autosave
status: in_progress
priority: high
type: bug
tags:
  - schedule
  - dependencies
  - autosave
created_by: agent
created_at: 2026-04-28 17:08:38 UTC
position: 115
---

## Notes
When a task dependency is added or changed in Project Manager, linked activities already recalculate in the UI but only the selected task is persisted. The save flow must also persist affected successor or predecessor tasks whose start date, end date, or duration changed due to dependency scheduling.

## Checklist
- [ ] Track persisted task signatures for the full schedule, not only the selected task
- [ ] Persist dependency-driven date changes for affected linked tasks after the edited task saves
- [ ] Reset dependency persistence tracking when projects reload or clear
- [ ] Validate the schedule build after the autosave change

## Acceptance
Changing a dependency in Project Manager automatically updates and saves the affected activity dates.

After refreshing the page, dependency-adjusted start and end dates remain correct.