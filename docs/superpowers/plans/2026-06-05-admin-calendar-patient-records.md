# Admin Calendar + Patient Records Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give clinic staff an authenticated admin surface — a month calendar of every patient's upcoming reminders, and patient search → add/edit/delete of their records and reminders (and edit allergies) — across all patient accounts.

**Architecture:** All patient data already lives in shared `profiles`/`records`/`reminders` tables walled off by RLS scoped to `auth.uid()`. We add a shared clinic account (email in env, password = the staff PIN) that signs in via `signInWithPassword`, an `admins` table + `is_admin()` SQL helper, and new RLS policies that let that account read/write across accounts. Two new admin pages plus a small data layer (`src/lib/admin.ts`) and pure helpers (`src/lib/calendar.ts`, `src/lib/reminders.ts`) round it out. No data migration.

**Tech Stack:** Vue 3 (`<script setup>` + Composition API), Pinia, Vue Router, Supabase (Postgres + RLS + Auth), vue-i18n, Tailwind v4, Vitest.

---

## Conventions for this plan

- **Run a single test file:** `npx vitest run tests/unit/<file>.test.ts`
- **Typecheck the whole app:** `npx vue-tsc -b` (expected: no output, exit 0)
- **Dev server for manual checks:** `pnpm dev` then open the printed URL
- **Path alias:** `@/` → `src/`
- Tests in this repo are pure-function unit tests under `tests/unit/`. Vue SFCs and SQL are verified by typecheck + manual browser/DB checks (no component-test harness is in use).
- **Supabase auth caution (from project memory):** there are two Supabase accounts; this project uses the *secondary*. Before any `supabase db push`, run `supabase migration list --linked` and confirm it targets this project (ref `xuovrjstgifzkwyrevht`).

## File structure (what each new/changed file owns)

| File | Responsibility |
|------|----------------|
| `supabase/migrations/0025_admin_role_and_policies.sql` (create) | `admins` table, `is_admin()`, admin RLS policies, `admin_set_allergies` RPC |
| `.env.example` (modify) | Swap staff hash/salt for `VITE_ADMIN_EMAIL` |
| `src/stores/auth.ts` (modify) | Add `isAdmin` computed |
| `src/pages/staff/Gate.vue` (modify) | Sign in as the clinic account with the PIN |
| `src/lib/staff-auth.ts` (delete) + `tests/unit/staff-auth.test.ts` (delete) | Retire client-side PIN hashing |
| `src/pages/staff/Generate.vue` (modify) | Lock = `auth.signOut()` |
| `src/router/index.ts` (modify) | `requiresStaff` via `isAdmin`; bypass patient gates; landing redirect |
| `src/lib/calendar.ts` (create) | `buildMonthGrid`, `bucketByDate` (pure) |
| `src/lib/reminders.ts` (create) | `reminderTitle`, `reminderKindLabel` (pure, extracted from Home) |
| `src/pages/Home.vue` (modify) | Use the extracted reminder helpers |
| `src/lib/admin.ts` (create) | Cross-account data access: search, calendar fetch, patient bundle, owner-stamped inserts, reminder update, allergies RPC |
| `src/locales/{en,zh,ms}.ts` (modify) | `admin` i18n namespace |
| `src/components/staff/StaffNav.vue` (create) | Shared admin nav (Calendar · Patients · Generate · Lock) |
| `src/components/staff/AdminRecordForm.vue` (create) | Add/edit record form |
| `src/components/staff/AdminReminderForm.vue` (create) | Add/edit reminder form |
| `src/pages/staff/AdminCalendar.vue` (create) | Month grid + day drill-down |
| `src/pages/staff/AdminPatients.vue` (create) | Patient search |
| `src/pages/staff/AdminPatientDetail.vue` (create) | Read patient + manage records/reminders/allergies |

---

## Task 1: Database migration — admin role, RLS, allergies RPC

**Files:**
- Create: `supabase/migrations/0025_admin_role_and_policies.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0025_admin_role_and_policies.sql`:

```sql
-- Cross-account admin role for clinic staff.
--
-- The clinic operates a single shared Supabase account whose password is the
-- staff PIN (its email reaches the client as VITE_ADMIN_EMAIL). That account is
-- listed in `admins`; is_admin() lets new RLS policies grant it read/write
-- across every patient's rows. The existing per-user "own X" policies are
-- untouched and OR with these, so a normal patient still sees only their own
-- data. This is a deliberate escalation from the prior "junk-QR" threat model:
-- the PIN now gates read+write of all patient PHI, so it is a real, server-
-- verified account password rather than a client-side hash.

create table admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table admins enable row level security;
-- Intentionally no policies: authenticated users cannot read or modify this
-- table directly. is_admin() reads it as SECURITY DEFINER (bypassing RLS).

create or replace function is_admin()
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Full CRUD on clinical rows for the admin...
create policy "admin all records" on records
  for all to authenticated
  using (is_admin()) with check (is_admin());

create policy "admin all reminders" on reminders
  for all to authenticated
  using (is_admin()) with check (is_admin());

-- ...read-only on profiles (identity stays patient-owned)...
create policy "admin read profiles" on profiles
  for select to authenticated
  using (is_admin());

-- ...and a narrow, column-scoped write for allergies only, so name/NRIC/DOB
-- cannot be changed by admin even though they sit on the same row.
create or replace function admin_set_allergies(p_profile_id uuid, p_allergies text)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  update public.profiles
     set allergies = p_allergies, updated_at = now()
   where id = p_profile_id;
end;
$$;
```

- [ ] **Step 2: Apply locally and sanity-check the SQL**

If the local Supabase stack is available:
Run: `supabase db reset` (rebuilds from all migrations) — Expected: completes without SQL errors, `0025` listed.

If using only the linked remote, first verify the target, then push:
Run: `supabase migration list --linked` — Expected: lists this project (ref `xuovrjstgifzkwyrevht`); confirm the CLI is logged into the correct (secondary) account before continuing.
Run: `supabase db push` — Expected: applies `0025` with no errors.

- [ ] **Step 3: Seed the clinic account into `admins` (one-time, manual)**

After the shared clinic account exists in Supabase Auth (create it via the dashboard with the chosen email and the PIN as its password), run this once against the database (SQL editor or `psql`), substituting the real email:

```sql
insert into admins (user_id)
select id from auth.users where lower(email) = lower('CLINIC_ACCOUNT_EMAIL_HERE')
on conflict do nothing;
```

Expected: `INSERT 0 1`. Verify: `select * from admins;` shows one row.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0025_admin_role_and_policies.sql
git commit -m "feat(db): admin role, cross-account RLS, allergies RPC"
```

---

## Task 2: Env var + `auth.isAdmin`

**Files:**
- Modify: `.env.example`
- Modify: `src/stores/auth.ts`

- [ ] **Step 1: Update `.env.example`**

Replace the two staff-password lines with the admin email. The file becomes:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_ADMIN_EMAIL=
VITE_VAPID_PUBLIC_KEY=
```

Also set `VITE_ADMIN_EMAIL=<clinic-account-email>` in your local `.env` (not committed).

- [ ] **Step 2: Add `isAdmin` to the auth store**

In `src/stores/auth.ts`, add the computed after `isAnonymous` (around line 63) and include it in the returned object.

```ts
  const isAdmin = computed<boolean>(() => {
    const email = user.value?.email?.toLowerCase()
    const adminEmail = (import.meta.env.VITE_ADMIN_EMAIL as string | undefined)?.toLowerCase()
    return !!email && !!adminEmail && email === adminEmail
  })
```

Update the return statement to include `isAdmin`:

```ts
  return { session, user, loaded, isAnonymous, isAdmin, init, signIn, signUp, signInAnonymously, upgradeToEmail, requestPasswordReset, updatePassword, signOut, discardGuestSession }
```

> Note: `isAdmin` drives routing/UX only. Real authorization is enforced server-side by `is_admin()` RLS, so a spoofed client flag grants no data access.

- [ ] **Step 3: Typecheck**

