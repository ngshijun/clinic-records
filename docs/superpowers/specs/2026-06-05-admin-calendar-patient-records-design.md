# Admin Calendar + Patient Records Management — Design

**Date:** 2026-06-05
**Owner:** Shijun (Poliklinik Ng Plt)
**Status:** Spec approved — ready for implementation plan

## 1. Summary

Give clinic staff an authenticated **admin** surface that reaches across all
patient accounts:

1. **Reminders calendar** — a month grid showing every patient's upcoming
   reminders, bucketed by Malaysia-local due date, with a day drill-down listing
   who is due for what.
2. **Patient search + records management** — search patients by name or NRIC,
   open a patient's full record, and **add / edit / delete their records and
   reminders**, plus edit their allergies.

Today the clinic stores no patient data server-side: every patient is a Supabase
`auth.users` account, and their `profiles` / `records` / `reminders` rows live in
shared tables walled off by Row-Level Security scoped to `auth.uid()`. The data
physically already exists in one database — this feature is mostly an **auth +
RLS** change plus two new admin screens, not a data migration.

## 2. Why

The clinic operates entirely through ephemeral QR codes (staff screen → patient
camera). Staff have no way to see what follow-ups are coming up across patients,
and no way to look up a specific patient to correct or complete their records.
This adds a clinic-side operational view (calendar) and a clinic-side editing
capability (search → manage), without changing the patient experience.

## 3. Scope decisions (locked)

- **Whose data:** all clinic patients, cross-account.
- **Admin identity:** a single shared clinic account in `auth.users`. Its
  **email lives in an env var**; its **password is the existing staff PIN**.
  Login is a normal `signInWithPassword` (server-verified by Supabase) — no
  password ships in the client bundle, no edge function.
- **Calendar:** month grid + day drill-down; **future reminders only** (due
  today onward).
- **Patient search:** match on **name OR NRIC**; DOB shown to disambiguate.
- **Write access:**
  - Records: admin can **add / edit / delete**.
  - Reminders: admin can **add / edit / delete**.
  - Profile allergies: admin can **edit**.
  - Profile identity (name / NRIC / DOB / nationality): **read-only** for admin.
  - Patient creation: **out of scope** — admin only works with patients who
    already have an account (and therefore a profile with an owning `user_id`).

## 4. Non-goals

- Creating brand-new patient accounts / orphan profiles, and any account-claim
  flow. (Records require an existing owning account.)
- Editing patient identity fields (name, NRIC, DOB, nationality).
- Per-staff identity / audit log. The shared clinic account is the single
  admin; activity is attributable only to "the clinic", not an individual.
- Multi-admin / role hierarchy. The `admins` table supports it later, but v1
  seeds exactly one account.
- Changing the patient-facing QR / scan / ingest flows.
- Replicating the patient app's series-cleanup automation
  (`closePriorSeriesReminders`, `replace_record`) for admin edits — admin edits
  are direct and explicit.

## 5. Auth & identity

### Shared clinic account
A single account is created once in Supabase Auth (manual, via dashboard or CLI).
Its **email** is exposed to the client as `VITE_ADMIN_EMAIL`; its **password is
the staff PIN**. Email is not secret, so shipping it in the bundle is fine; the
PIN/password is typed by the user and verified server-side.

### Gate (`src/pages/staff/Gate.vue`)
Replace the client-side PBKDF2 hash check with a real sign-in:

```ts
await auth.signIn(import.meta.env.VITE_ADMIN_EMAIL, pin)
```

On success, route to `/staff/calendar`. On failure, show the existing
"denied / error" message. The PIN is now literally the account password, so
Supabase's password-strength rules apply when the account is created.

### `auth.isAdmin`
Add a computed to the auth store:

```ts
const isAdmin = computed(() =>
  !!user.value?.email &&
  user.value.email.toLowerCase() === import.meta.env.VITE_ADMIN_EMAIL?.toLowerCase()
)
```

This drives **routing/UX only** — actual data authorization is enforced
server-side by RLS (`is_admin()`), so a spoofed client flag grants nothing.

