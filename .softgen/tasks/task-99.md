---
title: Purchasing incoming requests compact table
status: in_progress
priority: high
type: feature
tags: [purchasing, ui, tables, compact-density]
created_by: agent
created_at: 2026-04-26T19:34:00 UTC
position: 99
---

## Notes
Tighten the Purchasing Incoming Requests table so more request data fits on screen. Keep the current data and actions, but reduce density, prevent wrapping, and add hover access to truncated values. The list should feel compact and aligned without becoming hard to scan.

## Checklist
- [ ] Inspect the current Incoming Requests table structure and action cells
- [ ] Reduce font sizes, padding, and row height for the Incoming Requests list
- [ ] Prevent wrapping in headers and cells with ellipsis for long values
- [ ] Add hover tooltips for truncated request fields
- [ ] Keep horizontal scroll inside the table area and preserve readability on smaller screens
- [ ] Convert oversized row actions into compact buttons without removing functionality

## Acceptance
Incoming Requests fits more rows and columns on screen.
Long values stay on one line and show the full value on hover.
The table remains horizontally scrollable without breaking alignment.