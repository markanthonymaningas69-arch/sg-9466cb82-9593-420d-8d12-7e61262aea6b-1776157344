---
title: Create AI BOM Material Generation API
status: todo
priority: high
type: feature
tags: [ai, backend, bom]
created_by: agent
created_at: 2026-04-22T18:45:00Z
position: 24
---

## Notes
Create a backend API endpoint to handle the AI material generation logic using OpenAI. It needs to accept scope details and return structured JSON.

## Checklist
- [ ] Create `src/pages/api/ai/generate-bom.ts`
- [ ] Setup OpenAI client (reusing existing API key structure)
- [ ] Write system prompt to enforce construction standards and JSON output (Name, Unit, Estimated Quantity, Category)
- [ ] Add error handling and response formatting

## Acceptance
- Endpoint successfully receives scope details and returns a valid JSON array of materials.