Run: `npx vue-tsc -b`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add .env.example src/stores/auth.ts
git commit -m "feat(auth): VITE_ADMIN_EMAIL + isAdmin computed"
```

---

## Task 3: Gate signs in as the clinic account; retire client-side PIN hashing

**Files:**
- Modify: `src/pages/staff/Gate.vue`
- Modify: `src/pages/staff/Generate.vue:8,593`
- Delete: `src/lib/staff-auth.ts`
- Delete: `tests/unit/staff-auth.test.ts`

- [ ] **Step 1: Rewrite the Gate `<script setup>`**

Replace the script block in `src/pages/staff/Gate.vue` (lines 1–29) with:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import PasswordField from '@/components/PasswordField.vue'

const router = useRouter()
const auth = useAuthStore()
const { t } = useI18n()
const pw = ref('')
const error = ref<string | null>(null)
const busy = ref(false)

// Already signed in as the clinic account → straight to the calendar.
if (auth.isAdmin) router.replace('/staff/calendar')

async function submit() {
  busy.value = true
  error.value = null
  try {
    // The PIN is literally the shared clinic account's password; Supabase
    // verifies it server-side. The email is non-secret and comes from env.
    await auth.signIn(import.meta.env.VITE_ADMIN_EMAIL as string, pw.value)
    router.replace('/staff/calendar')
  } catch {
    error.value = t('common.error')
  } finally {
    busy.value = false
  }
}
</script>
```

(The `<template>` is unchanged.)

- [ ] **Step 2: Update Generate.vue lock action**

In `src/pages/staff/Generate.vue`:

Replace the import on line 8:
```ts
import { clearStaffUnlocked } from '@/lib/staff-auth'
```
with:
```ts
import { useAuthStore } from '@/stores/auth'
```

Add an auth store instance near the other store setup (after `const router = useRouter()`, around line 39):
```ts
const auth = useAuthStore()
```

Replace `logout()` on line 593:
```ts
function logout() { clearStaffUnlocked(); router.replace('/staff') }
```
with:
```ts
async function logout() { await auth.signOut(); router.replace('/staff') }
```

- [ ] **Step 3: Delete the retired PIN-hashing module and its test**

```bash
git rm src/lib/staff-auth.ts tests/unit/staff-auth.test.ts
```

- [ ] **Step 4: Verify nothing else imports staff-auth**

Run: `grep -rn "staff-auth" src tests`
Expected: no matches.

- [ ] **Step 5: Typecheck**

Run: `npx vue-tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(staff): Gate signs into clinic account via PIN; drop client-side hashing"
```

---

## Task 4: Router — `requiresStaff` via `isAdmin`, bypass patient gates, landing redirect

**Files:**
- Modify: `src/router/index.ts`

- [ ] **Step 1: Add the three admin routes**

In the `routes` array, after the existing `staff-generate` route (line 19), add:

```ts
  { path: '/staff/calendar', name: 'staff-calendar', component: () => import('@/pages/staff/AdminCalendar.vue'), meta: { requiresStaff: true } },
  { path: '/staff/patients', name: 'staff-patients', component: () => import('@/pages/staff/AdminPatients.vue'), meta: { requiresStaff: true } },
  { path: '/staff/patients/:profileId', name: 'staff-patient-detail', component: () => import('@/pages/staff/AdminPatientDetail.vue'), meta: { requiresStaff: true } },
```

> Route names start with `staff`, so `App.vue`'s `watchEffect` applies the `staff-theme` body class automatically.

- [ ] **Step 2: Replace the staff guard and adjust the patient gates**

Replace the landing redirect (lines 34–36):
```ts
  if ((to.name === 'landing' || to.name === 'signup') && auth.user) {
    return { name: 'home' }
  }
```
with:
```ts
  if ((to.name === 'landing' || to.name === 'signup') && auth.user) {
    return auth.isAdmin ? { name: 'staff-calendar' } : { name: 'home' }
  }
```

Replace the `requiresStaff` block (lines 37–40):
```ts
  if (to.meta.requiresStaff) {
    const { isStaffUnlocked } = await import('@/lib/staff-auth')
    if (!isStaffUnlocked()) return { name: 'staff' }
  }
```
with:
```ts
  if (to.meta.requiresStaff && !auth.isAdmin) {
    return { name: 'staff' }
  }
```

Change the patient-gate guard condition (line 45) so the admin account (which has no profiles) is never funneled through them:
```ts
  if (auth.user && to.meta.requiresAuth) {
```
becomes:
```ts
  if (auth.user && to.meta.requiresAuth && !auth.isAdmin) {
```

- [ ] **Step 3: Typecheck**

Run: `npx vue-tsc -b`
Expected: errors only of the form "Cannot find module '@/pages/staff/AdminCalendar.vue'" (those files arrive in later tasks). No errors in `router/index.ts` logic itself.

> If you want a clean typecheck now, create empty placeholder SFCs; otherwise proceed — the modules are created in Tasks 10–13.

- [ ] **Step 4: Commit**

```bash
git add src/router/index.ts
git commit -m "feat(router): admin routes; staff guard via isAdmin; bypass patient gates for admin"
```

---

## Task 5: Pure calendar helpers (`buildMonthGrid`, `bucketByDate`)

**Files:**
- Create: `src/lib/calendar.ts`
- Test: `tests/unit/calendar.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/calendar.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildMonthGrid, bucketByDate } from '@/lib/calendar'
import { dateInMY } from '@/lib/dates'

describe('buildMonthGrid', () => {
  it('returns 42 cells (6 weeks)', () => {
    expect(buildMonthGrid(2026, 2)).toHaveLength(42)
  })

  it('Feb 2026 starts on Sunday with no leading days', () => {
    const cells = buildMonthGrid(2026, 2)
    expect(cells[0]).toEqual({ iso: '2026-02-01', day: 1, inMonth: true })
    expect(cells[27].iso).toBe('2026-02-28')
    expect(cells[28]).toEqual({ iso: '2026-03-01', day: 1, inMonth: false })
  })

  it('in-month cell count equals days in the month', () => {
    expect(buildMonthGrid(2026, 2).filter(c => c.inMonth)).toHaveLength(28) // non-leap
    expect(buildMonthGrid(2024, 2).filter(c => c.inMonth)).toHaveLength(29) // leap
  })

  it('leap-day Feb 29 2024 is present and in-month', () => {
    const leap = buildMonthGrid(2024, 2).find(c => c.iso === '2024-02-29')
    expect(leap?.inMonth).toBe(true)
  })

  it('includes leading days from the previous month when month does not start on Sunday', () => {
    // Feb 1 2024 is a Thursday → 4 leading days from January.
    const cells = buildMonthGrid(2024, 2)
    expect(cells[0]).toEqual({ iso: '2024-01-28', day: 28, inMonth: false })
    expect(cells[4]).toEqual({ iso: '2024-02-01', day: 1, inMonth: true })
  })
})

describe('bucketByDate', () => {
  it('groups items by their MY-local due date across the UTC midnight boundary', () => {
    const rems = [
      { due_at: '2026-02-28T17:00:00Z' }, // +8h => 2026-03-01 01:00 MY
      { due_at: '2026-03-01T02:00:00Z' }, // +8h => 2026-03-01 10:00 MY
      { due_at: '2026-03-02T00:00:00Z' }, // +8h => 2026-03-02 08:00 MY
    ]
    const m = bucketByDate(rems, r => dateInMY(r.due_at))
    expect(m.get('2026-03-01')?.length).toBe(2)
    expect(m.get('2026-03-02')?.length).toBe(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/calendar.test.ts`
Expected: FAIL — cannot resolve `@/lib/calendar`.

- [ ] **Step 3: Implement `src/lib/calendar.ts`**

```ts
export interface MonthCell {
  iso: string // YYYY-MM-DD, a plain calendar date (MY-local date space)
  day: number // 1..31
  inMonth: boolean // false for leading/trailing days from adjacent months
}

/**
 * Build a fixed 6-row (42-cell) month grid for `year`/`month` (month is
 * 1-based), weeks starting on Sunday. Leading cells come from the previous
 * month and trailing cells from the next, so every week is full. Cells carry
 * plain calendar dates with no timezone — callers bucket reminders by MY-local
 * date via `dateInMY()`, so grid cells and buckets share the same date space.
 * UTC arithmetic is used purely as a timezone-free calendar calculator.
 */
export function buildMonthGrid(year: number, month: number): MonthCell[] {
  const first = new Date(Date.UTC(year, month - 1, 1))
  const startDow = first.getUTCDay() // 0 = Sunday
  const start = new Date(first)
  start.setUTCDate(1 - startDow) // back up to the Sunday on/before the 1st
  const cells: MonthCell[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + i)
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth() + 1
    const day = d.getUTCDate()
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    cells.push({ iso, day, inMonth: y === year && m === month })
  }
  return cells
}

/** Group items into a Map keyed by `dateKey(item)`, preserving input order. */
export function bucketByDate<T>(items: T[], dateKey: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const k = dateKey(item)
    const arr = map.get(k)
    if (arr) arr.push(item)
    else map.set(k, [item])
  }
  return map
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/calendar.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/calendar.ts tests/unit/calendar.test.ts
git commit -m "feat(calendar): pure month-grid + date-bucketing helpers"
```

