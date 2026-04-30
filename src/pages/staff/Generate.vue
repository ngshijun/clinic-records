<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ulid } from 'ulid'
import { useI18n } from 'vue-i18n'
import draggable from 'vuedraggable'
import { encodePayload, type QrPayload, type QrKind, type QrDueUnit } from '@/lib/qr-payload'
import { todayLocalIso, formatDateLong } from '@/lib/dates'
import { clearStaffUnlocked } from '@/lib/staff-auth'
import { recordName, readNameHistory, forgetName } from '@/lib/name-history'
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
import QrPreview from '@/components/QrPreview.vue'
import TemplateCard from '@/components/staff/TemplateCard.vue'
import DueUnitPicker from '@/components/staff/DueUnitPicker.vue'
import AppDropdown from '@/components/AppDropdown.vue'
import { useRouter } from 'vue-router'
import { useDialog } from '@/lib/dialog'
import { AVAILABLE_LOCALES, setLocale, type Locale } from '@/lib/i18n'

interface Group {
  key: string
  category: TemplateCategory | null
  templates: Template[]
}

const router = useRouter()
const { t, locale } = useI18n()
const dialog = useDialog()

const stage = ref<'picker' | 'compose'>('picker')
const version = __APP_VERSION__

const kind = ref<'v' | 'b'>('v')
const name = ref('')
const performedOn = ref(todayLocalIso())
const doseNumber = ref<number | null>(1)
const totalDoses = ref<number | null>(3)
const nextDueDays = ref<number | null>(30)
const nextDueUnit = ref<QrDueUnit>('d')
const reminderOnly = ref(false)
// Whether this vaccination is a numbered dose in a primary series (e.g.
// Hep B 1/3). Off by default: most clinic visits are single-shot or annual
// boosters where dose-of-N noise just clutters the QR.
const isMultiDose = ref(false)

function inUnitKey(unit: QrDueUnit): string {
  return unit === 'w' ? 'staff.inWeeks'
    : unit === 'mo' ? 'staff.inMonths'
    : unit === 'y' ? 'staff.inYears'
    : 'staff.inDays'
}
function nextDoseDueInKey(unit: QrDueUnit): string {
  return unit === 'w' ? 'staff.nextDoseDueInWeeks'
    : unit === 'mo' ? 'staff.nextDoseDueInMonths'
    : unit === 'y' ? 'staff.nextDoseDueInYears'
    : 'staff.nextDoseDueIn'
}
function nextTestDueInKey(unit: QrDueUnit): string {
  return unit === 'w' ? 'staff.nextTestDueInWeeks'
    : unit === 'mo' ? 'staff.nextTestDueInMonths'
    : unit === 'y' ? 'staff.nextTestDueInYears'
    : 'staff.nextTestDueIn'
}
function reminderDueInKey(unit: QrDueUnit): string {
  return unit === 'w' ? 'staff.reminderDueInWeeks'
    : unit === 'mo' ? 'staff.reminderDueInMonths'
    : unit === 'y' ? 'staff.reminderDueInYears'
    : 'staff.reminderDueIn'
}
const id = ref(ulid())

watch(reminderOnly, (on) => {
  if (on) performedOn.value = todayLocalIso()
})

// dose_number must never exceed total_doses (no 4/3). Clamp on any change to
// either side — covers manual edits, paste, and applyTemplate.
watch([doseNumber, totalDoses], ([dn, td]) => {
  if (dn != null && td != null && dn > td) doseNumber.value = td
})

// Numbered inputs snap to a sensible default if the user clears them or
// types an invalid value. v-model.number stores '' when the input is
// empty, which would otherwise leave a falsy value in the ref and let
// the QR generation silently skip the field.
function clamp(value: unknown, min: number, fallback: number): number {
  return (typeof value === 'number' && !isNaN(value) && value >= min) ? value : fallback
}
function onDoseChange() { doseNumber.value = clamp(doseNumber.value, 1, 1) }
function onTotalChange() { totalDoses.value = clamp(totalDoses.value, 1, 3) }
function onNextDueChange() { nextDueDays.value = clamp(nextDueDays.value, 1, 30) }

// When the staff toggles a section on, prefill the relevant fields if
// they're currently empty (e.g. user cleared them in a previous session).
watch(isMultiDose, (on) => {
  if (!on) return
  doseNumber.value = clamp(doseNumber.value, 1, 1)
  totalDoses.value = clamp(totalDoses.value, 1, 3)
})
watch(reminderOnly, (on) => {
  if (on) nextDueDays.value = clamp(nextDueDays.value, 1, 30)
})

// On the final dose of a multi-dose series there's no "next dose". Single-
// dose recurring shots (annual flu, tetanus) don't have multi-dose checked,
// so this never fires for them — they keep the next-due field.
const isFinalDoseOfSeries = computed(() => {
  if (!isMultiDose.value) return false
  const dn = doseNumber.value
  const td = totalDoses.value
  return dn != null && td != null && td > 1 && dn >= td
})

// QR mode derived from form state — drives the preview's "Kind" label.
//   'reminder'        → reminder-only QR (k='r')
//   'record_reminder' → record + a scheduled reminder (nd is set, not final dose)
//   'record'          → record only
const qrMode = computed<'record' | 'record_reminder' | 'reminder'>(() => {
  if (reminderOnly.value) return 'reminder'
  if (nextDueDays.value && !isFinalDoseOfSeries.value) return 'record_reminder'
  return 'record'
})
function qrModeKey(m: 'record' | 'record_reminder' | 'reminder'): string {
  return m === 'reminder' ? 'staff.reminder'
    : m === 'record_reminder' ? 'staff.tagRecordReminder'
    : 'staff.tagRecord'
}

