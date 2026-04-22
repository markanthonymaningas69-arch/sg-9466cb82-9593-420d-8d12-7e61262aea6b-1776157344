---
title: Project Manager Module - Backend & Schema
status: in_progress
priority: high
type: feature
tags: [gantt, scheduling, backend]
created_by: agent
created_at: 2026-04-22T10:00:00Z
position: 22
---

## Notes
Create the database infrastructure and service layer for the Project Manager (Gantt) module.

## Checklist
- [x] Create `project_tasks` table in database (dependencies, progress, dates, bom link)
- [ ] Set up Row Level Security (RLS) for the new table
- [ ] Create `src/services/scheduleService.ts` for CRUD operations
- [ ] Add navigation link for the new module