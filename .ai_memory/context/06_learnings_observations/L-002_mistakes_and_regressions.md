---
id: L-002
title: Mistakes and Regressions
tags: [bugs, learning, mistakes]
links: []
importance: 10
status: confirmed
version: 1.0.0
updated: 2026-07-26
---
# Mistakes and Regressions
- Past submodule 160000 warning handled.
- HTML file deletion fixes resolved.
- **[2026-07-27] BUG: Duplicate `supabase` declaration.** The Supabase CDN (`@supabase/supabase-js@2`) exposes a global `supabase` object. Using `const supabase = window.supabase.createClient(...)` redeclares it, crashing the script. **Fix:** Changed to `window.supabaseClient = ...` and updated all 10 references in `app.js`.
- **[2026-07-27] BUG: Missing `saveEmails()` function.** The compose handler's localStorage fallback called `saveEmails()` which did not exist, causing a runtime error. **Fix:** Added `saveEmails()` helper to write `emails` array to `localStorage`.
- **[2026-07-27] VERIFIED:** Both the duplicate `supabase` declaration fix (`window.supabaseClient`) and the Compose modal wiring (open/close/send handlers) were confirmed working via live browser test at `localhost:8080`. No `SyntaxError` or runtime crashes. Compose modal opens, accepts input (To/Subject/Body), closes cleanly, and Send handler inserts to Supabase (or falls back to localStorage). One non-blocking Supabase schema warning: `PGRST204: Could not find the 'avatar' column` — DB table needs an `avatar` column added.
