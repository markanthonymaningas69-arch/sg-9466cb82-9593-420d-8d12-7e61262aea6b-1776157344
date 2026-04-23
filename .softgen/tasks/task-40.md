---
title: Schedule view refinements
status: done
priority: high
type: feature
tags:
  - schedule
  - gantt
  - calendar
  - resources
created_by: agent
created_at: 2026-04-23
position: 40
---

## Notes
Refine the Project Manager viewing experience. Remove the visual gridlines from the Gantt view and bring back the previous calendar-style planning view for manpower, materials, and tools & equipment requirements.

This task focuses on schedule presentation only. The restored calendar view must fit into the current Project Manager flow and use the existing task/resource data where possible.

Latest follow-up changes:
- make dependency connector lines thinner
- use smaller arrow heads
- align dependency connectors to the visual middle of each task bar
- correct the Gantt activity bar layout when bars render out of place
- correct dependency arrow placement so the line connects at the proper bar edge
- tighten the task title text inside each bar with a smaller, better-fitting label style

## Checklist
- [x] Remove background gridlines from the Gantt view while keeping task bars and dependency paths readable
- [x] Inspect the existing calendar view component and confirm what data it expects
- [x] Restore a calendar view option in Project Manager alongside the task list and Gantt view
- [x] Show manpower, materials, and tools & equipment requirements in the calendar view
- [x] Validate the schedule page view switching and resource visibility
- [x] Refine dependency connector styling and bar alignment in the Gantt view
- [x] Correct misplaced activity bar layout in the Gantt view
- [x] Correct dependency arrow placement in the Gantt view
- [x] Improve task label fit inside each Gantt bar using smaller typography

## Acceptance
The Gantt view no longer shows timeline gridlines behind the bars.
Project Manager includes a calendar view again.
The calendar view displays manpower, materials, and tools & equipment requirements tied to the schedule.