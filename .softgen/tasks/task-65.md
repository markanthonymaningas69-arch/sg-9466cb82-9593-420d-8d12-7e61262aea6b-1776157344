---
title: Admin staff attendance defaults in time tab
status: done
priority: high
type: feature
tags:
  - personnel
  - hr
  - attendance
  - time
created_by: agent
created_at: 2026-04-25
position: 65
---

## Notes
Update the Human Resource "Time" tab so Admin Staff attendance can be checked directly there with a simpler workflow.

For Admin Staff:
- attendance should default to present with full hours
- users should only need to mark someone absent when needed
- there should be an input for time in so late arrivals can be recorded
- when no late time is entered, the record should remain automatically present with full hours

Keep this scoped to the Time tab and the attendance save logic it uses. Preserve the existing construction worker flow unless a shared part must be adjusted for compatibility.

Evidence:
- `site_attendance` did not contain a `time_in` field in the database schema, so a nullable `time_in` column was added before wiring the UI.
- `site_attendance.project_id` is required, so Admin Staff without an assigned project are shown clearly and skipped from attendance saves until assigned.

## Checklist
- [x] Inspect the current Time tab UI and attendance save flow
- [x] Verify the attendance table fields available for time-in, status, and hours
- [x] Add Admin Staff attendance controls with default present/full-hours behavior
- [x] Add absent override and late time input for Admin Staff
- [x] Ensure saved attendance reflects default present status unless marked absent
- [x] Validate lint, type, CSS, and runtime behavior

## Acceptance
Admin Staff can be managed from the Time tab with default present attendance.
Users can mark an Admin Staff member absent instead of manually setting present.
Users can record a late time-in, while default attendance remains present with full hours.