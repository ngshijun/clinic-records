# Edit Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff edit a template's metadata (name, dose counts, next-due days, reminder-only flag) via a focused modal opened from each template card, without going through the compose-and-save-as-new path.

**Architecture:** A new `updateTemplate` function in the data layer; an `edit` event/button added to `TemplateCard`; a bespoke modal in `Generate.vue` (Teleport + paper-card backdrop, mirroring the existing share-QR modal) that hosts the multi-field form. The shared `AppDialog` system supports only single-field prompts, so multi-field edit cannot reuse it. `kind`, `category_id`, and `sort_order` are intentionally not editable — `kind` change would invalidate dose semantics; the others are managed by drag-and-drop.

**Tech Stack:** Vue 3 (Composition API + `<script setup>`), TypeScript, vue-i18n, Supabase JS client, Tailwind. The repo doesn't have established test patterns for Supabase-backed lib functions or Vue components, so verification per task is `pnpm build` (which runs `vue-tsc -b && vite build`) plus a final manual smoke pass through `pnpm dev`.

**Spec:** [docs/superpowers/specs/2026-04-26-edit-template-design.md](../specs/2026-04-26-edit-template-design.md)

---

## Task 1: Data layer — `updateTemplate`

**Files:**
- Modify: `src/lib/templates.ts` — add `TemplateUpdate` type alias and `updateTemplate` function alongside the existing exports.

- [ ] **Step 1: Add the new type and function**

Open `src/lib/templates.ts`. Locate the existing `deleteTemplate` function (around line 75–78) and insert the new export immediately AFTER it:

```ts
export type TemplateUpdate = Pick<
  Template,
  'name' | 'dose_number' | 'total_doses' | 'next_due_days' | 'reminder_only'
>

export async function updateTemplate(id: string, input: TemplateUpdate): Promise<void> {
  const { error } = await supabase
    .from('qr_templates')
    .update(input)
    .eq('id', id)
  if (error) throw error
}
```

Rationale: the narrow `TemplateUpdate` type makes the contract explicit — `kind`, `category_id`, `sort_order`, `id`, `created_at` cannot be updated through this function.

- [ ] **Step 2: Verify typecheck + build**

Run from the repo root: `pnpm build`

Expected: build succeeds. Look for `dist/sw.mjs ... built in` lines and a final `precache N entries` summary. No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/templates.ts
git commit -m "feat(templates): add updateTemplate for editing metadata"
```

---

## Task 2: i18n strings (en / zh / ms)

**Files:**
- Modify: `src/locales/en.ts` — add 4 keys to the `staff` namespace.
- Modify: `src/locales/zh.ts` — same 4 keys translated.
- Modify: `src/locales/ms.ts` — same 4 keys translated.

- [ ] **Step 1: Add strings to en.ts**

Open `src/locales/en.ts`. Find the line `tagRecordReminder: 'Record + reminder',` (around line 340). Insert the four new keys immediately after it, before the closing `},` of the `staff` namespace:

```ts
    editTemplate: 'Edit template',
    edit: 'edit',
    saveChanges: 'Save changes',
    updateTemplateFailed: 'Could not update template: {err}',
```

The closing `},` of the `staff` namespace stays unchanged.

- [ ] **Step 2: Add strings to zh.ts**

Open `src/locales/zh.ts`. Find the line `tagRecordReminder: '记录 + 提醒',` (around line 340). Insert immediately after:

```ts
    editTemplate: '编辑模板',
    edit: '编辑',
    saveChanges: '保存更改',
    updateTemplateFailed: '无法更新模板：{err}',
```

- [ ] **Step 3: Add strings to ms.ts**

Open `src/locales/ms.ts`. Find the line `tagRecordReminder: 'Rekod + peringatan',` (around line 343). Insert immediately after:

```ts
    editTemplate: 'Sunting templat',
    edit: 'sunting',
    saveChanges: 'Simpan perubahan',
    updateTemplateFailed: 'Tidak dapat mengemas kini templat: {err}',
