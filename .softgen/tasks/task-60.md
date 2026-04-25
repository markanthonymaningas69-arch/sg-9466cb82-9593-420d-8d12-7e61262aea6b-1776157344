---
title: Remove pricing page
status: in_progress
priority: medium
type: chore
tags:
  - routing
  - navigation
  - pages
created_by: agent
created_at: 2026-04-25
position: 60
---

## Notes
Remove the public `/pricing` page from the app and clean up any visible links or navigation entries that still direct users to that route.

Keep the removal scoped to the pricing route and related user-facing navigation references only.

## Checklist
- [x] Find all references to the pricing page route and page title
- [x] Remove the `/pricing` page file
- [x] Remove or update navigation links that point to `/pricing`
- [ ] Validate that the app no longer exposes the pricing page
- [ ] Confirm the project still passes checks

## Acceptance
Users can no longer open `/pricing`.
No visible navigation item points to the removed pricing page.