### Retire the old PIN plumbing
- `src/lib/staff-auth.ts`: `deriveHash` / `verifyPassword` /
  `isStaffUnlocked` / `markStaffUnlocked` are no longer needed. `clearStaffUnlocked`
  → replaced by `auth.signOut()`. Remove the file or reduce it to nothing;
  update its two importers (`Gate.vue`, `Generate.vue`).
- `VITE_STAFF_PASSWORD_HASH` / `VITE_STAFF_PASSWORD_SALT` env vars become
  obsolete; `VITE_ADMIN_EMAIL` replaces them. Update `.env.example`.

### Router guard (`src/router/index.ts`)
- `requiresStaff`: replace the `isStaffUnlocked()` localStorage check with
  `auth.isAdmin` (after `auth.init()`). If not admin → redirect to `/staff`.
- **Bypass the patient gates for admin.** The clinic account has zero profiles,
  so the existing first-profile gate (`/profiles?first=1`) and completion gate
  would trap it. Early-return / skip both when `auth.isAdmin`.
- **Landing redirect:** a logged-in admin hitting `/` or `/landing` should go to
  `/staff/calendar`, not `/home`.

## 6. Database (one new migration)

New migration `00NN_admin_role_and_policies.sql`:

### `admins` table + `is_admin()`
```sql
create table admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table admins enable row level security;
-- No policies: normal users cannot read/write admins. is_admin() reads it as
-- definer (bypassing RLS).

create or replace function is_admin()
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
```
Hardening (`security definer` + `stable` + locked `search_path`) mirrors the
existing trigger in migration `0017`.

### RLS policies (added; existing owner policies remain and OR together)
```sql
create policy "admin all records" on records
  for all to authenticated
  using (is_admin()) with check (is_admin());

create policy "admin all reminders" on reminders
  for all to authenticated
  using (is_admin()) with check (is_admin());

create policy "admin read profiles" on profiles
  for select to authenticated
  using (is_admin());
```
Because PostgreSQL ORs policies per command, a normal patient still matches only
their `user_id = auth.uid()` policy, while the admin additionally matches the
`is_admin()` policy. Admin gets full CRUD on records/reminders and read on
profiles. **No broad profile UPDATE policy** — identity stays locked.

### Allergies-only write (RPC)
A `security definer` RPC scopes the only allowed profile write to the allergies
column, so identity columns are protected at the database level, not just the UI:
```sql
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
  update public.profiles set allergies = p_allergies, updated_at = now()
  where id = p_profile_id;
end;
$$;
```
(`allergies = ''` is meaningful — "checked, no known allergies" — vs `null`,
matching the patient-app convention in migration `0024`.)

### Seeding
Documented one-time step after the clinic account exists:
```sql
insert into admins (user_id)
select id from auth.users where email = '<clinic-account-email>'
on conflict do nothing;
```

## 7. Data layer — `src/lib/admin.ts` (new)

Isolated from the patient-facing `records` store. Functions:

- `searchPatients(query): Promise<AdminPatient[]>`
  `profiles.select('id,user_id,name,nric,date_of_birth,nationality,allergies')`
  filtered by `or('name.ilike.%q%,nric.ilike.%q%')`, ordered by name, capped
  (e.g. `limit(50)`). `q` is sanitized for PostgREST `or` (escape commas/`%`).

- `fetchUpcomingReminders(fromIso, toIso): Promise<AdminReminder[]>`
  `reminders.select('*, profile:profiles(name,nric,date_of_birth), record:records(name,kind,dose_number,total_doses)')`
  with `.gte('due_at', fromIso).lt('due_at', toIso).order('due_at')`. Used for
  the visible month window.

- `fetchPatientBundle(profileId): Promise<{ profile, records, reminders }>`
  one profile by id + its records (order `performed_on desc`) + its reminders
  (order `due_at`). RLS lets admin read across owners.

