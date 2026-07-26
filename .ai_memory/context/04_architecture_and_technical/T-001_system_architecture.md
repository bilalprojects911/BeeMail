---
id: T-001
title: System Architecture
tags: [architecture, javascript, supabase]
links: [T-002, T-003, P-002]
importance: 10
status: confirmed
version: 1.1.0
updated: 2026-07-27
---
# System Architecture
Vanilla JavaScript (SPA), Tailwind CSS, Supabase (Database & Realtime), Vercel / GitHub Pages Hosting.

## Routing Structure (v1.1 — 2026-07-27)
| File | Role | URL on Vercel |
|---|---|---|
| `index.html` | Landing / marketing page (hero, features, CTA) | `/` |
| `app.html` | SPA webmail client (inbox, compose, detail) | `/app.html` |
| `app.js` | All SPA application logic | loaded by `app.html` |
| `data.js` | Mock email seed data | loaded by `app.html` |
| `styles.css` | Shared stylesheet | loaded by both pages |

### Navigation Flow
```
index.html (Landing) —["Launch App" / "Open Your Inbox"]—> app.html (SPA)
app.html (Logo click)  —> stays on app.html (no redirect)
```
