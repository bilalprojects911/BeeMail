---
id: T-001
title: System Architecture
tags: [architecture, javascript, supabase, auth]
links: [T-002, T-003, P-002]
importance: 10
status: confirmed
version: 1.2.0
updated: 2026-07-27
---
# System Architecture
Vanilla JavaScript (SPA), Tailwind CSS, Supabase (Database, Realtime & Auth), Vercel / GitHub Pages Hosting.

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

## Authentication (v1.2 — 2026-07-27)
- **Provider:** Supabase Auth (Google OAuth + Email/Password fallback)
- **Guard:** `init()` checks `supabaseClient.auth.getSession()` on page load; if no session, Auth Modal blocks inbox access.
- **OAuth Flow:** `signInWithOAuth({ provider: 'google' })` with `redirectTo: window.location.href`.
- **Session Listener:** `onAuthStateChange` handles redirect callback and sign-out events.
- **Profile UI:** Top-right avatar shows user's Google profile picture, name, and email from `user.user_metadata`.
- **Profile Dropdown:** Avatar click → dropdown with email display, "Profile Settings", and "Sign Out".
- **Sign Out:** Calls `supabaseClient.auth.signOut()`, clears state, shows Auth Modal.
- **Data Association:** Composed emails include `user_id` from authenticated user, and `sender`/`senderEmail`/`avatar` from user metadata.
