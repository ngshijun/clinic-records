# Edit Template — Design

**Date:** 2026-04-26
**Owner:** Shijun (Poliklinik Ng Plt)
**Status:** Spec approved — ready for implementation plan

## 1. Summary

Staff can edit the metadata of an existing template (name, dose counts, next-due days, reminder-only flag) without going through the compose-and-save-as-new path. Adds an "edit" affordance to each template card that opens a focused modal with the template's editable fields pre-filled.

## 2. Why

The current model lets staff create templates (via "Save as template" on the compose stage), reorder them, move them between categories, and delete them — but provides no way to fix a typo, adjust a dose count, or flip the reminder-only flag on an existing template. Today the only "edit" is delete + re-create, which loses the template's identity (and any wider references — sort order, category placement).

## 3. Non-goals

- Editing `kind` (vaccine ↔ blood test). Changing kind invalidates the dose fields' semantics.
- Editing `category_id` or `sort_order` — already covered by drag-and-drop.
- Edit history, undo, or audit log.
- Bulk edit across multiple templates.
- A separate "create template" flow distinct from compose's "Save as template" — the create path is fine bundled with compose; only edit is missing.

## 4. UX

### Affordance
A new lowercase text button "edit" sits on each `TemplateCard` between the apply area (card body) and the existing `×` (delete). Visual treatment matches the existing pattern: hairline left border, opacity-40 default, opacity-100 on hover. Click stops propagation so it doesn't also trigger `apply`.

### Dialog
A bespoke modal — same Teleport-to-body + paper-card-backdrop pattern as the existing share-QR modal in `Generate.vue`. The shared `AppDialog` system in `lib/dialog.ts` only supports single-field prompts, so multi-field edit cannot reuse it.

Fields mirror the compose form's relevant subset:
- Name (text)
- Reminder-only checkbox + hint
- Dose number, Total doses (visible only when `kind === 'v'` AND `!reminder_only`)
- Next-due days (label adapts to kind, same conditional logic as compose)

Buttons: Cancel (left) / Save changes (right, primary). Backdrop click & Escape resolve as cancel — matches the existing `AppDialog` behavior, which dismisses non-alert dialogs as cancel on backdrop and Escape.

`kind` displayed as read-only context (so the user knows which form variant they're looking at) but not editable.

## 5. Data layer

Add to `src/lib/templates.ts` a narrower update type and the update function:

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

The narrow type makes the contract explicit: `kind`, `category_id`, `sort_order` cannot be updated via this function (they're managed elsewhere or immutable).

## 6. Component changes

### `src/components/staff/TemplateCard.vue`
- Declare a new `'edit'` event in `defineEmits`.
- Add a button `@click.stop="$emit('edit', tpl)"` between the existing apply button and × button. Same visual treatment.

### `src/pages/staff/Generate.vue`
- Import `updateTemplate` from `@/lib/templates`.
- Add `editingTemplate: Ref<Template | null>` and a local reactive form (`editForm`) that holds the editable field values.
- Add `startEdit(tpl)` (pre-fills the form from the template), `cancelEdit()`, `saveEdit()` (calls `updateTemplate`, refreshes list, closes dialog, surfaces errors via `dialog.alertError`).
- Wire the new `'edit'` event from `TemplateCard` to `startEdit`.
- Add a Teleport-to-body modal block, conditionally rendered on `editingTemplate`. Form layout matches the compose form's right-column subset.

## 7. i18n

Add to all three locales (en / zh / ms) under the `staff` namespace:
- `editTemplate` — modal title, e.g. "Edit template"
- `edit` — card affordance label, e.g. "edit"
- `saveChanges` — modal confirm button, e.g. "Save changes"
- `updateTemplateFailed` — error toast/dialog title with `{err}` placeholder

## 8. Edge cases

- Empty name on save: disable the Save button when `name.trim()` is empty (mirrors the existing "Save as template" disabled state in compose).
- Switching reminder-only on/off in the dialog: hide/show dose fields the same way the compose form does. The persisted values for the hidden fields are preserved on the in-memory form but written as `null` per the existing rule (`kind === 'v' && !reminder_only ? value : null`).
- Concurrent reorder during edit: the dialog edits a snapshot of the template; if the user reordered between open-and-save, the save still applies because the update is keyed by `id` and only updates the metadata fields (no `sort_order` overwrite).
- Backdrop / Escape after edits: cancels silently. Matches AppDialog's prompt behavior. No "discard changes?" confirmation in v1 — accepting the small re-do cost for accidental dismissals.

## 9. Testing

Manual:
1. Edit a template's name → reopen the picker → name reflects the change.
2. Toggle reminder-only on a vaccine template → dose fields hide, save → reload → fields persisted as null.
3. Reorder templates, edit one → ordering preserved after save.
4. Click the edit button on a card → does NOT trigger apply (event propagation stopped).
5. Backdrop click while editing → cancels without modifying anything.
6. Network/RPC failure → `dialog.alertError` shows the error; dialog stays open with the user's edits intact.

## 10. Out of scope follow-ups

- A consistent "manage templates" page that consolidates edit/delete/reorder away from the picker. Today this lives on the picker because that's where staff already are; if usage grows we can extract it.
- Edit-from-compose (an "edit this template too" toggle on the compose stage). Possible future ergonomic but adds mode complexity now.
