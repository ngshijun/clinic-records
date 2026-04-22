<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ulid } from 'ulid'
import { useI18n } from 'vue-i18n'
import draggable from 'vuedraggable'
import { encodePayload, type QrPayload, type QrKind } from '@/lib/qr-payload'
import { todayLocalIso } from '@/lib/dates'
import { clearStaffUnlocked } from '@/lib/staff-auth'
import { VACCINE_NAMES, TEST_NAMES } from '@/lib/dictionary'
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
  autoLabel,
  type Template,
  type TemplateCategory,
} from '@/lib/templates'
import QrPreview from '@/components/QrPreview.vue'
import { useRouter } from 'vue-router'

interface Group {
  key: string
  category: TemplateCategory | null
  templates: Template[]
}

const router = useRouter()
const { t, locale } = useI18n()

const stage = ref<'picker' | 'compose'>('picker')

const kind = ref<'v' | 'b'>('v')
const name = ref('')
const performedOn = ref(todayLocalIso())
const doseNumber = ref<number | null>(1)
const totalDoses = ref<number | null>(3)
const nextDueDays = ref<number | null>(30)
const reminderOnly = ref(false)
const id = ref(ulid())

watch(reminderOnly, (on) => {
  if (on) performedOn.value = todayLocalIso()
})

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

const suggestions = computed(() => (kind.value === 'v' ? VACCINE_NAMES : TEST_NAMES))

const seriesComplete = computed(() =>
  kind.value === 'v'
  && doseNumber.value != null
  && totalDoses.value != null
  && doseNumber.value >= totalDoses.value,
)

watch(seriesComplete, (complete) => {
  if (complete) nextDueDays.value = null
})

const payload = computed<QrPayload | null>(() => {
  if (!name.value || !performedOn.value) return null
  const effectiveKind: QrKind = reminderOnly.value ? 'r' : kind.value
  if (effectiveKind === 'r' && !nextDueDays.value) return null
  const p: QrPayload = { id: id.value, k: effectiveKind, n: name.value.trim(), d: performedOn.value }
  if (effectiveKind === 'v') {
    if (doseNumber.value) p.dn = doseNumber.value
    if (totalDoses.value) p.td = totalDoses.value
  }
  if (nextDueDays.value) p.nd = nextDueDays.value
  return p
})

const qrUrl = computed(() => payload.value ? encodePayload(window.location.origin, payload.value) : '')

function formatDate(d: string) {
  const l = locale.value === 'zh' ? 'zh-CN' : locale.value === 'ms' ? 'ms-MY' : 'en-GB'
  return new Date(d).toLocaleDateString(l, { day: '2-digit', month: 'long', year: 'numeric' })
}

function resetForm() {
  id.value = ulid()
  name.value = ''
  performedOn.value = todayLocalIso()
  doseNumber.value = 1
  totalDoses.value = 3
  nextDueDays.value = 30
  reminderOnly.value = false
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
  performedOn.value = todayLocalIso()
  reminderOnly.value = tpl.reminder_only
  id.value = ulid()
  stage.value = 'compose'
}

function backToPicker() {
  stage.value = 'picker'
}

async function saveCurrentAsTemplate() {
  if (!name.value.trim()) return
  const draft = {
    kind: kind.value,
    name: name.value.trim(),
    dose_number: kind.value === 'v' && !reminderOnly.value ? (doseNumber.value ?? null) : null,
    total_doses: kind.value === 'v' && !reminderOnly.value ? (totalDoses.value ?? null) : null,
    next_due_days: nextDueDays.value ?? null,
    reminder_only: reminderOnly.value,
  }
  const suggested = autoLabel(draft)
  const label = window.prompt(t('staff.labelForTemplate'), suggested)
  if (label === null) return
  try {
    savedFlash.value = t('staff.saving')
    await saveTemplateFn({ ...draft, label: label.trim() || suggested })
    await refreshAll()
    savedFlash.value = t('staff.savedFlash')
    setTimeout(() => { savedFlash.value = null }, 1800)
  } catch (e: any) {
    savedFlash.value = null
    alert(t('staff.saveTemplateFailed', { err: e.message ?? 'unknown' }))
  }
}

async function removeTemplate(tpl: Template) {
  if (!window.confirm(t('staff.confirmDeleteTemplate', { label: tpl.label }))) return
  try {
    await deleteTemplateFn(tpl.id)
    await refreshAll()
  } catch (e: any) {
    alert(t('staff.deleteFailed', { err: e.message ?? 'unknown' }))
  }
}

async function addCategory() {
  const label = window.prompt(t('staff.categoryNamePrompt'))
  if (!label || !label.trim()) return
  try {
    await createCategoryFn(kind.value, label)
    await refreshAll()
  } catch (e: any) {
    alert(e.message ?? 'Failed to create category')
  }
}