---

## Task 6: Extract reminder-title helpers and reuse them in Home

**Files:**
- Create: `src/lib/reminders.ts`
- Test: `tests/unit/reminders.test.ts`
- Modify: `src/pages/Home.vue`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/reminders.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { reminderTitle, reminderKindLabel, type ReminderRecordInfo } from '@/lib/reminders'
import type { Reminder } from '@/stores/records'

// Mock translator: echoes the key and named args so assertions are explicit.
const t = (key: string, named?: Record<string, unknown>) =>
  named ? `${key}:${JSON.stringify(named)}` : key

function rem(partial: Partial<Reminder>): Reminder {
  return {
    id: 'r', user_id: 'u', profile_id: 'p', record_id: null,
    kind: 'next_dose', name: null, due_at: '2026-06-01T00:00:00Z',
    sent_at: null, created_at: '2026-05-01T00:00:00Z', ...partial,
  }
}

describe('reminderTitle', () => {
  it('bound vaccination → next dose number', () => {
    const rec: ReminderRecordInfo = { kind: 'vaccination', name: 'Hep B', dose_number: 1, total_doses: 3 }
    expect(reminderTitle(rem({ kind: 'next_dose', record_id: 'x' }), rec, t))
      .toBe('home.nextDoseTitle:{"name":"Hep B","n":2}')
  })

  it('booster (dose >= total) → plain record name, no "dose N"', () => {
    const rec: ReminderRecordInfo = { kind: 'vaccination', name: 'Flu', dose_number: 1, total_doses: 1 }
    expect(reminderTitle(rem({ kind: 'next_dose', record_id: 'x' }), rec, t)).toBe('Flu')
  })

  it('bound follow-up test', () => {
    const rec: ReminderRecordInfo = { kind: 'blood_test', name: 'FBC', dose_number: null, total_doses: null }
    expect(reminderTitle(rem({ kind: 'followup_test', record_id: 'x' }), rec, t))
      .toBe('home.followupTitle:{"name":"FBC"}')
  })

  it('orphan reminder-only (next_dose) uses r.name', () => {
    expect(reminderTitle(rem({ kind: 'next_dose', name: 'Tetanus' }), null, t))
      .toBe('home.nextDoseReminderTitle:{"name":"Tetanus"}')
  })

  it('generic fallback when no record and no name', () => {
    expect(reminderTitle(rem({ kind: 'other', name: null }), null, t)).toBe('home.reminderGeneric')
  })
})

describe('reminderKindLabel', () => {
  it('maps known kinds', () => {
    expect(reminderKindLabel('next_dose', t)).toBe('home.kindNextDose')
    expect(reminderKindLabel('followup_test', t)).toBe('home.kindFollowupTest')
  })
  it('humanizes unknown kinds', () => {
    expect(reminderKindLabel('some_other', t)).toBe('some other')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/reminders.test.ts`
Expected: FAIL — cannot resolve `@/lib/reminders`.

- [ ] **Step 3: Implement `src/lib/reminders.ts`**

```ts
import type { Reminder } from '@/stores/records'

/** The subset of a record needed to title a reminder (structural). */
export interface ReminderRecordInfo {
  kind: string
  name: string
  dose_number: number | null
  total_doses: number | null
}

export type Translate = (key: string, named?: Record<string, unknown>) => string

/**
 * Human title for a reminder. If `rec` is the linked record, derive the next
 * dose / follow-up wording; otherwise fall back to the reminder's own `name`
 * (reminder-only entries), then a generic label. Extracted verbatim from
 * Home.vue so the admin calendar and detail views share one source of truth.
 */
export function reminderTitle(r: Reminder, rec: ReminderRecordInfo | null | undefined, t: Translate): string {
  if (rec) {
    if (r.kind === 'next_dose' && rec.kind === 'vaccination' && rec.dose_number != null) {
      const booster = rec.total_doses != null && rec.dose_number >= rec.total_doses
      if (!booster) return t('home.nextDoseTitle', { name: rec.name, n: rec.dose_number + 1 })
      return rec.name
    }
    if (r.kind === 'followup_test') return t('home.followupTitle', { name: rec.name })
    return rec.name
  }
  if (r.name) {
    if (r.kind === 'next_dose') return t('home.nextDoseReminderTitle', { name: r.name })
    if (r.kind === 'followup_test') return t('home.followupTitle', { name: r.name })
    return r.name
  }
  return t('home.reminderGeneric')
}

export function reminderKindLabel(kind: string, t: Translate): string {
  if (kind === 'next_dose') return t('home.kindNextDose')
  if (kind === 'followup_test') return t('home.kindFollowupTest')
  return kind.replace('_', ' ')
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/reminders.test.ts`
Expected: PASS.

- [ ] **Step 5: Refactor Home.vue to use the shared helpers**

In `src/pages/Home.vue`:

Add to the imports near the top of `<script setup>` (after the `dates` import on line 6):
```ts
import { reminderTitle as titleOf, reminderKindLabel as kindLabelOf } from '@/lib/reminders'
```

Delete the local `reminderKindLabel` function (lines 100–104) and the local `reminderTitle` function (lines 105–129). Replace them with thin wrappers that close over the records store and `t`:

```ts
function reminderKindLabel(k: string) {
  return kindLabelOf(k, t)
}
function reminderTitle(r: Reminder) {
  return titleOf(r, records.records.find(x => x.id === r.record_id), t)
}
```

(The template still calls `reminderKindLabel(r.kind)` and `reminderTitle(r)`, so no template change is needed.)

- [ ] **Step 6: Run the full unit suite + typecheck**

Run: `npx vitest run`
Expected: PASS (all files, including the new ones).
Run: `npx vue-tsc -b`
Expected: errors only for the not-yet-created `@/pages/staff/Admin*.vue` modules (from Task 4). No errors in `Home.vue` or `reminders.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/reminders.ts tests/unit/reminders.test.ts src/pages/Home.vue
git commit -m "refactor(reminders): extract reminderTitle/kindLabel; reuse in Home"
```

---

## Task 7: Admin data layer (`src/lib/admin.ts`)

**Files:**
- Create: `src/lib/admin.ts`
- Test: `tests/unit/admin.test.ts`

- [ ] **Step 1: Write the failing test (search builder + insert ownership)**

Create `tests/unit/admin.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Capture insert payloads via a mocked supabase client.
const insertSpy = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: (payload: unknown) => {
        insertSpy(payload)
        return { select: () => ({ single: () => Promise.resolve({ data: payload, error: null }) }) }
      },
    }),
  },
}))

import { buildSearchFilter, adminCreateRecord, adminCreateReminder } from '@/lib/admin'

beforeEach(() => insertSpy.mockClear())

describe('buildSearchFilter', () => {
  it('strips PostgREST-breaking characters and builds name/nric ilike', () => {
    expect(buildSearchFilter('a,b%(c)*')).toBe('name.ilike.%abc%,nric.ilike.%abc%')
  })
  it('trims surrounding whitespace', () => {
    expect(buildSearchFilter('  Tan  ')).toBe('name.ilike.%Tan%,nric.ilike.%Tan%')
  })
})

describe('admin insert ownership', () => {
  it('adminCreateRecord stamps the patient owner user_id, never the admin', async () => {
    await adminCreateRecord('owner-123', 'profile-9', {
      kind: 'vaccination', name: 'Hep B', performed_on: '2026-06-01',
      dose_number: 1, total_doses: 3, notes: null,
    })
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'owner-123', profile_id: 'profile-9', kind: 'vaccination',
    }))
  })

  it('adminCreateRecord nulls dose fields for blood tests', async () => {
    await adminCreateRecord('owner-123', 'profile-9', {
      kind: 'blood_test', name: 'FBC', performed_on: '2026-06-01',
      dose_number: 2, total_doses: 4, notes: null,
    })
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({
      dose_number: null, total_doses: null,
    }))
  })

  it('adminCreateReminder stamps owner user_id and a null record_id', async () => {
    await adminCreateReminder('owner-123', 'profile-9', {
      kind: 'next_dose', name: 'Hep B', due_at: '2026-07-01T00:00:00Z',
    })
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'owner-123', profile_id: 'profile-9', record_id: null, kind: 'next_dose',
    }))
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/admin.test.ts`
Expected: FAIL — cannot resolve `@/lib/admin`.

- [ ] **Step 3: Implement `src/lib/admin.ts`**

```ts
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/stores/profiles'
import type { Record as ClinicRecord, Reminder } from '@/stores/records'

