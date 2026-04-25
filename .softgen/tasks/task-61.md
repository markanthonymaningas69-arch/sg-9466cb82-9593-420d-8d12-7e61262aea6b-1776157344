---
title: Project profile table and modal cleanup
status: done
priority: medium
type: feature
tags:
  - projects
  - ui
  - forms
created_by: agent
created_at: 2026-04-25
position: 61
---

## Notes
Adjust the Project Profile page so the All Projects table fits better inside the body card by reducing text size. Remove the Status, Plan Start, and Plan Finish fields from both the table and the new project creation modal.

Keep the rest of the project creation flow unchanged unless those fields are required by the current implementation. If the data layer still needs fallback values, preserve compatibility without showing the inputs in the UI.

## Checklist
- [x] Inspect the All Projects table and new project modal implementation
- [x] Reduce table text size and related spacing so project rows fit better inside the card
- [x] Remove Status, Plan Start, and Plan Finish columns from the table
- [x] Remove Status, Plan Start, and Plan Finish inputs from the new project modal
- [x] Preserve project creation behavior if hidden defaults are still required
- [x] Validate the page for lint, type, CSS, and runtime issues

## Acceptance
The All Projects table fits more comfortably inside the Project Profile body card with smaller text.
The table no longer shows Status, Plan Start, or Plan Finish.
The new project modal no longer asks for Status, Plan Start, or Plan Finish.