async function onRenameCategory(cat: TemplateCategory) {
  const label = window.prompt(t('staff.renameCategoryPrompt', { label: cat.label }), cat.label)
  if (!label || !label.trim() || label.trim() === cat.label) return
  try {
    await renameCategoryFn(cat.id, label)
    await refreshAll()
  } catch (e: any) {
    alert(e.message ?? 'Failed to rename category')
  }
}

async function onDeleteCategory(cat: TemplateCategory) {
  if (!window.confirm(t('staff.confirmDeleteCategory', { label: cat.label }))) return
  try {
    await deleteCategoryFn(cat.id)
    await refreshAll()
  } catch (e: any) {
    alert(e.message ?? 'Failed to delete category')
  }
}

async function onCategoryReorder() {
  const ids = groups.value.map(g => g.key)
  try {
    await reorderCategories(ids)
    const byId = new Map(categories.value.map(c => [c.id, c]))
    ids.forEach((id, i) => { const c = byId.get(id); if (c) c.sort_order = i })
  } catch (e: any) {
    alert(e.message ?? 'Failed to reorder')
    await refreshAll()
  }
}

async function onTemplateChange(group: Group, evt: any) {
  if (!evt.added) return
  const tpl = evt.added.element as Template
  const targetId = group.category?.id ?? null
  try {
    await moveTemplateToCategory(tpl.id, targetId)
    const src = templates.value.find(t => t.id === tpl.id)
    if (src) src.category_id = targetId
  } catch (e: any) {
    alert(e.message ?? 'Failed to move template')
    await refreshAll()
  }
}

function logout() { clearStaffUnlocked(); router.replace('/staff') }
</script>