```

- [ ] **Step 4: Verify typecheck + build**

Run: `pnpm build`

Expected: build succeeds. The locale files share a TypeScript shape — adding the same keys to all three keeps them aligned, so no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/locales/en.ts src/locales/zh.ts src/locales/ms.ts
git commit -m "i18n(staff): add edit-template strings"
```

---

## Task 3: TemplateCard — add `edit` button

**Files:**
- Modify: `src/components/staff/TemplateCard.vue` — extend `defineEmits` and add a button between the apply area and the existing `×` button.

- [ ] **Step 1: Extend the emits and add the edit button**

Open `src/components/staff/TemplateCard.vue`. Replace the entire file contents with:

```vue
<script setup lang="ts">
import type { Template } from '@/lib/templates'
import { useI18n } from 'vue-i18n'

defineProps<{ tpl: Template }>()
defineEmits<{
  (e: 'apply', tpl: Template): void
  (e: 'edit', tpl: Template): void
  (e: 'remove', tpl: Template): void
}>()

const { t } = useI18n()
</script>

<template>
  <div class="group relative hairline flex cursor-grab active:cursor-grabbing">
    <button
      type="button"
      class="flex-1 p-4 text-left transition-colors hover:bg-white/[0.03]"
      @click="$emit('apply', tpl)"
    >
      <div class="eyebrow mb-1.5" style="color: var(--color-staff-muted)">
        <span v-if="tpl.reminder_only">{{ t('staff.reminder') }}</span>
        <span v-else-if="tpl.next_due_days">{{ t('staff.tagRecordReminder') }}</span>
        <span v-else>{{ t('staff.tagRecord') }}</span>
      </div>
      <div class="font-display text-lg leading-tight mb-1" style="color: var(--color-staff-ink)">
        {{ tpl.name }}
      </div>
      <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs" style="color: var(--color-staff-muted)">
        <span v-if="tpl.kind === 'v' && tpl.dose_number && tpl.total_doses" class="tabular-nums">
          {{ t('staff.seriesOf', { n: tpl.dose_number, total: tpl.total_doses }) }}
        </span>
        <span v-if="tpl.next_due_days" class="tabular-nums">
          {{ t('staff.inDays', { n: tpl.next_due_days }) }}
        </span>
      </div>
    </button>
    <button
      type="button"
      class="px-3 border-l hairline opacity-40 hover:opacity-100 transition-opacity text-xs"
      :aria-label="t('staff.editTemplate') + ': ' + tpl.name"
      style="color: var(--color-staff-muted)"
      @click.stop="$emit('edit', tpl)"
    >{{ t('staff.edit') }}</button>
    <button
      type="button"
      class="px-3 border-l hairline opacity-40 hover:opacity-100 transition-opacity"
      :aria-label="'Delete ' + tpl.name"
      style="color: var(--color-staff-muted)"
      @click.stop="$emit('remove', tpl)"
    >×</button>
  </div>
</template>
```

The new edit button sits between the apply button and the existing `×`. Same `border-l hairline opacity-40 hover:opacity-100` treatment so it visually balances with `×`. `text-xs` matches the existing rename/delete-category text on category headers.

- [ ] **Step 2: Verify typecheck + build**

Run: `pnpm build`

Expected: build succeeds. Vue's compiler validates that any consumer of `TemplateCard` is allowed to ignore the new `edit` event (events are opt-in). The existing consumer in `Generate.vue` will still compile because emits don't require listeners.

- [ ] **Step 3: Commit**

```bash
git add src/components/staff/TemplateCard.vue
git commit -m "feat(staff): add edit button to TemplateCard"
```

---

## Task 4: Generate.vue — state, handlers, modal

**Files:**
- Modify: `src/pages/staff/Generate.vue` — add edit-dialog state, handler, and the modal block; wire `'edit'` event from `TemplateCard` to the new handler.

This is the largest task. Split into clearly-labeled sub-steps that each touch one region of the file.

- [ ] **Step 1: Add the import**

Open `src/pages/staff/Generate.vue`. Find the imports block from `@/lib/templates` (around lines 10–23). Add `updateTemplate` and the `TemplateUpdate` type to the existing import:

