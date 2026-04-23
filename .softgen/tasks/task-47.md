---
title: AI assistant duplicate mount fix
status: done
priority: high
type: bug
tags:
  - ai
  - assistant
  - layout
  - duplicate
created_by: agent
created_at: 2026-04-23
position: 47
---

## Notes
The AI assistant appears duplicated after being anchored into the module body area. This likely means the component is still mounted in more than one place, such as both the global app shell and the module content area.

Verify every mount location, keep only the intended module-body instance, and preserve the current drag-only behavior.

Evidence found:
- `src/components/Layout.tsx` mounted `<AIChatAssistant contained />` inside the module body
- the same file also mounted a second `<AIChatAssistant />` globally at the bottom of the layout

## Checklist
- [x] Find every place where AIChatAssistant is mounted or imported
- [x] Remove the duplicate mount while keeping the assistant inside the module body
- [x] Validate that only one assistant appears across modules and that drag behavior still works

## Acceptance
Only one AI assistant is visible in each module view.
The assistant stays anchored at the bottom-right of the module body and remains draggable.