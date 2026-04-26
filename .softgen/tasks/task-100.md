---
title: Purchasing purchase orders compact table
status: done
priority: high
type: feature
tags: [purchasing, ui, tables, compact-density]
created_by: agent
created_at: 2026-04-26T19:34:00 UTC
position: 100
---

## Notes
Apply the same compact, high-density table treatment to the main Purchase Orders list in Purchasing. Prioritize single-line cells, fixed key widths, reduced spacing, and sticky headers where practical so the page can show more procurement data at once.

## Checklist
- [x] Inspect the main Purchase Orders table and any secondary purchasing list tables on the page
- [x] Reduce font sizes, spacing, and card padding across purchasing list surfaces
- [x] Prevent wrapping in headers and cells with ellipsis for long values
- [x] Add hover tooltips for truncated purchase order values
- [x] Keep headers aligned and enable horizontal scrolling inside the table container
- [x] Convert large action buttons into compact controls where possible while preserving all actions

## Acceptance
Purchase Orders shows more information per screen without text wrapping.
Long values truncate cleanly and reveal the full value on hover.
The compact styling stays consistent with Incoming Requests.