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

Resolved:
- the assistant is now rendered once inside the module body at the bottom-right
- drag behavior has been removed
- the chat panel layout has been normalized
- the AI API now accepts the module data keys sent by the assistant

New follow-up:
- place the assistant specifically below the analytics tab at the bottom-right corner of the module card body
- restore chat history threads
- allow thread rename and delete
- store thread history in cache memory

Latest follow-up:
- use one global thread history and analysis context instead of separate thread sets per module
- make the assistant available only in the GM module
- place it below Analytics at the bottom-right corner of the GM module body

Newest refinement:
- place the AI assistant directly below the Analytics module itself, right-aligned to the bottom-right of that module area
- remove the remaining dashboard mount before moving it to the analytics page

## Checklist
- [x] Review the current AI assistant component and module-body mount location
- [x] Remove drag-related behavior and state from the assistant
- [x] Keep the assistant fixed at the bottom-right of the module body
- [x] Preserve single-instance rendering inside the intended layout location
- [x] Fix chat body and input alignment inside the assistant panel
- [x] Verify the active module and project data are loaded and passed into the AI chat request
- [x] Validate that the assistant no longer drags and appears only once
- [x] Reposition the assistant below the analytics tab at the bottom-right of the module card body
- [x] Restore thread history UI with list of previous conversations
- [x] Add rename and delete controls for each saved thread
- [x] Store assistant history in cache memory and restore it in the UI
- [x] Validate placement and thread management behavior
- [x] Identify the GM module page and its Analytics section mount point
- [x] Change assistant history and analysis context to a single global cache key shared across GM
- [x] Remove assistant rendering from non-GM modules
- [x] Render the assistant only below Analytics at the bottom-right of the GM module body
- [x] Remove the dashboard assistant mount
- [ ] Move the assistant so it sits directly below the Analytics module and right-aligned in that section
- [ ] Validate final GM placement in preview structure

## Acceptance
The AI assistant appears only once in the GM module body below Analytics at the bottom-right corner.
The assistant uses one shared thread history and data context instead of separate module-specific threads.
Users can no longer drag the assistant, and thread history can be viewed, renamed, and deleted from the shared cache layer.