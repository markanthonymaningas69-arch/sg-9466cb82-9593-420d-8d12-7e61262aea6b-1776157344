---
title: System-wide Archive Feature
status: done
priority: high
type: feature
tags: [database, ui, permissions, dashboard]
created_by: agent
created_at: 2026-04-14T07:59:00Z
position: 8
---

## Notes
The system requires a soft-delete mechanism across all modules. Instead of deleting records permanently from the UI, users will "Archive" them. Only the GM (Dashboard view) will have access to the "Archived Files" vault, where they can permanently delete or restore the records.

## Checklist
- [x] Add `is_archived` boolean column to all main database tables
- [x] Update data fetching in all services to filter out archived records (`is_archived: false`)
- [x] Change `delete` methods in services to update `is_archived: true` instead of dropping rows
- [x] Replace Trash icons with Archive icons in UI (Personnel, Warehouse, Purchasing, Projects, Site Personnel)
- [x] Update confirmation prompts to say "Archive this item?"
- [x] Create a global `ArchiveViewer` modal with tabs for different categories
- [x] Add "Archived Files" management UI to GM Dashboard (index.tsx) with exclusive restore and hard-delete powers