const templates = ref<Template[]>([])
const categories = ref<TemplateCategory[]>([])
const templatesLoading = ref(false)
const savedFlash = ref<string | null>(null)

const groups = ref<Group[]>([])
const uncatGroup = ref<Group>({ key: '__uncat__', category: null, templates: [] })

const COLLAPSE_KEY = 'staff_category_collapse'
const collapsed = ref<Record<string, boolean>>(
  (() => { try { return JSON.parse(localStorage.getItem(COLLAPSE_KEY) ?? '{}') } catch { return {} } })(),
)
watch(collapsed, (v) => {
  try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(v)) } catch {}
}, { deep: true })

function isCollapsed(key: string) { return collapsed.value[key] === true }
function toggleCollapsed(key: string) { collapsed.value[key] = !collapsed.value[key] }

function rebuildGroups() {
  const activeCats = categories.value
    .filter(c => c.kind === kind.value)
    .sort((a, b) => a.sort_order - b.sort_order)
  const activeTpls = templates.value.filter(t => t.kind === kind.value)
  groups.value = activeCats.map(cat => ({
    key: cat.id,
    category: cat,
    templates: activeTpls.filter(t => t.category_id === cat.id),
  }))
  uncatGroup.value = {
    key: '__uncat__',
    category: null,
    templates: activeTpls.filter(t => t.category_id === null),
  }
}

async function refreshAll() {
  templatesLoading.value = true
  try {
    const [tpls, cats] = await Promise.all([listTemplates(), listCategories()])
    templates.value = tpls
    categories.value = cats
    rebuildGroups()
  } catch (e) { console.error('Failed to load templates', e) }
  finally { templatesLoading.value = false }
}

watch(kind, rebuildGroups)

function onVisible() {
  if (document.visibilityState === 'visible') refreshAll()
}

onMounted(() => {
  refreshAll()
  document.addEventListener('visibilitychange', onVisible)
})
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisible)
})

const nameHistory = ref(readNameHistory())

// Suggestions = device-typed history first (most-recent), then any names from
// the clinic's saved templates that aren't already in history. No predefined
// catalogue — empty until the clinic actually starts using the app.
const suggestions = computed(() => {
  const history = nameHistory.value[kind.value]
  const fromTemplates = templates.value.filter(t => t.kind === kind.value).map(t => t.name)
  const seen = new Set<string>()
  const out: string[] = []
  for (const n of [...history, ...fromTemplates]) {
    const key = n.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(n.trim())
  }
  return out
})

// Lowercase set of names that are backed by a saved template — they cannot
// be removed from the dropdown (the source is the template, not history).
const templateNameSet = computed(() => {
  const s = new Set<string>()
  for (const t of templates.value) if (t.kind === kind.value) s.add(t.name.trim().toLowerCase())
  return s
})
function isHistoryOnly(n: string) {
  return !templateNameSet.value.has(n.trim().toLowerCase())
}
function forgetSuggestion(n: string) {
  nameHistory.value = forgetName(kind.value, n)
  // Keep dropdown open so the user can purge a few in a row.
  nameHover.value = 0
}

function rememberName() {
  if (!name.value.trim()) return
  nameHistory.value = recordName(kind.value, name.value)
}

// Custom autocomplete dropdown state for the name input.
const nameOpen = ref(false)
const nameHover = ref(0)
const filteredSuggestions = computed(() => {
  const q = name.value.trim().toLowerCase()
  if (!q) return suggestions.value
  return suggestions.value.filter(s => s.toLowerCase().includes(q))
})
function pickSuggestion(s: string) {
  name.value = s
  nameOpen.value = false
}
function onNameBlur() {
  // Delay so a click on a suggestion item registers first.
  setTimeout(() => { nameOpen.value = false }, 120)
}
function onNameKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (!nameOpen.value) { nameOpen.value = true; return }
    nameHover.value = (nameHover.value + 1) % filteredSuggestions.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    nameHover.value = (nameHover.value - 1 + filteredSuggestions.value.length) % filteredSuggestions.value.length
  } else if (e.key === 'Enter' && nameOpen.value && filteredSuggestions.value.length > 0) {
    e.preventDefault()
    pickSuggestion(filteredSuggestions.value[nameHover.value])
  } else if (e.key === 'Escape') {
    nameOpen.value = false
  }
}
watch(name, () => { nameHover.value = 0 })
watch(kind, () => { nameOpen.value = false })

const payload = computed<QrPayload | null>(() => {
  if (!name.value || !performedOn.value) return null
  const effectiveKind: QrKind = reminderOnly.value ? 'r' : kind.value
  if (effectiveKind === 'r' && !nextDueDays.value) return null
  const p: QrPayload = { id: id.value, k: effectiveKind, n: name.value.trim(), d: performedOn.value }
  // Dose-of-N only when staff explicitly marked this as a multi-dose series.
  if (effectiveKind === 'v' && isMultiDose.value) {
    if (doseNumber.value) p.dn = doseNumber.value
    if (totalDoses.value) p.td = totalDoses.value
  }
  // Preserve the v/b choice through reminder-only QRs so the resulting
  // reminder lands with the right `kind` (next_dose vs followup_test).
  if (effectiveKind === 'r') p.ok = kind.value
  // Final dose of a multi-dose series has no "next" — drop nd/nu even if
  // the underlying refs hold stale values from earlier in the form session.
  if (nextDueDays.value && !isFinalDoseOfSeries.value) {
    p.nd = nextDueDays.value
    if (nextDueUnit.value !== 'd') p.nu = nextDueUnit.value
  }
  return p
})

