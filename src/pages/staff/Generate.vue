<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ulid } from 'ulid'
import { useI18n } from 'vue-i18n'
import { encodePayload, type QrPayload } from '@/lib/qr-payload'
import { clearStaffUnlocked } from '@/lib/staff-auth'
import { VACCINE_NAMES, TEST_NAMES } from '@/lib/dictionary'
import {
  listTemplates,
  saveTemplate as saveTemplateFn,
  deleteTemplate as deleteTemplateFn,
  autoLabel,
  type Template,
} from '@/lib/templates'
import QrPreview from '@/components/QrPreview.vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const { t, locale } = useI18n()

const kind = ref<'v' | 'b'>('v')
const name = ref('')
const performedOn = ref(new Date().toISOString().slice(0, 10))
const doseNumber = ref<number | null>(1)
const totalDoses = ref<number | null>(3)
const nextDueDays = ref<number | null>(30)
const id = ref(ulid())

const templates = ref<Template[]>([])
const templatesLoading = ref(false)
const savedFlash = ref<string | null>(null)

async function refreshTemplates() {
  templatesLoading.value = true
  try { templates.value = await listTemplates() }
  catch (e) { console.error('Failed to load templates', e) }
  finally { templatesLoading.value = false }
}

function onVisible() {
  if (document.visibilityState === 'visible') refreshTemplates()
}

onMounted(() => {
  refreshTemplates()
  document.addEventListener('visibilitychange', onVisible)
})
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisible)
})

const suggestions = computed(() => (kind.value === 'v' ? VACCINE_NAMES : TEST_NAMES))

const payload = computed<QrPayload | null>(() => {
  if (!name.value || !performedOn.value) return null
  const p: QrPayload = { id: id.value, k: kind.value, n: name.value.trim(), d: performedOn.value }
  if (kind.value === 'v') {
    if (doseNumber.value) p.dn = doseNumber.value
    if (totalDoses.value) p.td = totalDoses.value
  }
  if (nextDueDays.value) p.nd = nextDueDays.value
  return p
})

const qrUrl = computed(() => payload.value ? encodePayload(window.location.origin, payload.value) : '')

const visibleTemplates = computed(() => templates.value.filter((t) => t.kind === kind.value))

function formatDate(d: string) {
  const l = locale.value === 'zh' ? 'zh-CN' : locale.value === 'ms' ? 'ms-MY' : 'en-GB'
  return new Date(d).toLocaleDateString(l, { day: '2-digit', month: 'long', year: 'numeric' })
}

function newQr() {
  id.value = ulid()
  name.value = ''
  performedOn.value = new Date().toISOString().slice(0, 10)
  doseNumber.value = 1
  totalDoses.value = 3
  nextDueDays.value = 30
}

function applyTemplate(t: Template) {
  kind.value = t.kind
  name.value = t.name
  doseNumber.value = t.dose_number
  totalDoses.value = t.total_doses
  nextDueDays.value = t.next_due_days
  performedOn.value = new Date().toISOString().slice(0, 10)
  id.value = ulid()
}

async function saveCurrentAsTemplate() {
  if (!name.value.trim()) return
  const draft = {
    kind: kind.value,
    name: name.value.trim(),
    dose_number: kind.value === 'v' ? (doseNumber.value ?? null) : null,
    total_doses: kind.value === 'v' ? (totalDoses.value ?? null) : null,
    next_due_days: nextDueDays.value ?? null,
  }
  const suggested = autoLabel(draft)
  const label = window.prompt(t('staff.labelForTemplate'), suggested)
  if (label === null) return
  try {
    savedFlash.value = t('staff.saving')
    await saveTemplateFn({ ...draft, label: label.trim() || suggested })
    await refreshTemplates()
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
    await refreshTemplates()
  } catch (e: any) {
    alert(t('staff.deleteFailed', { err: e.message ?? 'unknown' }))
  }
}

