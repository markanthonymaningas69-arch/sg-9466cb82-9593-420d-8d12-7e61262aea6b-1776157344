---
title: Read-Only Mode - Projects & BOM
status: done
priority: high
type: feature
tags: [projects, bom, read-only]
created_by: agent
created_at: 2026-04-19T12:45:00Z
position: 16
---
## Notes
Enforce `isLocked` read-only state on Projects and BOM.

## Checklist
- [x] Disable "New Project" button in projects.tsx
- [x] Disable edit/delete actions on project cards
- [x] Disable "Add Item", "Import", "Edit", "Delete" in bom/[projectId].tsx

## Acceptance
- Expired users can view project details and BOM but cannot modify them.