Before:
```ts
import {
  listTemplates,
  saveTemplate as saveTemplateFn,
  deleteTemplate as deleteTemplateFn,
  listCategories,
  createCategory as createCategoryFn,
  renameCategory as renameCategoryFn,
  deleteCategory as deleteCategoryFn,
  moveTemplateToCategory,
  reorderCategories,
  reorderTemplates,
  type Template,
  type TemplateCategory,
} from '@/lib/templates'
```

After:
```ts
import {
  listTemplates,
  saveTemplate as saveTemplateFn,
  deleteTemplate as deleteTemplateFn,
  updateTemplate as updateTemplateFn,
  listCategories,
  createCategory as createCategoryFn,
  renameCategory as renameCategoryFn,
  deleteCategory as deleteCategoryFn,
  moveTemplateToCategory,
  reorderCategories,
  reorderTemplates,
  type Template,
  type TemplateCategory,
} from '@/lib/templates'
```

- [ ] **Step 2: Add edit-dialog state and handlers**

In the same file, locate the `removeTemplate` function (around lines 266–286). Insert the following block IMMEDIATELY AFTER `removeTemplate`'s closing `}`:

```ts
// Edit-template dialog state. The form holds editable copies; the
// underlying template (`editingTemplate`) is the snapshot the dialog
// references for kind and id when saving.
const editingTemplate = ref<Template | null>(null)
const editForm = ref({
  name: '',
  dose_number: null as number | null,
  total_doses: null as number | null,
  next_due_days: null as number | null,
  reminder_only: false,
})

function startEditTemplate(tpl: Template) {
  editingTemplate.value = tpl
  editForm.value = {
    name: tpl.name,
    dose_number: tpl.dose_number,
    total_doses: tpl.total_doses,
    next_due_days: tpl.next_due_days,
    reminder_only: tpl.reminder_only,
  }
}

function cancelEditTemplate() {
  editingTemplate.value = null
}

async function saveEditTemplate() {
  const tpl = editingTemplate.value
  if (!tpl) return
  const trimmedName = editForm.value.name.trim()
  if (!trimmedName) return
  const isVaccine = tpl.kind === 'v'
  const isReminderOnly = editForm.value.reminder_only
  try {
    await updateTemplateFn(tpl.id, {
      name: trimmedName,
      dose_number: isVaccine && !isReminderOnly ? (editForm.value.dose_number ?? null) : null,
      total_doses: isVaccine && !isReminderOnly ? (editForm.value.total_doses ?? null) : null,
      next_due_days: editForm.value.next_due_days ?? null,
      reminder_only: isReminderOnly,
    })
    await refreshAll()
    editingTemplate.value = null
  } catch (e: any) {
    await dialog.alert({ title: t('staff.updateTemplateFailed', { err: e?.message ?? 'unknown' }) })
  }
}
```

- [ ] **Step 3: Wire the new `edit` event from `TemplateCard`**

Still in `Generate.vue`. There are TWO `<TemplateCard>` usages — one in the uncategorized block, one in the categorized block. Both currently look like:

```vue
<TemplateCard :tpl="tpl" @apply="applyTemplate" @remove="removeTemplate" />
```

Replace BOTH occurrences with:

```vue
<TemplateCard :tpl="tpl" @apply="applyTemplate" @edit="startEditTemplate" @remove="removeTemplate" />
```

The first is around line 465, the second is around line 514.

- [ ] **Step 4: Add the edit modal**

Still in `Generate.vue`. Find the existing share-QR `<Teleport>` block (it starts with `<Teleport to="body">` near the bottom of the `<template>` section, around line 713). Insert a SECOND `<Teleport>` block IMMEDIATELY BEFORE it:

