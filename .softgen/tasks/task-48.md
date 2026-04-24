---
title: Fixed AI assistant placement
status: in_progress
priority: high
type: bug
tags:
  - ai
  - assistant
  - layout
  - ui
created_by: agent
created_at: 2026-04-23
position: 48
---

## Notes
Remove the AI assistant dragging capability and keep only one assistant instance fixed at the bottom-right of the module body.

The assistant should remain inside the module content area below the analytics section and should no longer be movable by users. Preserve the current single-instance behavior and avoid any duplicate renders.

The previous duplicate-mount follow-up hit a sandbox 502 while updating the task file, so this task continues the requested UI correction in a fresh task entry.

Follow-up issues from preview:
- the assistant is still not anchored in the proper module-body location
- the chat message area and input layout are visually misaligned
- the assistant is not accessing module data correctly, so responses are missing project context

## Checklist
- [ ] Review the current AI assistant component and module-body mount location
- [ ] Remove drag-related behavior and state from the assistant
- [ ] Keep the assistant fixed at the bottom-right of the module body
- [ ] Preserve single-instance rendering inside the intended layout location
- [ ] Fix chat body and input alignment inside the assistant panel
- [ ] Verify the active module and project data are loaded and passed into the AI chat request
- [ ] Validate that the assistant no longer drags and appears only once

## Acceptance
The AI assistant appears only once in the module body.
The assistant is fixed at the bottom-right below the analytics area.
Users can no longer drag the assistant.
The chat panel layout is aligned and the assistant can analyze the current module data.