- `adminCreateRecord(ownerUserId, profileId, input)` — insert into `records`
  with **`user_id = ownerUserId`** (the patient's owner, read from the profile),
  not the admin. Returns the row.

- `adminCreateReminder(ownerUserId, profileId, input)` — insert into `reminders`
  with `user_id = ownerUserId`.

- `adminUpdateReminder(id, patch)` — update `due_at` / `name` (patient app has no
  reminder editor; this is net-new).

- `adminSetAllergies(profileId, text)` — `supabase.rpc('admin_set_allergies', …)`.

**Edits/deletes reuse the existing store mutations** (`updateRecord`,
`deleteRecord`, `deleteReminder` in `src/stores/records.ts`) — they key off
`id` and rely on RLS, never touching `user_id`, so they work unchanged for admin.

### Ownership invariant (the critical insert rule)
Records/reminders have `user_id NOT NULL`. The admin's own `auth.uid()` is the
clinic account, not the patient. Inserting with the admin's id would make the row
invisible to the patient (their RLS is `user_id = auth.uid()`). Therefore every
admin insert sets `user_id` to the **target profile's owner** — read from the
profile (`AdminPatient.user_id`) the admin already loaded.

## 8. Screens & routes (under `/staff/*`)

New routes in `src/router/index.ts`, all `meta: { requiresStaff: true }`:
- `/staff/calendar` → `AdminCalendar.vue`
- `/staff/patients` → `AdminPatients.vue`
- `/staff/patients/:profileId` → `AdminPatientDetail.vue`
- (existing `/staff/generate` retained)

### Shared `StaffNav.vue` (new component)
A compact nav reused across admin pages: **Calendar · Patients · Generate ·
Lock**. "Lock" calls `auth.signOut()` then routes to `/staff`. Uses the existing
staff accent theme (`--color-staff-accent`, `eyebrow`, `paper-card`, etc.).

### `AdminCalendar.vue`
- Hand-rolled month grid (no calendar dependency — consistent with the codebase's
  manual date math in `src/lib/dates.ts`). State: `viewYear`, `viewMonth`; prev/
  next-month controls; "today" affordance.
- Compute the visible grid as MY-local dates (leading days from the prior month,
  trailing from the next, to fill whole weeks). A small pure helper
  `buildMonthGrid(year, month)` returns the cells — unit-testable.
- Fetch reminders for the month window via `fetchUpcomingReminders`. Bucket each
  reminder into its cell by `dateInMY(r.due_at)`. Show a per-day count/dot.
- Click a day → panel/list of that day's reminders: patient name + due title
  (reuse Home's `reminderTitle` logic, factored into a shared helper) + a link to
  `/staff/patients/:profileId`.
- Responsive: on narrow viewports collapse to a scrollable **agenda** (grouped by
  day) instead of the grid.
- "Future only": the default view is the current month; past days render but
  carry no future-reminder emphasis. (We fetch by month window, so past months
  are reachable by navigation but the feature framing is upcoming follow-ups.)

### `AdminPatients.vue`
- Search input (debounced) → `searchPatients`. Empty/short query shows a prompt,
  not a full-table dump.
- Results list: name · NRIC · DOB, each linking to the detail page. Handle
  zero-results and the same NRIC appearing under multiple accounts (each profile
  row is distinct; show all).

### `AdminPatientDetail.vue`
- Loads `fetchPatientBundle(profileId)`.
- **Header:** name, NRIC, DOB, nationality — read-only. Allergies shown with an
  **edit** affordance → inline editor calling `adminSetAllergies` (empty string
  allowed = "no known allergies").
- **Records section:** flat list. Each row → **edit** (expands an inline form in
  place, matching `RecordDetail.vue`'s `editing` toggle) + **delete**. An **Add
  record** button reveals the same inline form, blank, at the top of the section.
- **Reminders section:** list with due date + title. Each → **edit** (inline,
  reschedule / rename) + **delete**. An **Add reminder** button reveals a blank
  inline form at the top of the section.
- All mutations refresh the bundle and surface errors via `useDialog().alertError`.

### Forms
- **Record form** (add/edit): kind (v/b — editable on add, read-only on edit to
  match the patient-app constraint), name, performed_on (date), dose_number /
  total_doses (vaccination only), notes. Reuses the field markup from
  `RecordDetail.vue`'s edit form; extracted into `AdminRecordForm.vue` for reuse
  between add and edit.
- **Reminder form** (add/edit): kind (`next_dose` / `followup_test` / `other`),
  name, due date. Due date (a `type=date`) is converted to a `due_at` timestamp
  at 08:00 MY via a small helper (reuse `computeDueAt(date, 0, 'd')`, which
  yields 08:00 MY = 00:00 UTC). New `AdminReminderForm.vue`.

## 9. i18n

Add an `admin` namespace to all three locales (en / zh / ms): calendar labels
(month nav, "due today", weekday headers or reuse Intl), search placeholder /
empty / no-results, patient detail section titles, add/edit/delete record &
reminder labels, allergies edit labels, "Lock" / nav labels, and error titles
with `{err}` placeholders. Weekday/month names come from `Intl` via the existing
`dateFmtLocale` rather than hardcoded strings.

## 10. Edge cases

- **Admin with a stale patient session:** signing into the clinic account
  replaces any prior session on that browser — expected on a dedicated clinic
  device; documented, not guarded.
- **Insert ownership:** never set `user_id` to the admin; always the profile
  owner. A unit test asserts this on the insert path.
- **Allergies empty vs null:** preserve the distinction; the editor writes `''`
  for "no known allergies" and never coerces to `null`.
- **Reminder with no record (`record_id` null):** title falls back to `r.name`
  (same logic as Home). Calendar and detail handle both bound and orphan
  reminders.
- **Month boundaries / DST:** none in MY (UTC+8, no DST). Bucketing strictly via
  `dateInMY` avoids device-timezone drift; grid cells are MY-local dates.
- **Search injection into PostgREST `or`:** sanitize the query (strip/escape
  `,` `%` `(` `)`), and cap result count.
- **Concurrent edits:** last-write-wins by `id`; no optimistic locking in v1.
- **NRIC ILIKE on non-Malaysian free-form IDs:** still matches as substring;
  acceptable.

## 11. Testing

**Vitest (unit):**
1. `buildMonthGrid` — correct number of cells, leading/trailing days from
   adjacent months, week alignment, across a leap-year February.
2. Reminder bucketing — a `due_at` near midnight UTC lands on the correct
   MY-local day (UTC+8 boundary), and reminders group into the right cells.
3. `reminderTitle` shared helper — bound vaccination (dose+1), booster (1-of-1,
   no "dose 2"), follow-up test, orphan reminder-only, generic fallback.
4. Search query builder — sanitizes `,`/`%`, builds the expected `or` filter.
5. Insert ownership — `adminCreateRecord` / `adminCreateReminder` set
   `user_id` to the passed owner id, not the admin (mock supabase, assert
   payload).

**Manual (against linked Supabase):**
1. Sign in at `/staff` with the PIN → lands on `/staff/calendar`; wrong PIN →
   denied.
2. As admin: read a calendar populated by another account's reminders; open a
   patient and see their records/reminders/allergies.
3. Add a record to patient X → log in as patient X (separate session/device) →
   the record appears (proves `user_id` ownership is correct).
4. Edit / delete a record and a reminder as admin → reflected for the patient.
5. Edit allergies as admin (incl. empty) → reflected; attempt to change name via
   any path → no profile UPDATE policy, so it fails (DB-enforced).
6. As a normal patient: confirm no access to other patients' data (RLS still
   scopes reads to own rows; `is_admin()` is false).
7. Admin account never gets trapped by the first-profile/completion gates.

## 12. Out-of-scope follow-ups

- Per-staff admin accounts + an audit trail (the `admins` table already supports
  multiple rows).
- Creating new patients clinic-side (orphan profiles + account-claim flow).
- Editing patient identity fields with the full NRIC/nationality validation.
- Calendar enhancements: overdue/missed-follow-up tracking, week/day views,
  filtering by reminder kind, export.
- Admin-issued record changes triggering the same series-cleanup automation the
  QR ingest path uses.