function logout() { clearStaffUnlocked(); router.replace('/staff') }

function printPage() { window.print() }
</script>

<template>
  <main class="min-h-dvh pb-20 print:bg-white print:text-black">
    <!-- Console header -->
    <header class="max-w-[1200px] mx-auto px-6 lg:px-10 pt-8 pb-5 hairline-b flex items-center justify-between print:hidden">
      <div class="flex items-center gap-4">
        <div class="dot-pulse"></div>
        <div class="eyebrow">{{ $t('staff.consoleLabelDispatch') }}</div>
      </div>
      <div class="flex items-center gap-5">
        <div class="folio">{{ $t('staff.session', { id: id.slice(0, 8) }) }}</div>
        <button class="btn-ghost !py-1.5 !px-3 text-xs" @click="logout">{{ $t('staff.lockConsole') }}</button>
      </div>
    </header>

    <!-- Templates strip -->
    <section class="max-w-[1200px] mx-auto px-6 lg:px-10 pt-6 print:hidden">
      <div class="flex items-baseline justify-between mb-3">
        <div class="flex items-baseline gap-3">
          <h2 class="font-display text-xl" style="color: var(--color-staff-ink)">{{ $t('staff.savedTemplates') }}</h2>
          <span class="eyebrow">{{ $t('staff.templatesCount', { count: visibleTemplates.length, what: kind === 'v' ? $t('staff.forVaccines') : $t('staff.forTests') }) }}</span>
        </div>
        <button
          type="button"
          :disabled="!name.trim()"
          class="btn-ghost !py-1.5 !px-3 text-xs"
          @click="saveCurrentAsTemplate"
        >
          {{ savedFlash ?? $t('staff.saveCurrent') }}
        </button>
      </div>

      <div v-if="templatesLoading && visibleTemplates.length === 0" class="folio text-xs italic" style="color: var(--color-staff-muted)">
        {{ $t('staff.templatesLoading') }}
      </div>
      <div v-else-if="visibleTemplates.length === 0" class="folio text-xs italic" style="color: var(--color-staff-muted)">
        {{ $t('staff.noTemplates') }}
      </div>

      <div v-else class="flex flex-wrap gap-2">
        <div
          v-for="tpl in visibleTemplates"
          :key="tpl.id"
          class="group inline-flex items-stretch hairline overflow-hidden"
        >
          <button
            type="button"
            class="px-3 py-2 text-sm flex items-center gap-2 transition-colors"
            style="color: var(--color-staff-ink)"
            @click="applyTemplate(tpl)"
          >
            <span class="font-display">{{ tpl.label }}</span>
          </button>
          <button
            type="button"
            class="px-2.5 border-l hairline opacity-40 hover:opacity-100 transition-opacity"
            style="color: var(--color-staff-muted)"
            @click="removeTemplate(tpl)"
          >×</button>
        </div>
      </div>
    </section>

    <div class="max-w-[1200px] mx-auto px-6 lg:px-10 py-8 grid lg:grid-cols-[1fr_1fr] gap-10 print:block">
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
                <span class="font-display text-lg">{{ $t('staff.vaccination') }}</span>
              </label>
              <label class="px-4 py-3 flex items-center justify-center gap-2 cursor-pointer transition-colors border-l hairline"
                :style="kind === 'b' ? 'background: var(--color-staff-accent); color: var(--color-staff-paper);' : ''">
                <input type="radio" value="b" v-model="kind" class="sr-only" />
                <span class="font-display text-lg">{{ $t('staff.bloodTest') }}</span>
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

          <div class="grid grid-cols-[1fr_1fr_1fr] gap-4">
            <label class="block">
              <span class="field-label">{{ $t('staff.givenOn') }}</span>
              <input v-model="performedOn" type="date" class="field tabular-nums" />
            </label>
            <label v-if="kind === 'v'" class="block">
              <span class="field-label">{{ $t('staff.doseNumber') }}</span>
              <input v-model.number="doseNumber" type="number" min="1" class="field tabular-nums text-2xl font-display" />
            </label>
            <label v-if="kind === 'v'" class="block">
              <span class="field-label">{{ $t('staff.of') }}</span>
              <input v-model.number="totalDoses" type="number" min="1" class="field tabular-nums text-2xl font-display" />
            </label>
            <label v-if="kind === 'b'" class="block col-span-2">
              <span class="field-label">{{ $t('staff.nextDueDays') }}</span>
              <input v-model.number="nextDueDays" type="number" min="0" class="field tabular-nums text-2xl font-display" />
            </label>
          </div>

          <label v-if="kind === 'v'" class="block">
            <span class="field-label">{{ $t('staff.nextDoseInDays') }}</span>
            <input v-model.number="nextDueDays" type="number" min="0" class="field tabular-nums" />
          </label>

          <div class="flex gap-3 pt-4 hairline-t">
            <button type="button" class="btn-primary flex-1" @click="printPage">
              {{ $t('staff.print') }} <span aria-hidden>↗</span>
            </button>
            <button type="button" class="btn-ghost" @click="newQr">{{ $t('staff.newForNext') }}</button>
          </div>
        </form>
      </section>

      <!-- RIGHT: preview + print surface -->
      <section class="space-y-6">
        <div class="eyebrow print:hidden"><span class="tick" style="background: var(--color-staff-accent)"></span>{{ $t('staff.preview') }}</div>

        <div class="paper-card p-8 md:p-12 print:shadow-none print:border-0 print:p-0 anim-rise-3 print:bg-white print:text-black">
          <div class="flex items-start justify-between pb-4 mb-6 hairline-b print:border-black/20">
            <div>
              <div class="eyebrow print:text-black" style="color: var(--color-staff-muted)">{{ $t('staff.patientRecordLabel') }}</div>
              <div class="folio mt-1">ref {{ id.slice(0, 10) }}</div>
            </div>
            <div class="folio text-right">
              {{ kind === 'v' ? 'Rx' : 'Lab' }} / v1<br/>
              {{ formatDate(new Date().toISOString().slice(0,10)) }}
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
                <dd class="font-display text-lg mt-1">{{ kind === 'v' ? $t('staff.vaccine') : $t('staff.bloodTestShort') }}</dd>
              </div>
              <div v-if="kind === 'v' && payload.dn && payload.td" class="border-x hairline">
                <dt class="eyebrow">{{ $t('staff.series') }}</dt>
                <dd class="font-display text-lg mt-1 tabular-nums">{{ $t('staff.seriesOf', { n: payload.dn, total: payload.td }) }}</dd>
              </div>
              <div v-else-if="payload.nd" class="border-x hairline">
                <dt class="eyebrow">{{ $t('staff.nextTest') }}</dt>
                <dd class="font-display text-lg mt-1 tabular-nums">{{ $t('staff.inDays', { n: payload.nd }) }}</dd>
              </div>
              <div>
                <dt class="eyebrow">{{ $t('staff.given') }}</dt>
                <dd class="font-display text-lg mt-1 tabular-nums">{{ formatDate(payload.d) }}</dd>
              </div>
            </dl>
            <p v-if="kind === 'v' && payload.nd" class="text-center text-sm font-display-wonk italic" style="color: var(--color-staff-muted)">
              {{ $t('staff.nextDoseDueIn', { n: payload.nd }) }}
            </p>
          </div>

          <div class="mt-6 pt-4 hairline-t text-center">
            <p class="font-display-wonk text-lg leading-snug" style="color: var(--color-staff-muted)">
              {{ $t('staff.scanInstruction') }}
            </p>
          </div>
        </div>

        <p class="text-xs font-mono-app break-all text-center print:hidden" style="color: var(--color-staff-muted)">
          {{ qrUrl || '—' }}
        </p>
      </section>
    </div>
  </main>
</template>

<style scoped>
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