<template>
  <main class="min-h-dvh pb-20 print:bg-white print:text-black">
    <!-- Console header -->
    <header class="max-w-[1200px] mx-auto px-6 lg:px-10 pt-8 pb-5 hairline-b flex items-center justify-between print:hidden">
      <div class="flex items-center gap-4">
        <div class="dot-pulse"></div>
        <div class="eyebrow whitespace-nowrap">{{ $t('staff.consoleLabel') }}</div>
      </div>
      <div class="flex items-center gap-5">
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
          ghost-class="sortable-ghost"
          drag-class="sortable-drag"
          @change="(evt: any) => onTemplateChange(uncatGroup, evt)"
        >
          <template #item="{ element: tpl }">
            <div class="group relative hairline min-h-[140px] flex cursor-grab active:cursor-grabbing">
              <button
                type="button"
                class="flex-1 p-6 text-left flex flex-col justify-between transition-colors hover:bg-white/[0.03]"
                @click="applyTemplate(tpl)"
              >
                <div>
                  <div class="font-display text-xl leading-tight mb-2" style="color: var(--color-staff-ink)">
                    {{ tpl.name }}
                  </div>
                  <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs" style="color: var(--color-staff-muted)">
                    <span v-if="tpl.kind === 'v' && tpl.dose_number && tpl.total_doses" class="tabular-nums">
                      {{ $t('staff.seriesOf', { n: tpl.dose_number, total: tpl.total_doses }) }}
                    </span>
                    <span v-if="tpl.next_due_days" class="tabular-nums">
                      {{ $t('staff.inDays', { n: tpl.next_due_days }) }}
                    </span>
                  </div>
                </div>
                <div class="flex items-center justify-between">
                  <span class="eyebrow" style="color: var(--color-staff-accent)">{{ tpl.label }}</span>
                  <span class="opacity-0 group-hover:opacity-100 transition-opacity" style="color: var(--color-staff-accent)">→</span>
                </div>
              </button>
              <button
                type="button"
                class="px-3 border-l hairline opacity-40 hover:opacity-100 transition-opacity"
                :aria-label="'Delete ' + tpl.label"
                style="color: var(--color-staff-muted)"
                @click.stop="removeTemplate(tpl)"
              >×</button>
            </div>
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
              ghost-class="sortable-ghost"
              drag-class="sortable-drag"
              @change="(evt: any) => onTemplateChange(group, evt)"
            >
              <template #item="{ element: tpl }">
                <div class="group relative hairline min-h-[140px] flex cursor-grab active:cursor-grabbing">
                  <button
                    type="button"
                    class="flex-1 p-6 text-left flex flex-col justify-between transition-colors hover:bg-white/[0.03]"
                    @click="applyTemplate(tpl)"
                  >
                    <div>
                      <div class="font-display text-xl leading-tight mb-2" style="color: var(--color-staff-ink)">
                        {{ tpl.name }}
                      </div>
                      <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs" style="color: var(--color-staff-muted)">
                        <span v-if="tpl.kind === 'v' && tpl.dose_number && tpl.total_doses" class="tabular-nums">
                          {{ $t('staff.seriesOf', { n: tpl.dose_number, total: tpl.total_doses }) }}
                        </span>
                        <span v-if="tpl.next_due_days" class="tabular-nums">
                          {{ $t('staff.inDays', { n: tpl.next_due_days }) }}
                        </span>
                      </div>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="eyebrow" style="color: var(--color-staff-accent)">{{ tpl.label }}</span>
                      <span class="opacity-0 group-hover:opacity-100 transition-opacity" style="color: var(--color-staff-accent)">→</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    class="px-3 border-l hairline opacity-40 hover:opacity-100 transition-opacity"
                    :aria-label="'Delete ' + tpl.label"
                    style="color: var(--color-staff-muted)"
                    @click.stop="removeTemplate(tpl)"
                  >×</button>
                </div>
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

            <label class="block">
              <span class="field-label">{{ $t('staff.nameLabel') }}</span>
              <input v-model="name" list="names" class="field font-display text-2xl" :placeholder="$t('staff.namePlaceholder')" />
              <datalist id="names">
                <option v-for="n in suggestions" :key="n" :value="n" />
              </datalist>
            </label>

            <label class="flex items-start gap-3 cursor-pointer select-none">
              <input type="checkbox" v-model="reminderOnly" class="mt-1" />
              <div>
                <div class="field-label">{{ $t('staff.reminderOnly') }}</div>
                <div class="text-xs mt-1" style="color: var(--color-staff-muted)">{{ $t('staff.reminderOnlyHint') }}</div>
              </div>
            </label>

            <div class="grid grid-cols-[1fr_1fr_1fr] gap-4">
              <label v-if="!reminderOnly" class="block">
                <span class="field-label">{{ $t('staff.givenOn') }}</span>
                <input v-model="performedOn" type="date" class="field tabular-nums" />
              </label>
              <label v-if="kind === 'v' && !reminderOnly" class="block">
                <span class="field-label">{{ $t('staff.doseNumber') }}</span>
                <input v-model.number="doseNumber" type="number" min="1" class="field tabular-nums text-2xl font-display" />
              </label>
              <label v-if="kind === 'v' && !reminderOnly" class="block">
                <span class="field-label">{{ $t('staff.of') }}</span>
                <input v-model.number="totalDoses" type="number" min="1" class="field tabular-nums text-2xl font-display" />
              </label>
              <label v-if="reminderOnly" class="block col-span-3">
                <span class="field-label">{{ $t('staff.dueInDays') }}</span>
                <input v-model.number="nextDueDays" type="number" min="1" class="field tabular-nums text-2xl font-display" />
              </label>
              <label v-else-if="kind === 'b'" class="block col-span-2">
                <span class="field-label">{{ $t('staff.nextDueDays') }}</span>
                <input v-model.number="nextDueDays" type="number" min="0" class="field tabular-nums text-2xl font-display" />
              </label>
            </div>

            <template v-if="kind === 'v' && !reminderOnly">
              <p v-if="seriesComplete" class="font-display-wonk italic text-sm" style="color: var(--color-staff-muted)">
                {{ $t('staff.seriesCompleteNote') }}
              </p>
              <label v-else class="block">
                <span class="field-label">{{ $t('staff.nextDoseInDays') }}</span>
                <input v-model.number="nextDueDays" type="number" min="0" class="field tabular-nums" />
              </label>
            </template>

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
                  <dd class="font-display text-lg mt-1">{{ reminderOnly ? $t('staff.reminder') : (kind === 'v' ? $t('staff.vaccine') : $t('staff.bloodTestShort')) }}</dd>
                </div>
                <div v-if="kind === 'v' && payload.dn && payload.td" class="border-x hairline">
                  <dt class="eyebrow">{{ $t('staff.series') }}</dt>
                  <dd class="font-display text-lg mt-1 tabular-nums">{{ $t('staff.seriesOf', { n: payload.dn, total: payload.td }) }}</dd>
                </div>
                <div v-else-if="payload.nd" class="border-x hairline">
                  <dt class="eyebrow">{{ reminderOnly ? $t('staff.due') : $t('staff.nextTest') }}</dt>
                  <dd class="font-display text-lg mt-1 tabular-nums">{{ $t('staff.inDays', { n: payload.nd }) }}</dd>
                </div>
                <div>
                  <dt class="eyebrow">{{ reminderOnly ? $t('staff.issued') : $t('staff.given') }}</dt>
                  <dd class="font-display text-lg mt-1 tabular-nums">{{ formatDate(payload.d) }}</dd>
                </div>
              </dl>
              <p v-if="kind === 'v' && !reminderOnly && payload.nd" class="text-center text-sm font-display-wonk italic" style="color: var(--color-staff-muted)">
                {{ $t('staff.nextDoseDueIn', { n: payload.nd }) }}
              </p>
            </div>

            <div class="mt-6 pt-4 hairline-t text-center">
              <p class="font-display-wonk text-lg leading-snug" style="color: var(--color-staff-muted)">
                {{ $t('staff.scanInstruction') }}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
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