export interface AdminPatient {
  id: string
  user_id: string
  name: string
  nric: string | null
  date_of_birth: string | null
  nationality: string
  allergies: string | null
}

export interface AdminReminder extends Reminder {
  profile: { name: string; nric: string | null; date_of_birth: string | null } | null
  record: { name: string; kind: string; dose_number: number | null; total_doses: number | null } | null
}

export interface AdminRecordInput {
  kind: 'vaccination' | 'blood_test'
  name: string
  performed_on: string
  dose_number: number | null
  total_doses: number | null
  notes: string | null
}

export interface AdminReminderInput {
  kind: 'next_dose' | 'followup_test' | 'other'
  name: string | null
  due_at: string
}

/**
 * Build the PostgREST `or` filter for a patient search. Commas, parens and the
 * `%`/`*` wildcards would break the filter grammar, so strip them and match the
 * remainder as a case-insensitive substring against both name and NRIC.
 */
export function buildSearchFilter(query: string): string {
  const safe = query.trim().replace(/[,()%*]/g, '')
  return `name.ilike.%${safe}%,nric.ilike.%${safe}%`
}

export async function searchPatients(query: string): Promise<AdminPatient[]> {
  if (query.trim().length < 2) return []
  const { data, error } = await supabase
    .from('profiles')
    .select('id,user_id,name,nric,date_of_birth,nationality,allergies')
    .or(buildSearchFilter(query))
    .order('name', { ascending: true })
    .limit(50)
  if (error) throw error
  return (data ?? []) as AdminPatient[]
}

export async function fetchUpcomingReminders(fromIso: string, toIso: string): Promise<AdminReminder[]> {
  const { data, error } = await supabase
    .from('reminders')
    .select('*, profile:profiles(name,nric,date_of_birth), record:records(name,kind,dose_number,total_doses)')
    .gte('due_at', fromIso)
    .lt('due_at', toIso)
    .order('due_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as AdminReminder[]
}

export async function fetchPatientBundle(profileId: string): Promise<{
  profile: Profile
  records: ClinicRecord[]
  reminders: Reminder[]
}> {
  const [{ data: profile, error: pe }, { data: recs, error: re }, { data: rems, error: me }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', profileId).single(),
    supabase.from('records').select('*').eq('profile_id', profileId).order('performed_on', { ascending: false }),
    supabase.from('reminders').select('*').eq('profile_id', profileId).order('due_at', { ascending: true }),
  ])
  if (pe) throw pe
  if (re) throw re
  if (me) throw me
  return {
    profile: profile as Profile,
    records: (recs ?? []) as ClinicRecord[],
    reminders: (rems ?? []) as Reminder[],
  }
}

/**
 * Insert a record on behalf of a patient. CRITICAL: user_id is the patient's
 * OWNER id (read off their profile), not the admin's — otherwise the row would
 * be invisible to the patient (their RLS is user_id = auth.uid()).
 */
export async function adminCreateRecord(ownerUserId: string, profileId: string, input: AdminRecordInput): Promise<ClinicRecord> {
  const { data, error } = await supabase.from('records').insert({
    user_id: ownerUserId,
    profile_id: profileId,
    kind: input.kind,
    name: input.name,
    performed_on: input.performed_on,
    dose_number: input.kind === 'vaccination' ? input.dose_number : null,
    total_doses: input.kind === 'vaccination' ? input.total_doses : null,
    notes: input.notes,
  }).select().single()
  if (error) throw error
  return data as ClinicRecord
}

export async function adminCreateReminder(ownerUserId: string, profileId: string, input: AdminReminderInput): Promise<Reminder> {
  const { data, error } = await supabase.from('reminders').insert({
    user_id: ownerUserId,
    profile_id: profileId,
    record_id: null,
    kind: input.kind,
    name: input.name,
    due_at: input.due_at,
  }).select().single()
  if (error) throw error
  return data as Reminder
}

export async function adminUpdateReminder(id: string, patch: { name?: string | null; due_at?: string }): Promise<Reminder> {
  const { data, error } = await supabase.from('reminders').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data as Reminder
}

export async function adminSetAllergies(profileId: string, allergies: string): Promise<void> {
  const { error } = await supabase.rpc('admin_set_allergies', { p_profile_id: profileId, p_allergies: allergies })
  if (error) throw error
}
```

> Edit/delete of records and reminders reuse the existing store mutations
> (`updateRecord`, `deleteRecord`, `deleteReminder` in `src/stores/records.ts`),
> which key off `id` and rely on RLS — no `user_id` involved.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/admin.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin.ts tests/unit/admin.test.ts
git commit -m "feat(admin): cross-account data layer (search, calendar, bundle, owner-stamped inserts)"
```

---

## Task 8: i18n — `admin` namespace in all three locales

**Files:**
- Modify: `src/locales/en.ts`
- Modify: `src/locales/zh.ts`
- Modify: `src/locales/ms.ts`

- [ ] **Step 1: Add the `admin` block to `src/locales/en.ts`**

Insert before the `appUpdate:` namespace (it sits after `staff:`):

```ts
  admin: {
    navCalendar: 'Calendar',
    navPatients: 'Patients',
    navGenerate: 'Generate',
    lock: 'Lock',
    calendarTitle: 'Reminders',
    today: 'Today',
    dueCount: '{count} due',
    nothingDue: 'Nothing due',
    selectDay: 'Select a day to see its reminders.',
    patientsTitle: 'Patients',
    searchPlaceholder: 'Search name or NRIC…',
    searchHint: 'Type at least 2 characters.',
    noResults: 'No patients found.',
    dobLabel: 'DOB',
    nricLabel: 'NRIC',
    recordsTitle: 'Records',
    remindersTitle: 'Reminders',
    allergiesTitle: 'Allergies',
    addRecord: '+ Add record',
    addReminder: '+ Add reminder',
    addRecordTitle: 'Add record',
    editRecordTitle: 'Edit record',
    addReminderTitle: 'Add reminder',
    editReminderTitle: 'Edit reminder',
    editAllergies: 'Edit',
    allergyPlaceholder: 'e.g. Penicillin (severe rash)',
    noKnownAllergies: 'No known allergies',
    noAllergyRecord: 'No allergy record on file.',
    reminderKind: 'Reminder type',
    kindOther: 'Other',
    reminderName: 'Label',
    dueDate: 'Due date',
    noRecords: 'No records.',
    noReminders: 'No reminders.',
    confirmDeleteRecord: 'Delete this record?',
    confirmDeleteReminder: 'Delete this reminder?',
    backToPatients: '← patients',
  },
```

- [ ] **Step 2: Add the `admin` block to `src/locales/zh.ts`** (same position)

```ts
  admin: {
    navCalendar: '日历',
    navPatients: '病患',
    navGenerate: '生成',
    lock: '锁定',
    calendarTitle: '提醒',
    today: '今天',
    dueCount: '{count} 项',
    nothingDue: '无提醒',
    selectDay: '选择日期以查看当天提醒。',
    patientsTitle: '病患',
    searchPlaceholder: '搜索姓名或身份证号…',
    searchHint: '请至少输入 2 个字符。',
    noResults: '未找到病患。',
    dobLabel: '出生日期',
    nricLabel: '身份证号',
    recordsTitle: '记录',
    remindersTitle: '提醒',
    allergiesTitle: '过敏',
    addRecord: '+ 添加记录',
    addReminder: '+ 添加提醒',
    addRecordTitle: '添加记录',
    editRecordTitle: '编辑记录',
    addReminderTitle: '添加提醒',
    editReminderTitle: '编辑提醒',
    editAllergies: '编辑',
    allergyPlaceholder: '例如：青霉素（严重皮疹）',
    noKnownAllergies: '无已知过敏',
    noAllergyRecord: '暂无过敏记录。',
    reminderKind: '提醒类型',
    kindOther: '其他',
    reminderName: '名称',
    dueDate: '到期日期',
    noRecords: '暂无记录。',
    noReminders: '暂无提醒。',
    confirmDeleteRecord: '删除此记录？',
    confirmDeleteReminder: '删除此提醒？',
    backToPatients: '← 病患',
  },
```

- [ ] **Step 3: Add the `admin` block to `src/locales/ms.ts`** (same position)