```vue
    <Teleport to="body">
      <div
        v-if="editingTemplate"
        class="edit-tpl-backdrop print:hidden"
        role="dialog"
        aria-modal="true"
        @click.self="cancelEditTemplate"
        @keydown.esc="cancelEditTemplate"
      >
        <div class="paper-card edit-tpl-card anim-rise">
          <div class="eyebrow mb-3"><span class="tick" style="background: var(--color-staff-accent)"></span>{{ $t('staff.editTemplate') }}</div>
          <h2 class="font-display text-2xl md:text-3xl leading-[1.05]" style="color: var(--color-staff-ink)">
            {{ editingTemplate.kind === 'v' ? $t('staff.vaccination') : $t('staff.bloodTest') }}
          </h2>

          <form class="space-y-6 mt-6" @submit.prevent="saveEditTemplate">
            <label class="block">
              <span class="field-label">{{ $t('staff.nameLabel') }}</span>
              <input
                v-model="editForm.name"
                autocomplete="off"
                class="field font-display text-2xl"
                :placeholder="$t(editingTemplate.kind === 'v' ? 'staff.vaccinePlaceholder' : 'staff.bloodTestPlaceholder')"
              />
            </label>

            <label class="flex items-start gap-3 cursor-pointer select-none">
              <input type="checkbox" v-model="editForm.reminder_only" class="mt-1" />
              <div>
                <div class="field-label">{{ $t('staff.reminderOnly') }}</div>
                <div class="text-xs mt-1" style="color: var(--color-staff-muted)">{{ $t('staff.reminderOnlyHint') }}</div>
              </div>
            </label>

            <div class="grid grid-cols-2 gap-4">
              <label v-if="editingTemplate.kind === 'v' && !editForm.reminder_only" class="block">
                <span class="field-label">{{ $t('staff.doseNumber') }}</span>
                <input v-model.number="editForm.dose_number" type="number" min="1" class="field tabular-nums text-2xl font-display" />
              </label>
              <label v-if="editingTemplate.kind === 'v' && !editForm.reminder_only" class="block">
                <span class="field-label">{{ $t('staff.of') }}</span>
                <input v-model.number="editForm.total_doses" type="number" min="1" class="field tabular-nums text-2xl font-display" />
              </label>
              <label v-if="editForm.reminder_only" class="block col-span-2">
                <span class="field-label">{{ $t('staff.dueInDays') }}</span>
                <input v-model.number="editForm.next_due_days" type="number" min="1" class="field tabular-nums text-2xl font-display" />
              </label>
              <label v-else-if="editingTemplate.kind === 'b'" class="block col-span-2">
                <span class="field-label">{{ $t('staff.nextDueDays') }}</span>
                <input v-model.number="editForm.next_due_days" type="number" min="0" class="field tabular-nums text-2xl font-display" />
              </label>
              <label v-else class="block col-span-2">
                <span class="field-label">{{ $t('staff.nextDoseInDays') }}</span>
                <input v-model.number="editForm.next_due_days" type="number" min="0" class="field tabular-nums text-2xl font-display" />
              </label>
            </div>

            <div class="flex justify-end gap-3 pt-2">
              <button type="button" class="btn-ghost" @click="cancelEditTemplate">
                {{ $t('common.cancel') }}
              </button>
              <button type="submit" class="btn-primary" :disabled="!editForm.name.trim()">
                {{ $t('staff.saveChanges') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
```

The dose / next-due fields mirror the compose form's conditional layout. `col-span-2` keeps the form a clean 2-column grid in all three states (vaccine non-reminder, vaccine reminder-only, blood test).

- [ ] **Step 5: Add the modal styles**

Still in `Generate.vue`. Locate the `<style scoped>` block (around line 750). Add the following two CSS rules INSIDE the existing `<style scoped>` block, anywhere is fine — `.share-qr-backdrop` is already there as a model, place these adjacent:

```css
.edit-tpl-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: grid;
  place-items: center;
  padding: 1rem;
  z-index: 100;
  animation: share-qr-fade 140ms ease-out;
}
.edit-tpl-card {
  width: 100%;
  max-width: 480px;
  padding: 1.75rem 1.75rem 1.5rem;
}
```

`share-qr-fade` is reused (already defined in this style block). The card max-width is slightly wider than share-qr (480 vs 420) to comfortably fit the 2-column form rows.

- [ ] **Step 6: Verify typecheck + build**

Run: `pnpm build`

