---
title: Site requests compact table
status: in_progress
priority: high
type: feature
tags: [site-personnel, requests, compact-ui]
created_by: agent
created_at: 2026-04-26T19:57:11 UTC
position: 105
---

## Notes
Tighten the Requests tab in Site Personnel so more request data fits on screen. Keep the current workflow behavior, but reduce spacing, prevent wrapping, align columns clearly, and add hover access for truncated values. The layout should feel like a compact ERP table rather than a spacious card list.

## Checklist
- [ ] Inspect the current Requests tab structure, filters, and action cells
- [ ] Reduce font sizes, padding, row height, and vertical spacing in the Requests surface
- [ ] Prevent wrapping in headers and cells with ellipsis for long values
- [ ] Add hover tooltips for truncated request fields
- [ ] Keep numbers, status badges, and actions consistently aligned
- [ ] Preserve usability on smaller screens with horizontal scrolling instead of wrapping

## Acceptance
The Requests tab shows more rows and columns on screen without multi-line text.
Long values truncate cleanly and reveal the full value on hover.
The table remains aligned and readable in a compact format.