```ts
  admin: {
    navCalendar: 'Kalendar',
    navPatients: 'Pesakit',
    navGenerate: 'Jana',
    lock: 'Kunci',
    calendarTitle: 'Peringatan',
    today: 'Hari ini',
    dueCount: '{count} perlu',
    nothingDue: 'Tiada peringatan',
    selectDay: 'Pilih tarikh untuk melihat peringatannya.',
    patientsTitle: 'Pesakit',
    searchPlaceholder: 'Cari nama atau NRIC…',
    searchHint: 'Taip sekurang-kurangnya 2 aksara.',
    noResults: 'Tiada pesakit dijumpai.',
    dobLabel: 'Tarikh lahir',
    nricLabel: 'NRIC',
    recordsTitle: 'Rekod',
    remindersTitle: 'Peringatan',
    allergiesTitle: 'Alahan',
    addRecord: '+ Tambah rekod',
    addReminder: '+ Tambah peringatan',
    addRecordTitle: 'Tambah rekod',
    editRecordTitle: 'Sunting rekod',
    addReminderTitle: 'Tambah peringatan',
    editReminderTitle: 'Sunting peringatan',
    editAllergies: 'Sunting',
    allergyPlaceholder: 'cth. Penisilin (ruam teruk)',
    noKnownAllergies: 'Tiada alahan diketahui',
    noAllergyRecord: 'Tiada rekod alahan.',
    reminderKind: 'Jenis peringatan',
    kindOther: 'Lain-lain',
    reminderName: 'Label',
    dueDate: 'Tarikh perlu',
    noRecords: 'Tiada rekod.',
    noReminders: 'Tiada peringatan.',
    confirmDeleteRecord: 'Padam rekod ini?',
    confirmDeleteReminder: 'Padam peringatan ini?',
    backToPatients: '← pesakit',
  },
```

- [ ] **Step 4: Typecheck**

Run: `npx vue-tsc -b`
Expected: errors only for the not-yet-created `Admin*.vue` modules. The locale files compile.

- [ ] **Step 5: Commit**

```bash
git add src/locales/en.ts src/locales/zh.ts src/locales/ms.ts
git commit -m "i18n: admin namespace (en/zh/ms)"
```

---

## Task 9: Shared `StaffNav` component

**Files:**
- Create: `src/components/staff/StaffNav.vue`

- [ ] **Step 1: Implement the component**

```vue
<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const items = [
  { name: 'staff-calendar', to: '/staff/calendar', key: 'admin.navCalendar' },
  { name: 'staff-patients', to: '/staff/patients', key: 'admin.navPatients' },
  { name: 'staff-generate', to: '/staff/generate', key: 'admin.navGenerate' },
] as const

async function lock() {
  await auth.signOut()
  router.replace('/staff')
}
</script>

<template>
  <nav class="flex items-center gap-1 hairline-b pb-3 mb-6 text-xs">
    <router-link
      v-for="it in items"
      :key="it.name"
      :to="it.to"
      class="px-3 py-1.5 eyebrow hover:text-ink"
      :style="route.name === it.name ? 'color: var(--color-staff-accent)' : ''"
    >{{ $t(it.key) }}</router-link>
    <button class="ml-auto px-3 py-1.5 eyebrow hover:text-ink" @click="lock">{{ $t('admin.lock') }}</button>
  </nav>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/staff/StaffNav.vue
git commit -m "feat(staff): shared admin nav (Calendar/Patients/Generate/Lock)"
```

---

## Task 10: `AdminCalendar` page

**Files:**
- Create: `src/pages/staff/AdminCalendar.vue`

- [ ] **Step 1: Implement the page**

```vue
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import StaffNav from '@/components/staff/StaffNav.vue'
import { fetchUpcomingReminders, type AdminReminder } from '@/lib/admin'
import { buildMonthGrid, bucketByDate, type MonthCell } from '@/lib/calendar'
import { dateInMY, todayLocalIso, dateFmtLocale } from '@/lib/dates'
import { reminderTitle } from '@/lib/reminders'
import { useDialog } from '@/lib/dialog'

const { t, locale } = useI18n()
const router = useRouter()
const dialog = useDialog()

const today = todayLocalIso() // YYYY-MM-DD in MY
const [ty, tm] = today.split('-').map(Number)
const viewYear = ref(ty)
const viewMonth = ref(tm) // 1-based
const selectedIso = ref(today)
const reminders = ref<AdminReminder[]>([])
const loading = ref(false)

const grid = computed<MonthCell[]>(() => buildMonthGrid(viewYear.value, viewMonth.value))
const buckets = computed(() => bucketByDate(reminders.value, (r) => dateInMY(r.due_at)))
const selectedReminders = computed<AdminReminder[]>(() => buckets.value.get(selectedIso.value) ?? [])

function countFor(iso: string): number {
  return buckets.value.get(iso)?.length ?? 0
}

const monthLabel = computed(() =>
  new Date(Date.UTC(viewYear.value, viewMonth.value - 1, 1)).toLocaleDateString(
    dateFmtLocale(locale.value),
    { month: 'long', year: 'numeric', timeZone: 'UTC' },
  ),
)

const weekdays = computed(() => {
  // Sun..Sat short names in the active locale.
  const fmt = new Intl.DateTimeFormat(dateFmtLocale(locale.value), { weekday: 'short', timeZone: 'UTC' })
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2024, 0, 7 + i)))) // 2024-01-07 is a Sunday
})

async function load() {
  loading.value = true
  try {
    const mm = String(viewMonth.value).padStart(2, '0')
    const from = `${viewYear.value}-${mm}-01T00:00:00+08:00`
    const nm = viewMonth.value === 12 ? 1 : viewMonth.value + 1
    const nyr = viewMonth.value === 12 ? viewYear.value + 1 : viewYear.value
    const to = `${nyr}-${String(nm).padStart(2, '0')}-01T00:00:00+08:00`
    reminders.value = await fetchUpcomingReminders(from, to)
  } catch (e) {
    await dialog.alertError(e, t('common.error'))
  } finally {
    loading.value = false
  }
}

function prev() {
  if (viewMonth.value === 1) { viewMonth.value = 12; viewYear.value-- } else viewMonth.value--
}
function next() {
  if (viewMonth.value === 12) { viewMonth.value = 1; viewYear.value++ } else viewMonth.value++
}
function goToday() {
  viewYear.value = ty
  viewMonth.value = tm
  selectedIso.value = today
}

function titleFor(r: AdminReminder): string {
  return reminderTitle(r, r.record, t)
}

watch([viewYear, viewMonth], load)
onMounted(load)
</script>

<template>
  <main class="min-h-dvh pb-20">
    <div class="max-w-[1100px] mx-auto px-6 lg:px-10 pt-6">
      <StaffNav />

      <header class="flex items-center justify-between gap-4 mb-6">
        <div>
          <div class="eyebrow"><span class="tick" style="background: var(--color-staff-accent)"></span>{{ $t('admin.calendarTitle') }}</div>
          <h1 class="font-display text-4xl leading-tight">{{ monthLabel }}</h1>
        </div>
        <div class="flex items-center gap-2 text-sm">
          <button class="btn-ghost !py-1.5 !px-3" @click="prev" aria-label="previous month">←</button>
          <button class="btn-ghost !py-1.5 !px-3" @click="goToday">{{ $t('admin.today') }}</button>
          <button class="btn-ghost !py-1.5 !px-3" @click="next" aria-label="next month">→</button>
        </div>
      </header>

      <div class="grid grid-cols-7 gap-px text-center eyebrow mb-1">
        <div v-for="w in weekdays" :key="w" class="py-1">{{ w }}</div>
      </div>
      <div class="grid grid-cols-7 gap-px">
        <button
          v-for="cell in grid"
          :key="cell.iso"
          type="button"
          @click="selectedIso = cell.iso"
          class="aspect-square p-1.5 flex flex-col items-start hairline relative transition-colors"
          :class="[
            cell.inMonth ? '' : 'opacity-40',
            selectedIso === cell.iso ? 'bg-[var(--color-staff-panel)]' : 'hover:bg-[var(--color-staff-panel)]',
          ]"
          :style="cell.iso === today ? 'outline: 1px solid var(--color-staff-accent); outline-offset: -1px;' : ''"
        >
          <span class="text-xs tabular-nums">{{ cell.day }}</span>
          <span
            v-if="countFor(cell.iso) > 0"
            class="mt-auto self-end font-mono-app text-[10px] px-1.5 py-0.5 rounded-full"
            style="background: var(--color-staff-accent); color: var(--color-staff-paper)"
          >{{ countFor(cell.iso) }}</span>
        </button>
      </div>

      <!-- Selected-day drill-down doubles as the agenda on narrow screens. -->
      <section class="mt-8">
        <h2 class="font-display text-2xl mb-3">{{ selectedIso }}</h2>
        <p v-if="selectedReminders.length === 0" class="text-sm text-[var(--color-staff-muted)]">{{ $t('admin.nothingDue') }}</p>
        <ul v-else class="space-y-2">
          <li v-for="r in selectedReminders" :key="r.id">
            <button
              type="button"
              class="w-full text-left paper-card p-4 flex items-center justify-between gap-3 hover:bg-[var(--color-staff-panel)]"
              @click="router.push(`/staff/patients/${r.profile_id}`)"
            >
              <div>
                <div class="font-display text-lg leading-tight">{{ titleFor(r) }}</div>
                <div class="text-xs text-[var(--color-staff-muted)] mt-0.5">{{ r.profile?.name }}<span v-if="r.profile?.nric"> · {{ r.profile.nric }}</span></div>
              </div>
              <span class="text-[var(--color-staff-accent)]">→</span>
            </button>
          </li>
        </ul>
      </section>
    </div>
  </main>
</template>
```

