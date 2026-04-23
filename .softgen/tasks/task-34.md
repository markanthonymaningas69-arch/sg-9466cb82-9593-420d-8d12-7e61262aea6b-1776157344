---
title: AI expert cross-module access
status: in_progress
priority: high
type: feature
tags:
  - ai
  - analytics
  - navigation
  - project-manager
created_by: agent
created_at: 2026-04-23
position: 34
---

## Notes
Extend the AI Project Expert so it can access and analyze data from all modules and all tabs in the application. The implementation must trace the current AI chat flow, identify how module data is loaded, and expose a unified project-aware context that includes every major module and tab without breaking existing chat behavior.

The feature should cover the global AI expert experience, the backend chat context assembly, and the module data aggregation layer needed to provide complete project analysis.

## Checklist
- [ ] Review the current AI assistant UI entry points and chat API flow
- [ ] Identify all module and tab data sources that should be included in AI analysis context
- [ ] Add a shared project context builder for all supported modules and tabs
- [ ] Update the AI chat API to use the expanded cross-module context
- [ ] Ensure the AI expert can be opened from the main app flow with access to the active project context
- [ ] Validate the AI expert returns answers based on data from all modules and tabs

## Acceptance
The AI Project Expert can analyze information from all app modules and their tabs for the selected project.
AI responses are grounded in the same data shown across the application modules.