const qrUrl = computed(() => payload.value ? encodePayload(window.location.origin, payload.value) : '')

function formatDate(d: string) {
  return formatDateLong(d, locale.value)
}

function resetForm() {
  id.value = ulid()
  name.value = ''
  performedOn.value = todayLocalIso()
  doseNumber.value = 1
  totalDoses.value = 3
  nextDueDays.value = 30
  nextDueUnit.value = 'd'
  reminderOnly.value = false
  isMultiDose.value = false
}

function newFromScratch(k: 'v' | 'b') {
  kind.value = k
  resetForm()
  stage.value = 'compose'
}

function applyTemplate(tpl: Template) {
  kind.value = tpl.kind
  name.value = tpl.name
  doseNumber.value = tpl.dose_number
  totalDoses.value = tpl.total_doses
  nextDueDays.value = tpl.next_due_days
  nextDueUnit.value = tpl.next_due_unit
  performedOn.value = todayLocalIso()
  reminderOnly.value = tpl.reminder_only
  // A template that stored both numbers is a multi-dose template; legacy
  // single-shot templates that wrote 1/1 will land with the toggle on but
  // staff can flip it off and the dose fields disappear.
  isMultiDose.value = tpl.dose_number != null && tpl.total_doses != null
  id.value = ulid()
  stage.value = 'compose'
}

function backToPicker() {
  rememberName()
  stage.value = 'picker'
}

async function saveCurrentAsTemplate() {
  if (!name.value.trim()) return
  const includeDose = kind.value === 'v' && !reminderOnly.value && isMultiDose.value
  const draft = {
    kind: kind.value,
    name: name.value.trim(),
    dose_number: includeDose ? (doseNumber.value ?? null) : null,
    total_doses: includeDose ? (totalDoses.value ?? null) : null,
    next_due_days: isFinalDoseOfSeries.value ? null : (nextDueDays.value ?? null),
    next_due_unit: nextDueUnit.value,
    reminder_only: reminderOnly.value,
  }
  try {
    savedFlash.value = t('staff.saving')
    await saveTemplateFn(draft)
    rememberName()
    await refreshAll()
    savedFlash.value = t('staff.savedFlash')
    setTimeout(() => { savedFlash.value = null }, 1800)
  } catch (e: any) {
    savedFlash.value = null
    await dialog.alert({ title: t('staff.saveTemplateFailed', { err: e.message ?? 'unknown' }) })
  }
}

async function removeTemplate(tpl: Template) {
  const meta: string[] = []
  if (tpl.kind === 'v' && tpl.dose_number && tpl.total_doses) {
    meta.push(t('staff.seriesOf', { n: tpl.dose_number, total: tpl.total_doses }))
  }
  if (tpl.next_due_days) {
    meta.push(t(inUnitKey(tpl.next_due_unit), { n: tpl.next_due_days }))
  }
  const descriptor = meta.length ? `${tpl.name} · ${meta.join(' · ')}` : tpl.name
  const ok = await dialog.confirm({
    title: t('staff.confirmDeleteTemplate', { name: descriptor }),
    confirmLabel: t('common.delete'),
  })
  if (!ok) return
  try {
    await deleteTemplateFn(tpl.id)
    await refreshAll()
  } catch (e: any) {
    await dialog.alert({ title: t('staff.deleteFailed', { err: e.message ?? 'unknown' }) })
  }
}

// Edit-template dialog state. The form holds editable copies; the
// underlying template (`editingTemplate`) is the snapshot the dialog
// references for kind and id when saving.
const editingTemplate = ref<Template | null>(null)
const editForm = ref({
  name: '',
  dose_number: null as number | null,
  total_doses: null as number | null,
  next_due_days: null as number | null,
  next_due_unit: 'd' as QrDueUnit,
  reminder_only: false,
  isMultiDose: false,
})

const editNameInput = ref<HTMLInputElement | null>(null)
watch(editingTemplate, async (v) => {
  if (!v) return
  await nextTick()
  editNameInput.value?.focus()
  editNameInput.value?.select()
})

// Same dose-clamping invariant as the compose form.
watch(
  () => [editForm.value.dose_number, editForm.value.total_doses] as const,
  ([dn, td]) => {
    if (dn != null && td != null && dn > td) editForm.value.dose_number = td
  },
)
function onEditDoseChange() { editForm.value.dose_number = clamp(editForm.value.dose_number, 1, 1) }
function onEditTotalChange() { editForm.value.total_doses = clamp(editForm.value.total_doses, 1, 3) }
function onEditNextDueChange() { editForm.value.next_due_days = clamp(editForm.value.next_due_days, 1, 30) }
watch(() => editForm.value.isMultiDose, (on) => {
  if (!on) return
  editForm.value.dose_number = clamp(editForm.value.dose_number, 1, 1)
  editForm.value.total_doses = clamp(editForm.value.total_doses, 1, 3)
})
watch(() => editForm.value.reminder_only, (on) => {
  if (on) editForm.value.next_due_days = clamp(editForm.value.next_due_days, 1, 30)
})