- [ ] **Step 2: Typecheck**

Run: `npx vue-tsc -b`
Expected: errors only for `AdminPatients.vue` / `AdminPatientDetail.vue` (created next). No errors in `AdminCalendar.vue`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/staff/AdminCalendar.vue
git commit -m "feat(admin): reminders calendar (month grid + day drill-down)"
```

---

## Task 11: `AdminPatients` search page

**Files:**
- Create: `src/pages/staff/AdminPatients.vue`

- [ ] **Step 1: Implement the page**

```vue
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import StaffNav from '@/components/staff/StaffNav.vue'
import { searchPatients, type AdminPatient } from '@/lib/admin'
import { formatDateShort } from '@/lib/dates'
import { useDialog } from '@/lib/dialog'

const { t, locale } = useI18n()
const dialog = useDialog()

const query = ref('')
const results = ref<AdminPatient[]>([])
const searched = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

watch(query, (q) => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(async () => {
    if (q.trim().length < 2) {
      results.value = []
      searched.value = false
      return
    }
    try {
      results.value = await searchPatients(q)
      searched.value = true
    } catch (e) {
      await dialog.alertError(e, t('common.error'))
    }
  }, 250)
})

function dob(p: AdminPatient): string {
  return p.date_of_birth ? formatDateShort(p.date_of_birth, locale.value) : '—'
}
</script>

<template>
  <main class="min-h-dvh pb-20">
    <div class="max-w-[860px] mx-auto px-6 lg:px-10 pt-6">
      <StaffNav />

      <header class="mb-6">
        <div class="eyebrow"><span class="tick" style="background: var(--color-staff-accent)"></span>{{ $t('admin.patientsTitle') }}</div>
        <h1 class="font-display text-4xl leading-tight">{{ $t('admin.patientsTitle') }}</h1>
      </header>

      <input
        v-model="query"
        type="search"
        class="field text-lg"
        :placeholder="$t('admin.searchPlaceholder')"
        autocomplete="off"
      />

      <p v-if="query.trim().length < 2" class="text-sm text-[var(--color-staff-muted)] mt-4">{{ $t('admin.searchHint') }}</p>
      <p v-else-if="searched && results.length === 0" class="text-sm text-[var(--color-staff-muted)] mt-4">{{ $t('admin.noResults') }}</p>

      <ul v-else class="mt-4 divide-y divide-[var(--color-staff-rule)] hairline-t hairline-b">
        <li v-for="p in results" :key="p.id">
          <router-link
            :to="`/staff/patients/${p.id}`"
            class="grid grid-cols-[1fr_auto] items-baseline gap-4 py-4 px-1 hover:bg-[var(--color-staff-panel)] transition-colors"
          >
            <div>
              <div class="font-display text-xl leading-tight">{{ p.name }}</div>
              <div class="text-xs text-[var(--color-staff-muted)] mt-0.5">
                <span>{{ $t('admin.nricLabel') }}: {{ p.nric ?? '—' }}</span>
                <span class="mx-2">·</span>
                <span>{{ $t('admin.dobLabel') }}: {{ dob(p) }}</span>
              </div>
            </div>
            <span class="text-[var(--color-staff-accent)]">→</span>
          </router-link>
        </li>
      </ul>
    </div>
  </main>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/staff/AdminPatients.vue
git commit -m "feat(admin): patient search by name/NRIC"
```

---

## Task 12: Record & reminder form components

**Files:**
- Create: `src/components/staff/AdminRecordForm.vue`
- Create: `src/components/staff/AdminReminderForm.vue`

- [ ] **Step 1: Implement `AdminRecordForm.vue`**

```vue
<script setup lang="ts">
import { reactive } from 'vue'
import type { Record as ClinicRecord } from '@/stores/records'
import type { AdminRecordInput } from '@/lib/admin'
import { todayLocalIso } from '@/lib/dates'

const props = defineProps<{ record?: ClinicRecord | null }>()
const emit = defineEmits<{
  (e: 'submit', value: AdminRecordInput): void
  (e: 'cancel'): void
}>()

const isEdit = !!props.record
const form = reactive<AdminRecordInput>({
  kind: props.record?.kind ?? 'vaccination',
  name: props.record?.name ?? '',
  performed_on: props.record?.performed_on ?? todayLocalIso(),
  dose_number: props.record?.dose_number ?? null,
  total_doses: props.record?.total_doses ?? null,
  notes: props.record?.notes ?? null,
})

function submit() {
  if (!form.name.trim()) return
  emit('submit', { ...form })
}
</script>

<template>
  <form class="space-y-4 paper-card p-5" @submit.prevent="submit">
    <div class="eyebrow">{{ isEdit ? $t('admin.editRecordTitle') : $t('admin.addRecordTitle') }}</div>

    <div v-if="!isEdit" class="flex gap-2">
      <button type="button" class="btn-ghost text-sm" :style="form.kind === 'vaccination' ? 'border-color: var(--color-staff-accent); color: var(--color-staff-accent)' : ''" @click="form.kind = 'vaccination'">{{ $t('home.kindVaccination') }}</button>
      <button type="button" class="btn-ghost text-sm" :style="form.kind === 'blood_test' ? 'border-color: var(--color-staff-accent); color: var(--color-staff-accent)' : ''" @click="form.kind = 'blood_test'">{{ $t('home.kindBloodTest') }}</button>
    </div>

    <label class="block">
      <span class="field-label">{{ $t('recordDetail.name') }}</span>
      <input v-model="form.name" class="field" />
    </label>
    <label class="block">
      <span class="field-label">{{ $t('recordDetail.performedOn') }}</span>
      <input v-model="form.performed_on" type="date" class="field" />
    </label>
    <div v-if="form.kind === 'vaccination'" class="grid grid-cols-2 gap-3">
      <label class="block">
        <span class="field-label">{{ $t('recordDetail.doseNumber') }}</span>
        <input v-model.number="form.dose_number" type="number" min="1" class="field tabular-nums" />
      </label>
      <label class="block">
        <span class="field-label">{{ $t('recordDetail.of') }}</span>
        <input v-model.number="form.total_doses" type="number" min="1" class="field tabular-nums" />
      </label>
    </div>
    <label class="block">
      <span class="field-label">{{ $t('recordDetail.note') }}</span>
      <textarea v-model="form.notes" rows="2" class="field resize-none" :placeholder="$t('recordDetail.notePlaceholder')"></textarea>
    </label>

    <div class="flex gap-2 pt-1">
      <button class="btn-primary" :disabled="!form.name.trim()">{{ $t('common.save') }}</button>
      <button type="button" class="btn-ghost" @click="emit('cancel')">{{ $t('common.cancel') }}</button>
    </div>
  </form>
</template>
```

- [ ] **Step 2: Implement `AdminReminderForm.vue`**

```vue
<script setup lang="ts">
import { reactive } from 'vue'
import type { Reminder } from '@/stores/records'
import type { AdminReminderInput } from '@/lib/admin'
import { todayLocalIso, dateInMY, computeDueAt } from '@/lib/dates'

const props = defineProps<{ reminder?: Reminder | null }>()
const emit = defineEmits<{
  (e: 'submit', value: AdminReminderInput): void
  (e: 'cancel'): void
}>()

const isEdit = !!props.reminder
// The form edits a plain date; convert to a due_at timestamp on submit.
const form = reactive<{ kind: AdminReminderInput['kind']; name: string; date: string }>({
  kind: props.reminder?.kind ?? 'next_dose',
  name: props.reminder?.name ?? '',
  date: props.reminder ? dateInMY(props.reminder.due_at) : todayLocalIso(),
})

const kinds: AdminReminderInput['kind'][] = ['next_dose', 'followup_test', 'other']
function kindKey(k: AdminReminderInput['kind']): string {
  if (k === 'next_dose') return 'home.kindNextDose'
  if (k === 'followup_test') return 'home.kindFollowupTest'
  return 'admin.kindOther'
}

