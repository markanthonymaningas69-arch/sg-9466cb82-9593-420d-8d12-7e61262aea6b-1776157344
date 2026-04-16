---
title: System Monitoring Dashboard
status: done
priority: high
type: feature
tags: [admin, monitoring, dashboard]
created_by: agent
created_at: 2026-04-16T16:32:00Z
position: 11
---

## Notes
The developer requested a monitoring dashboard to view:
1. Number of users in trial mode, monthly, yearly, and by plan.
2. Monthly revenue.
3. System performance metrics (Total RAM usage, CPU, uptime).

## Checklist
- [x] Create `/admin` page for the system dashboard
- [x] Implement system metrics mock/real-time display (RAM, CPU, Network)
- [x] Fetch and aggregate subscription data (Trial, Monthly, Yearly users)
- [x] Calculate and display Monthly Recurring Revenue (MRR)
- [x] Add navigation link for the developer/admin