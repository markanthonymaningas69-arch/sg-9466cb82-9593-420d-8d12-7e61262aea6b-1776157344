---
title: System-wide Archive Feature
status: in_progress
priority: high
type: feature
tags: [database, ui, dashboard]
created_by: agent
created_at: 2026-04-14T08:00:00Z
position: 8
---

## Notes
Implement a global archiving system replacing hard deletes across the app, with GM control for permanent deletion.

## Checklist
- [x] Add `is_archived` flag to main database tables
- [ ] Update data services to filter `is_archived: false` and change delete to archive
- [ ] Replace Trash icons with Archive icons in Personnel, Site Personnel, Warehouse, Purchasing, Projects
- [ ] Add "Archived Files" management UI to GM Dashboard (index.tsx)