function submit() {
  if (!form.date) return
  emit('submit', {
    kind: form.kind,
    name: form.name.trim() || null,
    // computeDueAt(date, 0, 'd') == 08:00 MY (== 00:00 UTC) on that date,
    // matching how QR-derived reminders are scheduled.
    due_at: computeDueAt(form.date, 0, 'd'),
  })
}
</script>

<template>
  <form class="space-y-4 paper-card p-5" @submit.prevent="submit">
    <div class="eyebrow">{{ isEdit ? $t('admin.editReminderTitle') : $t('admin.addReminderTitle') }}</div>

    <label class="block">
      <span class="field-label">{{ $t('admin.reminderKind') }}</span>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="k in kinds" :key="k" type="button"
          class="btn-ghost text-sm"
          :style="form.kind === k ? 'border-color: var(--color-staff-accent); color: var(--color-staff-accent)' : ''"
          @click="form.kind = k"
        >{{ $t(kindKey(k)) }}</button>
      </div>
    </label>
    <label class="block">
      <span class="field-label">{{ $t('admin.reminderName') }}</span>
      <input v-model="form.name" class="field" />
    </label>
    <label class="block">
      <span class="field-label">{{ $t('admin.dueDate') }}</span>
      <input v-model="form.date" type="date" class="field" />
    </label>

    <div class="flex gap-2 pt-1">
      <button class="btn-primary" :disabled="!form.date">{{ $t('common.save') }}</button>
      <button type="button" class="btn-ghost" @click="emit('cancel')">{{ $t('common.cancel') }}</button>
    </div>
  </form>
</template>
```

- [ ] **Step 3: Typecheck**

Run: `npx vue-tsc -b`
Expected: error only for the not-yet-created `AdminPatientDetail.vue`. No errors in the two form components.

- [ ] **Step 4: Commit**

```bash
git add src/components/staff/AdminRecordForm.vue src/components/staff/AdminReminderForm.vue
git commit -m "feat(admin): record + reminder add/edit form components"
```

---

## Task 13: `AdminPatientDetail` page (read + manage)

**Files:**
- Create: `src/pages/staff/AdminPatientDetail.vue`

- [ ] **Step 1: Implement the page**

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import StaffNav from '@/components/staff/StaffNav.vue'
import AdminRecordForm from '@/components/staff/AdminRecordForm.vue'
import AdminReminderForm from '@/components/staff/AdminReminderForm.vue'
import {
  fetchPatientBundle,
  adminCreateRecord,
  adminCreateReminder,
  adminUpdateReminder,
  adminSetAllergies,
  type AdminRecordInput,
  type AdminReminderInput,
} from '@/lib/admin'
import { useRecordsStore, type Record as ClinicRecord, type Reminder } from '@/stores/records'
import type { Profile } from '@/stores/profiles'
import { reminderTitle } from '@/lib/reminders'
import { formatDateShort, formatDateLong } from '@/lib/dates'
import { useDialog } from '@/lib/dialog'

const route = useRoute()
const { t, locale } = useI18n()
const dialog = useDialog()
const recordsStore = useRecordsStore()

const profile = ref<Profile | null>(null)
const records = ref<ClinicRecord[]>([])
const reminders = ref<Reminder[]>([])
const loading = ref(true)

// UI state for the inline forms.
const recordForm = ref<{ open: boolean; editing: ClinicRecord | null }>({ open: false, editing: null })
const reminderForm = ref<{ open: boolean; editing: Reminder | null }>({ open: false, editing: null })
const editingAllergies = ref(false)
const allergiesDraft = ref('')

const profileId = computed(() => route.params.profileId as string)

async function load() {
  loading.value = true
  try {
    const bundle = await fetchPatientBundle(profileId.value)
    profile.value = bundle.profile
    records.value = bundle.records
    reminders.value = bundle.reminders
  } catch (e) {
    await dialog.alertError(e, t('common.error'))
  } finally {
    loading.value = false
  }
}
onMounted(load)

function dob(): string {
  return profile.value?.date_of_birth ? formatDateLong(profile.value.date_of_birth, locale.value) : '—'
}

// --- Records ---
function openAddRecord() { recordForm.value = { open: true, editing: null } }
function openEditRecord(r: ClinicRecord) { recordForm.value = { open: true, editing: r } }
function closeRecordForm() { recordForm.value = { open: false, editing: null } }

async function submitRecord(input: AdminRecordInput) {
  try {
    if (recordForm.value.editing) {
      await recordsStore.updateRecord(recordForm.value.editing.id, {
        name: input.name,
        performed_on: input.performed_on,
        dose_number: input.kind === 'vaccination' ? input.dose_number : null,
        total_doses: input.kind === 'vaccination' ? input.total_doses : null,
        notes: input.notes,
      })
    } else {
      if (!profile.value) return
      await adminCreateRecord(profile.value.user_id, profileId.value, input)
    }
    closeRecordForm()
    await load()
  } catch (e) {
    await dialog.alertError(e, t('common.error'))
  }
}

async function deleteRecord(r: ClinicRecord) {
  const ok = await dialog.confirm({ title: t('admin.confirmDeleteRecord'), confirmLabel: t('common.delete'), variant: 'danger' })
  if (!ok) return
  try {
    await recordsStore.deleteRecord(r.id)
    await load()
  } catch (e) {
    await dialog.alertError(e, t('common.error'))
  }
}

// --- Reminders ---
function openAddReminder() { reminderForm.value = { open: true, editing: null } }
function openEditReminder(r: Reminder) { reminderForm.value = { open: true, editing: r } }
function closeReminderForm() { reminderForm.value = { open: false, editing: null } }

async function submitReminder(input: AdminReminderInput) {
  try {
    if (reminderForm.value.editing) {
      await adminUpdateReminder(reminderForm.value.editing.id, { name: input.name, due_at: input.due_at })
    } else {
      if (!profile.value) return
      await adminCreateReminder(profile.value.user_id, profileId.value, input)
    }
    closeReminderForm()
    await load()
  } catch (e) {
    await dialog.alertError(e, t('common.error'))
  }
}

async function deleteReminder(r: Reminder) {
  const ok = await dialog.confirm({ title: t('admin.confirmDeleteReminder'), confirmLabel: t('common.delete'), variant: 'danger' })
  if (!ok) return
  try {
    await recordsStore.deleteReminder(r.id)
    await load()
  } catch (e) {
    await dialog.alertError(e, t('common.error'))
  }
}

function titleFor(r: Reminder): string {
  return reminderTitle(r, records.value.find((x) => x.id === r.record_id), t)
}

// --- Allergies ---
function startEditAllergies() {
  allergiesDraft.value = profile.value?.allergies ?? ''
  editingAllergies.value = true
}
async function saveAllergies() {
  try {
    await adminSetAllergies(profileId.value, allergiesDraft.value)
    editingAllergies.value = false
    await load()
  } catch (e) {
    await dialog.alertError(e, t('common.error'))
  }
}
</script>

<template>
  <main class="min-h-dvh pb-20">
    <div class="max-w-[860px] mx-auto px-6 lg:px-10 pt-6">
      <StaffNav />
      <router-link to="/staff/patients" class="folio underline underline-offset-4">{{ $t('admin.backToPatients') }}</router-link>

      <div v-if="loading" class="mt-10 text-[var(--color-staff-muted)] font-display-wonk text-xl">{{ $t('recordDetail.retrieving') }}</div>

      <template v-else-if="profile">
        <!-- Identity (read-only) -->
        <header class="mt-4 mb-8">
          <h1 class="font-display text-5xl leading-tight">{{ profile.name }}</h1>
          <div class="text-xs text-[var(--color-staff-muted)] mt-2">
            <span>{{ $t('admin.nricLabel') }}: {{ profile.nric ?? '—' }}</span>
            <span class="mx-2">·</span>
            <span>{{ $t('admin.dobLabel') }}: {{ dob() }}</span>
            <span class="mx-2">·</span>
            <span>{{ profile.nationality }}</span>
          </div>
        </header>

        <!-- Allergies (editable) -->
        <section class="mb-10 paper-card p-5">
          <div class="flex items-center justify-between">
            <div class="eyebrow" style="color: var(--color-staff-accent)">{{ $t('admin.allergiesTitle') }}</div>
            <button v-if="!editingAllergies" class="btn-ghost !py-1 !px-3 text-xs" @click="startEditAllergies">{{ $t('admin.editAllergies') }}</button>
          </div>
          <template v-if="!editingAllergies">
            <p v-if="profile.allergies === null" class="text-sm text-[var(--color-staff-muted)] mt-2">{{ $t('admin.noAllergyRecord') }}</p>
            <p v-else-if="profile.allergies.trim() === ''" class="font-display-wonk text-base text-[var(--color-staff-muted)] mt-2">{{ $t('admin.noKnownAllergies') }}</p>
            <p v-else class="font-display-wonk text-lg leading-snug whitespace-pre-line mt-2">{{ profile.allergies }}</p>
          </template>
          <div v-else class="mt-3 space-y-3">
            <textarea v-model="allergiesDraft" rows="3" class="field resize-none" :placeholder="$t('admin.allergyPlaceholder')"></textarea>
            <div class="flex gap-2">
              <button class="btn-primary" @click="saveAllergies">{{ $t('common.save') }}</button>
              <button class="btn-ghost" @click="editingAllergies = false">{{ $t('common.cancel') }}</button>
            </div>
          </div>
        </section>

        <!-- Records -->
        <section class="mb-10">
          <div class="flex items-center justify-between mb-3">
            <h2 class="font-display text-2xl">{{ $t('admin.recordsTitle') }}</h2>
            <button v-if="!recordForm.open" class="btn-ghost !py-1 !px-3 text-xs" @click="openAddRecord">{{ $t('admin.addRecord') }}</button>
          </div>

          <AdminRecordForm
            v-if="recordForm.open && !recordForm.editing"
            class="mb-4"
            @submit="submitRecord"
            @cancel="closeRecordForm"
          />

          <p v-if="records.length === 0 && !recordForm.open" class="text-sm text-[var(--color-staff-muted)]">{{ $t('admin.noRecords') }}</p>

          <ul class="space-y-2">
            <li v-for="r in records" :key="r.id">
              <AdminRecordForm
                v-if="recordForm.open && recordForm.editing?.id === r.id"
                :record="r"
                @submit="submitRecord"
                @cancel="closeRecordForm"
              />
              <div v-else class="paper-card p-4 flex items-center justify-between gap-3">
                <div>
                  <div class="font-display text-lg leading-tight">{{ r.name }}</div>
                  <div class="text-xs text-[var(--color-staff-muted)] mt-0.5">
                    {{ formatDateShort(r.performed_on, locale) }}
                    <span class="mx-1">·</span>
                    <span>{{ r.kind === 'vaccination' ? $t('home.kindVaccination') : $t('home.kindBloodTest') }}</span>
                  </div>
                </div>
                <div class="flex gap-2 text-xs shrink-0">
                  <button class="btn-ghost !py-1 !px-3" @click="openEditRecord(r)">{{ $t('admin.editAllergies') }}</button>
                  <button class="btn-danger !py-1 !px-3" @click="deleteRecord(r)">{{ $t('common.delete') }}</button>
                </div>
              </div>
            </li>
          </ul>
        </section>

        <!-- Reminders -->
        <section>
          <div class="flex items-center justify-between mb-3">
            <h2 class="font-display text-2xl">{{ $t('admin.remindersTitle') }}</h2>
            <button v-if="!reminderForm.open" class="btn-ghost !py-1 !px-3 text-xs" @click="openAddReminder">{{ $t('admin.addReminder') }}</button>
          </div>

          <AdminReminderForm
            v-if="reminderForm.open && !reminderForm.editing"
            class="mb-4"
            @submit="submitReminder"
            @cancel="closeReminderForm"
          />

          <p v-if="reminders.length === 0 && !reminderForm.open" class="text-sm text-[var(--color-staff-muted)]">{{ $t('admin.noReminders') }}</p>

          <ul class="space-y-2">
            <li v-for="r in reminders" :key="r.id">
              <AdminReminderForm
                v-if="reminderForm.open && reminderForm.editing?.id === r.id"
                :reminder="r"
                @submit="submitReminder"
                @cancel="closeReminderForm"
              />
              <div v-else class="paper-card p-4 flex items-center justify-between gap-3">
                <div>
                  <div class="font-display text-lg leading-tight">{{ titleFor(r) }}</div>
                  <div class="text-xs text-[var(--color-staff-muted)] mt-0.5">{{ formatDateShort(r.due_at, locale) }}</div>
                </div>
                <div class="flex gap-2 text-xs shrink-0">
                  <button class="btn-ghost !py-1 !px-3" @click="openEditReminder(r)">{{ $t('admin.editAllergies') }}</button>
                  <button class="btn-danger !py-1 !px-3" @click="deleteReminder(r)">{{ $t('common.delete') }}</button>
                </div>
              </div>
            </li>
          </ul>
        </section>
      </template>
    </div>
  </main>
</template>
```

