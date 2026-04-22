# Patient Tracking PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a patient-facing PWA for one clinic that records vaccination and blood test history via QR scans, with push-notification reminders for follow-up doses, plus a staff-side QR generator gated by a shared password.

**Architecture:** Vite + Vue 3 single-page PWA served as static files, with Supabase as the sole backend (Postgres + Auth + one Edge Function). Staff generator lives in the same app at `/staff`. All client data access goes through Supabase RLS scoped to `auth.uid()`. Push dispatch runs as a single Deno Edge Function scheduled by `pg_cron`.

**Tech Stack:** Vite, Vue 3, TypeScript, Pinia, Vue Router, Tailwind CSS v4, shadcn-vue, `@supabase/supabase-js`, `vite-plugin-pwa`, `html5-qrcode`, `qrcode`, `ulid`, Vitest, `@vue/test-utils`, Deno + `web-push` (Edge Function).

**Reference spec:** `docs/superpowers/specs/2026-04-22-clinic-records-design.md`

---

## File Structure

Files that will exist when the plan is complete:

```
clinic-records/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── index.html
├── .env.example
├── .gitignore
├── src/
│   ├── main.ts
│   ├── App.vue
│   ├── style.css
│   ├── router/
│   │   └── index.ts
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── qr-payload.ts
│   │   ├── staff-auth.ts
│   │   ├── dates.ts
│   │   ├── dictionary.ts
│   │   └── push.ts
│   ├── stores/
│   │   ├── auth.ts
│   │   ├── profiles.ts
│   │   └── records.ts
│   ├── pages/
│   │   ├── Landing.vue
│   │   ├── Signup.vue
│   │   ├── Home.vue
│   │   ├── Scan.vue
│   │   ├── Ingest.vue
│   │   ├── RecordDetail.vue
│   │   ├── Profiles.vue
│   │   ├── Settings.vue
│   │   └── staff/
│   │       ├── Gate.vue
│   │       └── Generate.vue
│   ├── components/
│   │   ├── ProfileSwitcher.vue
│   │   ├── ReminderCard.vue
│   │   ├── RecordCard.vue
│   │   ├── IngestConfirm.vue
│   │   ├── SimilarityDialog.vue
│   │   ├── QrScanner.vue
│   │   └── QrPreview.vue
│   └── sw.ts
├── supabase/
│   ├── migrations/
│   │   ├── 0001_schema.sql
│   │   ├── 0002_rls.sql
│   │   ├── 0003_rpc_replace_record.sql
│   │   ├── 0004_last_profile_trigger.sql
│   │   └── 0005_pg_cron_send_reminders.sql
│   └── functions/
│       └── send-reminders/
│           └── index.ts
├── tests/
│   ├── unit/
│   │   ├── qr-payload.test.ts
│   │   ├── staff-auth.test.ts
│   │   ├── dates.test.ts
│   │   └── similarity.test.ts
│   └── component/
│       ├── IngestConfirm.test.ts
│       └── ProfileSwitcher.test.ts
└── public/
    ├── icons/…
    └── favicon.ico
```

**Responsibility boundaries:**
- `src/lib/*` — pure functions, no framework; fully unit-testable.
- `src/stores/*` — reactive state with Supabase calls; thin wrappers.
- `src/pages/*` — routed views; orchestrate stores and components.
- `src/components/*` — reusable UI pieces; no direct Supabase calls.
- `supabase/migrations/*` — SQL that brings a fresh project to schema parity.
- `supabase/functions/send-reminders/*` — the sole server-side code, Deno.

---

## Phase overview

- **Milestone 1 (Tasks 1–8):** App runs; user can sign up, manage profiles, scan a QR, see history. No reminders yet, no staff page. Ship-able internally.
- **Milestone 2 (Tasks 9–10):** Staff-side generator works. Clinic can produce the QRs that M1 consumes.
- **Milestone 3 (Tasks 11–14):** Reminders + push. The app is feature-complete.
- **Milestone 4 (Task 15):** PWA polish — manifest, icons, install prompt, iOS instructions.

---

See `docs/superpowers/specs/2026-04-22-clinic-records-design.md` for the authoritative design.

Detailed task-by-task steps (with code blocks, test cases, and commit messages) are maintained by the implementation controller on a per-task basis. Controllers will dispatch each task with the full text required for that task, rather than the engineer reading this file section-by-section.

Task list:
1. Project scaffold, deps, Tailwind, router, Pinia
2. Supabase project + schema migrations + RLS + replace_record RPC + last-profile trigger
3. Supabase client + auth store + sign-in/sign-up pages + auth guard
4. Profiles store + Profiles page + ProfileSwitcher + Home shell + Settings logout
5. QR payload encoder/decoder + SHA-256 fingerprint (pure, TDD)
6. Date helper for due_at (pure, TDD)
7. Scan page + QrScanner wrapper (html5-qrcode)
8. Ingest flow — parse, confirm, similarity check, insert + optional reminder, redirect; records store; record detail page with edit/move/delete
9. Staff password gate (PBKDF2 + localStorage flag; router guard)
10. Staff generator page — form with autocomplete, live QR preview, print, dictionary of common names
11. Web Push client — VAPID subscription helpers; prompt after first insert; Settings toggle
12. PWA service worker with push + notificationclick handlers; vite-plugin-pwa wiring
13. Edge Function `send-reminders` — Deno + web-push + VAPID signing + dead-endpoint cleanup
14. pg_cron schedule every 15 minutes + pg_net extension
15. PWA polish — final icons (192/512/maskable), install prompt banner, iOS install guidance