Expected: build succeeds. No type errors. Notable things to confirm in the output:
- `dist/sw.js` is regenerated.
- `precache N entries` includes `assets/Generate-*.js` and `assets/Generate-*.css` (the Generate page's bundle gets rebuilt).
- `vue-tsc` passes — confirms the new template references (`editingTemplate`, `editForm`, `startEditTemplate`, `cancelEditTemplate`, `saveEditTemplate`) all resolve.

- [ ] **Step 7: Commit**

```bash
git add src/pages/staff/Generate.vue
git commit -m "feat(staff): edit template via modal opened from card"
```

---

## Task 5: Manual smoke test

**Files:** None modified. This task is verification only.

- [ ] **Step 1: Start the dev server**

Run: `pnpm dev`

Wait for the "Local:" URL to appear. Open it in a browser. Navigate to `/staff` and unlock with the clinic password.

- [ ] **Step 2: Test the rename-via-edit happy path**

Pick any existing vaccine or blood-test template (or create one via `+ New from scratch` then `Save as a template` first if there are none).

- Click the new `edit` button on the card.
- Verify the modal opens with all current fields pre-filled.
- Change the name to something obviously different (e.g. append `· edited`).
- Click Save changes.
- Modal closes; the card now shows the new name.

- [ ] **Step 3: Test reminder-only toggle**

- Edit the same (or another) vaccine template.
- Toggle the "Reminder only" checkbox ON. Dose number / total fields disappear; due-in-days field appears.
- Save.
- Reopen the same template's edit dialog. Confirm reminder-only is still ON, dose fields are gone, due-in-days is preserved.
- Toggle reminder-only OFF. Save. Reopen — reminder-only is OFF, dose fields are blank (because they were nulled on the save).

- [ ] **Step 4: Test cancel paths**

- Open edit, type changes into the name field, click Cancel — card name unchanged.
- Open edit, type changes, click outside the dialog (backdrop) — card name unchanged.
- Open edit, type changes, press Escape — card name unchanged.

- [ ] **Step 5: Test empty-name guard**

- Open edit, clear the name field entirely, the Save button should be disabled (no click action). Cancel out.

- [ ] **Step 6: Test edit doesn't trigger apply**

- Click the `edit` button. Confirm the page does NOT switch to the compose stage. Only the modal opens.

- [ ] **Step 7: Test edit doesn't disturb ordering**

- Drag a template to a non-default position. Edit it (e.g. flip reminder-only). Save. Confirm the card stays in the same position.

- [ ] **Step 8: Smoke i18n**

- Switch language to 中文 via the locale dropdown. Edit a template. Confirm the modal title, button labels, field labels are in Chinese. Cancel.
- Switch to BM. Repeat. Confirm Malay text.

- [ ] **Step 9: If everything works, no commit needed**

Smoke test is verification only.

---

## Self-Review Checklist

After implementation, re-check the spec against the plan tasks:

- [§4 UX → Affordance] Edit button on `TemplateCard`, hairline + opacity-40 → opacity-100 — Task 3 ✓
- [§4 UX → Dialog] Modal in `Generate.vue`, Teleport, paper-card backdrop, mirrors share-QR — Task 4 ✓
- [§4 UX → Dialog] Conditional dose / next-due fields by kind & reminder_only — Task 4 step 4 ✓
- [§4 UX → Dialog] Backdrop / Escape cancel — Task 4 step 4 (`@click.self="cancelEditTemplate"`, `@keydown.esc="cancelEditTemplate"`) ✓
- [§5 Data] `TemplateUpdate` type, `updateTemplate` function — Task 1 ✓
- [§6 Card] `'edit'` event added — Task 3 ✓
- [§6 Generate] Import, state, handlers, event wiring, modal block — Task 4 ✓
- [§7 i18n] Four keys in en/zh/ms — Task 2 ✓
- [§8 Edge cases → empty name] Save button disabled when `name.trim()` empty — Task 4 step 4 (`:disabled="!editForm.name.trim()"`) ✓
- [§8 Edge cases → reminder toggle] Conditional v-if hides dose fields; persisted nulls per Task 4 step 2's saveEditTemplate ✓
- [§8 Edge cases → backdrop cancel] No discard-changes confirmation, matches AppDialog ✓
- [§9 Manual testing] Steps in Task 5 cover rename, toggle, cancel paths, empty guard, no-apply, ordering, i18n ✓