> Note: the "edit" buttons reuse `admin.editAllergies` ("Edit") as the generic
> edit label — it is a bare verb in all three locales, so it reads correctly on
> record and reminder rows too.

- [ ] **Step 2: Full typecheck (should now be clean)**

Run: `npx vue-tsc -b`
Expected: **no errors** (all Admin modules now exist).

- [ ] **Step 3: Run the full unit suite**

Run: `npx vitest run`
Expected: PASS (calendar, reminders, admin, plus pre-existing dates/nric/qr-payload/similarity).

- [ ] **Step 4: Commit**

```bash
git add src/pages/staff/AdminPatientDetail.vue
git commit -m "feat(admin): patient detail — manage records, reminders, allergies"
```

---

## Task 14: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Build the production bundle (typecheck + bundle)**

Run: `pnpm build`
Expected: completes with no type errors and emits `dist/`.

- [ ] **Step 2: Prereqs for manual testing**

Confirm:
- Migration `0025` is applied to the linked Supabase project.
- The clinic account exists in Supabase Auth (email = your `VITE_ADMIN_EMAIL`, password = the PIN) and its `user_id` is seeded into `admins`.
- A *separate* normal patient account exists with at least one profile and one record/reminder (for cross-account checks). Note that patient's profile name/NRIC.

Run: `pnpm dev` and open the printed URL.

- [ ] **Step 3: Admin login + gates**

1. Visit `/staff`, enter the PIN → lands on `/staff/calendar` (dark staff theme).
2. Enter a wrong PIN → shows the denied/error message, stays on the gate.
3. While signed in as admin, manually visit `/` → redirected to `/staff/calendar` (not `/home`); you are never funneled to `/profiles?first=1`.

- [ ] **Step 4: Calendar reads across accounts**

The other patient's upcoming reminder appears on its due day (count badge), and clicking the day → the reminder lists that patient's name and links to `/staff/patients/:id`. Prev/next month and Today work.

- [ ] **Step 5: Search + read**

`/staff/patients`: search the other patient by name and by NRIC (≥2 chars) → result shows name · NRIC · DOB. Open it → records, reminders, allergies render.

- [ ] **Step 6: Writes propagate to the patient (the ownership proof)**

1. As admin, **Add record** for the other patient → appears in their Records list.
2. Sign out (Lock), log in as that patient on the same browser → the new record shows on their Home. **This proves `user_id` was stamped with the owner, not the admin.**
3. Back as admin: edit and delete a record; add, edit (reschedule), and delete a reminder → all reflected for the patient.

- [ ] **Step 7: Allergies scope (DB-enforced)**

As admin, edit allergies (including saving an empty value = "no known allergies") → persists. Confirm there is no UI path to change name/NRIC/DOB. (Optional belt-and-suspenders: in the Supabase SQL editor, while authenticated as the clinic account, an `update profiles set name=… ` is rejected — only `admin_set_allergies` succeeds.)

- [ ] **Step 8: Patient isolation still holds**

As the normal patient, confirm you cannot see any other patient's data (Home shows only your own); there is no admin nav. RLS `is_admin()` is false for this account.

- [ ] **Step 9: Final commit (if any verification fixes were needed)**

```bash
git add -A
git commit -m "chore(admin): verification fixes"
```

(Skip if no changes were required.)

---

## Self-review notes (coverage map)

- Spec §5 Auth → Tasks 2, 3, 4.
- Spec §6 Database (admins/is_admin/RLS/allergies RPC + seeding) → Task 1.
- Spec §7 Ownership invariant + data layer → Task 7 (with unit tests asserting owner stamping).
- Spec §8 Screens/routes/nav/forms → Tasks 4, 9, 10, 11, 12, 13.
- Spec §6 router gate fix → Task 4.
- Spec §9 i18n → Task 8.
- Spec §11 Testing (buildMonthGrid, bucketing, reminderTitle, search builder, insert ownership, manual cross-account) → Tasks 5, 6, 7, 14.
- Calendar "agenda on narrow screens": realized as the selected-day drill-down panel beneath the grid (Task 10), which serves the same purpose on mobile.