const editIsFinalDoseOfSeries = computed(() => {
  if (!editForm.value.isMultiDose) return false
  const dn = editForm.value.dose_number
  const td = editForm.value.total_doses
  return dn != null && td != null && td > 1 && dn >= td
})

function startEditTemplate(tpl: Template) {
  editingTemplate.value = tpl
  editForm.value = {
    name: tpl.name,
    dose_number: tpl.dose_number,
    total_doses: tpl.total_doses,
    next_due_days: tpl.next_due_days,
    next_due_unit: tpl.next_due_unit,
    reminder_only: tpl.reminder_only,
    isMultiDose: tpl.dose_number != null && tpl.total_doses != null,
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
  const includeDose = isVaccine && !isReminderOnly && editForm.value.isMultiDose
  try {
    await updateTemplateFn(tpl.id, {
      name: trimmedName,
      dose_number: includeDose ? (editForm.value.dose_number ?? null) : null,
      total_doses: includeDose ? (editForm.value.total_doses ?? null) : null,
      next_due_days: editIsFinalDoseOfSeries.value ? null : (editForm.value.next_due_days ?? null),
      next_due_unit: editForm.value.next_due_unit,
      reminder_only: isReminderOnly,
    })
    await refreshAll()
    editingTemplate.value = null
  } catch (e: any) {
    await dialog.alert({ title: t('staff.updateTemplateFailed', { err: e?.message ?? 'unknown' }) })
  }
}

async function addCategory() {
  const label = await dialog.prompt({ title: t('staff.categoryNamePrompt') })
  if (!label || !label.trim()) return
  try {
    await createCategoryFn(kind.value, label)
    await refreshAll()
  } catch (e) {
    await dialog.alertError(e, 'Failed to create category')
  }
}

async function onRenameCategory(cat: TemplateCategory) {
  const label = await dialog.prompt({
    title: t('staff.renameCategoryPrompt', { label: cat.label }),
    defaultValue: cat.label,
  })
  if (!label || !label.trim() || label.trim() === cat.label) return
  try {
    await renameCategoryFn(cat.id, label)
    await refreshAll()
  } catch (e) {
    await dialog.alertError(e, 'Failed to rename category')
  }
}

async function onDeleteCategory(cat: TemplateCategory) {
  const ok = await dialog.confirm({
    title: t('staff.confirmDeleteCategory', { label: cat.label }),
    confirmLabel: t('common.delete'),
  })
  if (!ok) return
  try {
    await deleteCategoryFn(cat.id)
    await refreshAll()
  } catch (e) {
    await dialog.alertError(e, 'Failed to delete category')
  }
}

async function onCategoryReorder() {
  const ids = groups.value.map(g => g.key)
  try {
    await reorderCategories(ids)
    const byId = new Map(categories.value.map(c => [c.id, c]))
    ids.forEach((id, i) => { const c = byId.get(id); if (c) c.sort_order = i })
  } catch (e) {
    await dialog.alertError(e, 'Failed to reorder')
    await refreshAll()
  }
}

async function onTemplateChange(group: Group, evt: any) {
  // A cross-category drag fires `removed` on the source group AND `added`
  // on the destination — both handler invocations renumber their own
  // group. Within-category drags only fire `moved`. In all three cases
  // the bucket whose order changed is the one bound to this `group`.
  if (!evt.added && !evt.moved && !evt.removed) return
  try {
    if (evt.added) {
      const tpl = evt.added.element as Template
      const targetId = group.category?.id ?? null
      await moveTemplateToCategory(tpl.id, targetId)
      const src = templates.value.find(t => t.id === tpl.id)
      if (src) src.category_id = targetId
    }
    await reorderTemplates(group.templates.map(t => t.id))
    group.templates.forEach((t, i) => {
      const src = templates.value.find(x => x.id === t.id)
      if (src) src.sort_order = i
    })
  } catch (e) {
    await dialog.alertError(e, 'Failed to update template')
    await refreshAll()
  }
}

function logout() { clearStaffUnlocked(); router.replace('/staff') }

const localeOptions = computed(() => AVAILABLE_LOCALES.map(l => ({ value: l.code, label: l.native })))

const shareOpen = ref(false)
const appUrl = computed(() => window.location.origin + '/')
</script>

<template>
  <main class="min-h-dvh pb-20 print:bg-white print:text-black">
    <!-- Console header -->
    <header class="max-w-[1200px] mx-auto px-6 lg:px-10 pt-8 pb-5 hairline-b flex items-center justify-between print:hidden">
      <div class="flex items-center gap-4">
        <div class="dot-pulse"></div>
        <div class="eyebrow whitespace-nowrap">{{ $t('staff.consoleLabel') }}</div>
        <span class="folio text-xs opacity-40 select-all">{{ version }}</span>
      </div>
      <div class="flex items-center gap-5">
        <AppDropdown
          :model-value="locale"
          :options="localeOptions"
          :aria-label="$t('settings.language')"
          trigger-class="pl-0 pr-5 py-1 text-xs whitespace-nowrap"
          style="color: var(--color-staff-ink); border-bottom: 1px solid var(--color-staff-rule);"
          @update:model-value="(v) => setLocale(v as Locale)"
        />
        <button class="btn-ghost !py-1.5 !px-3 text-xs whitespace-nowrap" @click="shareOpen = true">{{ $t('staff.openOnPhone') }}</button>
        <button class="btn-ghost !py-1.5 !px-3 text-xs whitespace-nowrap" @click="logout">{{ $t('staff.lockConsole') }}</button>
      </div>
    </header>

    <!-- STAGE 1: picker -->
    <section v-if="stage === 'picker'" class="max-w-[1200px] mx-auto px-6 lg:px-10 py-10 space-y-8 print:hidden">
      <div class="space-y-2 anim-rise">
        <div class="eyebrow"><span class="tick" style="background: var(--color-staff-accent)"></span>{{ $t('staff.compose') }}</div>
        <h1 class="font-display text-4xl md:text-5xl leading-[0.95]" style="color: var(--color-staff-ink)">
          {{ $t('staff.pickerTitle') }}
        </h1>
        <p class="text-sm max-w-[50ch]" style="color: var(--color-staff-muted)">
          {{ $t('staff.pickerSubtitle') }}
        </p>
      </div>

      <!-- Kind toggle -->
      <div class="anim-rise-2">
        <div class="grid grid-cols-2 gap-0 hairline w-full max-w-[400px]">
          <label class="px-4 py-3 flex items-center justify-center gap-2 cursor-pointer transition-colors"
            :style="kind === 'v' ? 'background: var(--color-staff-accent); color: var(--color-staff-paper);' : ''">
            <input type="radio" value="v" v-model="kind" class="sr-only" />
            <span class="font-display text-lg whitespace-nowrap">{{ $t('staff.vaccination') }}</span>
          </label>
          <label class="px-4 py-3 flex items-center justify-center gap-2 cursor-pointer transition-colors border-l hairline"
            :style="kind === 'b' ? 'background: var(--color-staff-accent); color: var(--color-staff-paper);' : ''">
            <input type="radio" value="b" v-model="kind" class="sr-only" />
            <span class="font-display text-lg whitespace-nowrap">{{ $t('staff.bloodTest') }}</span>
          </label>
        </div>
      </div>

      <!-- Action row -->
      <div class="anim-rise-3">
        <button
          type="button"
          class="w-full text-left px-6 py-5 hairline transition-colors flex items-center justify-between"
          style="border-style: dashed;"
          @click="newFromScratch(kind)"
        >
          <div>
            <div class="eyebrow mb-1" style="color: var(--color-staff-accent)">+ {{ $t('staff.newFromScratch') }}</div>
            <div class="text-xs" style="color: var(--color-staff-muted)">{{ $t('staff.newFromScratchHint') }}</div>
          </div>
          <span style="color: var(--color-staff-accent)">→</span>
        </button>
      </div>

      <!-- Uncategorized (pinned at top) -->
      <div class="category-block">
        <div class="flex items-center justify-between py-2 hairline-b">
          <button type="button" class="flex items-center gap-3 text-left" @click="toggleCollapsed(uncatGroup.key)">
            <span class="eyebrow" style="color: var(--color-staff-muted)">{{ $t('staff.uncategorized') }}</span>
            <span class="opacity-40 text-xs" aria-hidden>{{ isCollapsed(uncatGroup.key) ? '▸' : '▾' }}</span>
            <span class="text-xs tabular-nums" style="color: var(--color-staff-muted)">{{ uncatGroup.templates.length }}</span>
          </button>
          <button type="button" class="btn-ghost !py-1.5 !px-3 text-xs whitespace-nowrap" @click="addCategory">
            {{ $t('staff.newCategory') }}
          </button>
        </div>
        <draggable
          v-show="!isCollapsed(uncatGroup.key)"
          :list="uncatGroup.templates"
          tag="div"
          class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-3 min-h-[32px]"
          item-key="id"
          :group="'templates-' + kind"
          :force-fallback="true"
          :scroll-sensitivity="100"
          :scroll-speed="20"
          ghost-class="sortable-ghost"
          drag-class="sortable-drag"
          @change="(evt: any) => onTemplateChange(uncatGroup, evt)"
        >
          <template #item="{ element: tpl }">
            <TemplateCard :tpl="tpl" @apply="applyTemplate" @edit="startEditTemplate" @remove="removeTemplate" />
          </template>
        </draggable>
      </div>

      <!-- Categories (draggable) -->
      <draggable
        v-model="groups"
        tag="div"
        class="space-y-8"
        item-key="key"
        handle=".cat-handle"
        :group="'categories-' + kind"
        :force-fallback="true"
        :scroll-sensitivity="100"
        :scroll-speed="20"
        @end="onCategoryReorder"
        ghost-class="sortable-ghost"
        drag-class="sortable-drag"
      >
        <template #item="{ element: group }">
          <div class="category-block">
            <div class="flex items-center justify-between py-2 hairline-b">
              <button type="button" class="cat-handle flex items-center gap-3 text-left cursor-grab active:cursor-grabbing" @click="toggleCollapsed(group.key)">
                <span class="opacity-30 text-xs select-none" aria-hidden>⋮⋮</span>
                <span class="eyebrow" style="color: var(--color-staff-accent)">{{ group.category.label }}</span>
                <span class="opacity-40 text-xs" aria-hidden>{{ isCollapsed(group.key) ? '▸' : '▾' }}</span>
                <span class="text-xs tabular-nums" style="color: var(--color-staff-muted)">{{ group.templates.length }}</span>
              </button>
              <div class="flex gap-4 text-xs">
                <button type="button" class="opacity-50 hover:opacity-100" style="color: var(--color-staff-muted)" @click="onRenameCategory(group.category)">{{ $t('staff.rename') }}</button>
                <button type="button" class="opacity-50 hover:opacity-100" style="color: var(--color-staff-muted)" @click="onDeleteCategory(group.category)">{{ $t('staff.deleteCategory') }}</button>
              </div>
            </div>
            <draggable
              v-show="!isCollapsed(group.key)"
              :list="group.templates"
              tag="div"
              class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-3 min-h-[32px]"
              item-key="id"
              :group="'templates-' + kind"
              :force-fallback="true"
              :scroll-sensitivity="100"
              :scroll-speed="20"
              ghost-class="sortable-ghost"
              drag-class="sortable-drag"
              @change="(evt: any) => onTemplateChange(group, evt)"
            >
              <template #item="{ element: tpl }">
                <TemplateCard :tpl="tpl" @apply="applyTemplate" @edit="startEditTemplate" @remove="removeTemplate" />
              </template>
            </draggable>
          </div>
        </template>
      </draggable>

      <p v-if="!templatesLoading && groups.length === 0 && uncatGroup.templates.length === 0" class="folio text-xs italic pt-2" style="color: var(--color-staff-muted)">
        {{ $t('staff.emptyNoTemplates') }}
      </p>
    </section>

    <!-- STAGE 2: compose + preview -->
    <div v-else class="max-w-[1200px] mx-auto px-6 lg:px-10 py-8 print:block">
      <div class="flex items-center justify-between mb-8 print:hidden">
        <button class="btn-ghost !py-2 !px-4 text-xs whitespace-nowrap" @click="backToPicker">
          {{ $t('staff.backToTemplates') }}
        </button>
        <button
          type="button"
          :disabled="!name.trim()"
          class="btn-ghost !py-1.5 !px-3 text-xs whitespace-nowrap"
          @click="saveCurrentAsTemplate"
        >
          {{ savedFlash ?? $t('staff.saveCurrent') }}
        </button>
      </div>

      <div class="grid lg:grid-cols-[1fr_1fr] gap-10 print:block">
        <section class="space-y-8 print:hidden">
          <div class="space-y-2 anim-rise">
            <div class="eyebrow"><span class="tick" style="background: var(--color-staff-accent)"></span>{{ $t('staff.compose') }}</div>
            <h1 class="font-display text-4xl md:text-5xl leading-[0.95]" style="color: var(--color-staff-ink)">
              {{ $t('staff.newQrPre') }} <span class="font-display-wonk" style="color: var(--color-staff-accent)">{{ $t('staff.newQrWonk') }}</span>.
            </h1>
            <p class="text-sm" style="color: var(--color-staff-muted)">{{ $t('staff.oneQrPerVisit') }}</p>
          </div>

          <form class="space-y-7 anim-rise-2">
            <div>
              <span class="field-label">{{ $t('staff.kindOfRecord') }}</span>
              <div class="grid grid-cols-2 gap-0 hairline mt-1">
                <label class="px-4 py-3 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  :style="kind === 'v' ? 'background: var(--color-staff-accent); color: var(--color-staff-paper);' : ''">
                  <input type="radio" value="v" v-model="kind" class="sr-only" />
                  <span class="font-display text-lg whitespace-nowrap">{{ $t('staff.vaccination') }}</span>
                </label>
                <label class="px-4 py-3 flex items-center justify-center gap-2 cursor-pointer transition-colors border-l hairline"
                  :style="kind === 'b' ? 'background: var(--color-staff-accent); color: var(--color-staff-paper);' : ''">
                  <input type="radio" value="b" v-model="kind" class="sr-only" />
                  <span class="font-display text-lg whitespace-nowrap">{{ $t('staff.bloodTest') }}</span>
                </label>
              </div>
            </div>

            <label class="block relative">
              <span class="field-label">{{ $t('staff.nameLabel') }}</span>
              <input
                v-model="name"
                @focus="nameOpen = true"
                @blur="onNameBlur"
                @keydown="onNameKey"
                autocomplete="off"
                class="field font-display text-2xl"
                :placeholder="$t(kind === 'v' ? 'staff.vaccinePlaceholder' : 'staff.bloodTestPlaceholder')"
              />
              <ul
                v-if="nameOpen && filteredSuggestions.length"
                class="absolute left-0 right-0 top-full mt-1 z-20 max-h-60 overflow-auto hairline shadow-xl"
                style="background: var(--color-staff-panel); color: var(--color-staff-ink); border-color: var(--color-staff-rule);"
                role="listbox"
              >
                <li
                  v-for="(s, i) in filteredSuggestions"
                  :key="s"
                  :id="'name-opt-' + i"
                  role="option"
                  :aria-selected="i === nameHover"
                  class="flex items-center justify-between gap-3 px-4 py-2.5 text-base cursor-pointer transition-colors"
                  :style="i === nameHover ? 'background: var(--color-staff-accent); color: var(--color-staff-paper);' : ''"
                  @mousedown.prevent="pickSuggestion(s)"
                  @mouseenter="nameHover = i"
                >
                  <span class="truncate">{{ s }}</span>
                  <button
                    v-if="isHistoryOnly(s)"
                    type="button"
                    class="shrink-0 text-sm leading-none opacity-40 hover:opacity-100 transition-opacity px-2 -mr-2"
                    :aria-label="'Remove ' + s"
                    @mousedown.prevent.stop="forgetSuggestion(s)"
                  >×</button>
                </li>
              </ul>
            </label>

            <label class="flex items-start gap-3 cursor-pointer select-none">
              <input type="checkbox" v-model="reminderOnly" class="mt-1" />
              <div>
                <div class="field-label">{{ $t('staff.reminderOnly') }}</div>
                <div class="text-xs mt-1" style="color: var(--color-staff-muted)">{{ $t('staff.reminderOnlyHint') }}</div>
              </div>
            </label>

            <label v-if="kind === 'v' && !reminderOnly" class="flex items-start gap-3 cursor-pointer select-none">
              <input type="checkbox" v-model="isMultiDose" class="mt-1" />
              <div>
                <div class="field-label">{{ $t('staff.multiDoseSeries') }}</div>
                <div class="text-xs mt-1" style="color: var(--color-staff-muted)">{{ $t('staff.multiDoseSeriesHint') }}</div>
              </div>
            </label>

            <label v-if="!reminderOnly" class="block">
              <span class="field-label">{{ $t('staff.givenOn') }}</span>
              <input v-model="performedOn" type="date" class="field tabular-nums" />
            </label>

            <div v-if="kind === 'v' && !reminderOnly && isMultiDose" class="grid grid-cols-2 gap-4">
              <label class="block">
                <span class="field-label">{{ $t('staff.doseNumber') }}</span>
                <input v-model.number="doseNumber" @change="onDoseChange" type="number" min="1" :max="totalDoses ?? undefined" class="field tabular-nums text-2xl font-display" />
              </label>
              <label class="block">
                <span class="field-label">{{ $t('staff.of') }}</span>
                <input v-model.number="totalDoses" @change="onTotalChange" type="number" min="1" class="field tabular-nums text-2xl font-display" />
              </label>
            </div>

            <div v-if="reminderOnly">
              <span class="field-label">{{ $t('staff.dueIn') }}</span>
              <div class="flex gap-2 items-stretch mt-1">
                <input v-model.number="nextDueDays" @change="onNextDueChange" type="number" min="1" class="field tabular-nums text-2xl font-display flex-1" />
                <DueUnitPicker v-model="nextDueUnit" class="shrink-0" />
              </div>
            </div>

            <div v-if="!reminderOnly && kind === 'v' && !isFinalDoseOfSeries">
              <span class="field-label">{{ $t('staff.nextDoseIn') }}</span>
              <div class="flex gap-2 items-stretch mt-1">
                <input v-model.number="nextDueDays" @change="onNextDueChange" type="number" min="1" class="field tabular-nums text-2xl font-display flex-1" />
                <DueUnitPicker v-model="nextDueUnit" class="shrink-0" />
              </div>
            </div>

            <div v-if="!reminderOnly && kind === 'b'">
              <span class="field-label">{{ $t('staff.nextDueIn') }}</span>
              <div class="flex gap-2 items-stretch mt-1">
                <input v-model.number="nextDueDays" @change="onNextDueChange" type="number" min="1" class="field tabular-nums text-2xl font-display flex-1" />
                <DueUnitPicker v-model="nextDueUnit" class="shrink-0" />
              </div>
            </div>

            <div class="pt-4 hairline-t">
              <button type="button" class="btn-primary w-full" @click="backToPicker">
                {{ $t('staff.doneScanning') }} <span aria-hidden>→</span>
              </button>
            </div>
          </form>
        </section>

        <section class="space-y-6">
          <div class="eyebrow print:hidden"><span class="tick" style="background: var(--color-staff-accent)"></span>{{ $t('staff.preview') }}</div>

          <div class="paper-card p-8 md:p-12 print:shadow-none print:border-0 print:p-0 anim-rise-3 print:bg-white print:text-black">
            <div class="flex items-start justify-between pb-4 mb-6 hairline-b print:border-black/20">
              <div>
                <div class="eyebrow print:text-black" style="color: var(--color-staff-muted)">{{ $t('staff.patientRecordLabel') }}</div>
              </div>
              <div class="folio text-right">
                {{ reminderOnly ? 'R' : kind === 'v' ? 'Rx' : 'Lab' }} / v1<br/>
                {{ formatDate(todayLocalIso()) }}
              </div>
            </div>

            <div class="flex justify-center mb-6">
              <div class="p-4 bg-white border hairline">
                <QrPreview v-if="qrUrl" :text="qrUrl" />
                <div v-else class="w-[280px] h-[280px] grid place-items-center font-display-wonk text-muted-app">
                  {{ $t('staff.awaitingEntry') }}
                </div>
              </div>
            </div>

            <div v-if="payload" class="space-y-4">
              <h2 class="font-display text-3xl md:text-4xl leading-[0.95] text-center print:text-black" style="color: var(--color-staff-ink)">
                {{ payload.n }}
              </h2>
              <dl class="grid grid-cols-3 gap-3 hairline-t hairline-b py-4 text-center">
                <div>
                  <dt class="eyebrow">{{ $t('staff.kind') }}</dt>
                  <dd class="font-display text-lg mt-1">{{ $t(qrModeKey(qrMode)) }}</dd>
                </div>
                <div class="border-x hairline">
                  <dt class="eyebrow">{{ $t('staff.series') }}</dt>
                  <dd class="font-display text-lg mt-1 tabular-nums">
                    <template v-if="kind === 'v' && payload.dn && payload.td">{{ $t('staff.seriesOf', { n: payload.dn, total: payload.td }) }}</template>
                    <template v-else>—</template>
                  </dd>
                </div>
                <div>
                  <dt class="eyebrow">{{ $t('staff.given') }}</dt>
                  <dd class="font-display text-lg mt-1 tabular-nums">{{ formatDate(payload.d) }}</dd>
                </div>
              </dl>
              <p v-if="payload.nd" class="text-center text-sm font-display-wonk italic" style="color: var(--color-staff-muted)">
                {{ $t(reminderOnly ? reminderDueInKey(nextDueUnit) : kind === 'b' ? nextTestDueInKey(nextDueUnit) : nextDoseDueInKey(nextDueUnit), { n: payload.nd }) }}
              </p>
            </div>

          </div>
        </section>
      </div>
    </div>

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
                ref="editNameInput"
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

            <label v-if="editingTemplate.kind === 'v' && !editForm.reminder_only" class="flex items-start gap-3 cursor-pointer select-none">
              <input type="checkbox" v-model="editForm.isMultiDose" class="mt-1" />
              <div>
                <div class="field-label">{{ $t('staff.multiDoseSeries') }}</div>
                <div class="text-xs mt-1" style="color: var(--color-staff-muted)">{{ $t('staff.multiDoseSeriesHint') }}</div>
              </div>
            </label>

            <div v-if="editingTemplate.kind === 'v' && !editForm.reminder_only && editForm.isMultiDose" class="grid grid-cols-2 gap-4">
              <label class="block">
                <span class="field-label">{{ $t('staff.doseNumber') }}</span>
                <input v-model.number="editForm.dose_number" @change="onEditDoseChange" type="number" min="1" :max="editForm.total_doses ?? undefined" class="field tabular-nums text-2xl font-display" />
              </label>
              <label class="block">
                <span class="field-label">{{ $t('staff.of') }}</span>
                <input v-model.number="editForm.total_doses" @change="onEditTotalChange" type="number" min="1" class="field tabular-nums text-2xl font-display" />
              </label>
            </div>

            <div v-if="editForm.reminder_only">
              <span class="field-label">{{ $t('staff.dueIn') }}</span>
              <div class="flex gap-2 items-stretch mt-1">
                <input v-model.number="editForm.next_due_days" @change="onEditNextDueChange" type="number" min="1" class="field tabular-nums text-2xl font-display flex-1" />
                <DueUnitPicker v-model="editForm.next_due_unit" class="shrink-0" />
              </div>
            </div>

            <div v-if="!editForm.reminder_only && editingTemplate.kind === 'v' && !editIsFinalDoseOfSeries">
              <span class="field-label">{{ $t('staff.nextDoseIn') }}</span>
              <div class="flex gap-2 items-stretch mt-1">
                <input v-model.number="editForm.next_due_days" @change="onEditNextDueChange" type="number" min="1" class="field tabular-nums text-2xl font-display flex-1" />
                <DueUnitPicker v-model="editForm.next_due_unit" class="shrink-0" />
              </div>
            </div>

            <div v-if="!editForm.reminder_only && editingTemplate.kind === 'b'">
              <span class="field-label">{{ $t('staff.nextDueIn') }}</span>
              <div class="flex gap-2 items-stretch mt-1">
                <input v-model.number="editForm.next_due_days" @change="onEditNextDueChange" type="number" min="1" class="field tabular-nums text-2xl font-display flex-1" />
                <DueUnitPicker v-model="editForm.next_due_unit" class="shrink-0" />
              </div>
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

    <Teleport to="body">
      <div
        v-if="shareOpen"
        class="share-qr-backdrop print:hidden"
        role="dialog"
        aria-modal="true"
        @click.self="shareOpen = false"
        @keydown.esc="shareOpen = false"
      >
        <div class="paper-card share-qr-card anim-rise">
          <div class="eyebrow mb-3"><span class="tick" style="background: var(--color-staff-accent)"></span>{{ $t('staff.openOnPhone') }}</div>
          <h2 class="font-display text-3xl md:text-4xl leading-[0.95]">
            {{ $t('staff.openOnPhoneTitle') }}
          </h2>
          <p class="text-sm mt-2" style="color: var(--color-staff-muted)">{{ $t('staff.openOnPhoneHint') }}</p>

          <div class="flex justify-center my-6">
            <div class="p-4 bg-white border hairline">
              <QrPreview :text="appUrl" />
            </div>
          </div>

          <p class="text-center font-mono text-xs break-all" style="color: var(--color-staff-muted)">
            {{ appUrl }}
          </p>

          <div class="flex justify-end mt-6">
            <button type="button" class="btn-ghost !py-1.5 !px-4 text-xs whitespace-nowrap" @click="shareOpen = false">
              {{ $t('common.close') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </main>
</template>

<style scoped>
.sortable-ghost {
  opacity: 0.3;
  background: rgba(255, 255, 255, 0.04);
}
.sortable-drag {
  opacity: 0.95;
  transform: rotate(1deg);
}

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

.share-qr-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: grid;
  place-items: center;
  padding: 1rem;
  z-index: 100;
  animation: share-qr-fade 140ms ease-out;
}
.share-qr-card {
  width: 100%;
  max-width: 420px;
  padding: 1.75rem 1.75rem 1.5rem;
}
@keyframes share-qr-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

@media print {
  :global(body) {
    background: white !important;
    color: black !important;
  }
  :global(body.staff-theme) {
    background: white !important;
    color: black !important;
  }
}
</style>
