---
title: "Implement Role-Based Root Routing"
status: todo
priority: high
type: feature
tags: ["routing", "roles"]
---

## Notes
- The root page (`/`) currently displays the GM dashboard for everyone.
- We need to route users to their dedicated module pages based on their assigned role in the `profiles` table to truly separate the modules.

## Checklist
- [ ] Update `src/pages/index.tsx`:
  - [ ] Fetch the current user's profile on mount.
  - [ ] If `assigned_module` is null or missing, redirect to `/onboarding`.
  - [ ] If `assigned_module` is 'GM', render the current executive dashboard.
  - [ ] If `assigned_module` is 'Project Profile', redirect to `/projects`.
  - [ ] If `assigned_module` is 'Site Personnel', redirect to `/site-personnel`.
  - [ ] If `assigned_module` is 'Purchasing', redirect to `/purchasing`.
  - [ ] If `assigned_module` is 'Accounting', redirect to `/accounting`.
  - [ ] If `assigned_module` is 'Human Resources', redirect to `/personnel`.
  - [ ] If `assigned_module` is 'Warehouse', redirect to `/warehouse`.
- [ ] Update `src/components/Layout.tsx` to handle the case where a user is on `/onboarding` (e.g., hide the sidebar or show a minimal layout).