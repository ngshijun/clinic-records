<script setup lang="ts">
import { computed, ref } from 'vue'
import { ulid } from 'ulid'
import { encodePayload, type QrPayload } from '@/lib/qr-payload'
import { clearStaffUnlocked } from '@/lib/staff-auth'
import { VACCINE_NAMES, TEST_NAMES } from '@/lib/dictionary'
import QrPreview from '@/components/QrPreview.vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const kind = ref<'v' | 'b'>('v')
const name = ref('')
const performedOn = ref(new Date().toISOString().slice(0, 10))
const doseNumber = ref<number | null>(1)
const totalDoses = ref<number | null>(3)
const nextDueDays = ref<number | null>(30)
const id = ref(ulid())

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

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
}

function newQr() {
  id.value = ulid()
  name.value = ''
  performedOn.value = new Date().toISOString().slice(0, 10)
  doseNumber.value = 1
  totalDoses.value = 3
  nextDueDays.value = 30
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
        <div class="eyebrow">Staff console · dispatch</div>
      </div>
      <div class="flex items-center gap-5">
        <div class="folio">session · {{ id.slice(0, 8) }}</div>
        <button class="btn-ghost !py-1.5 !px-3 text-xs" @click="logout">lock console</button>
      </div>
    </header>

    <div class="max-w-[1200px] mx-auto px-6 lg:px-10 py-10 grid lg:grid-cols-[1fr_1fr] gap-10 print:block">
      <!-- LEFT: form -->
      <section class="space-y-8 print:hidden">
        <div class="space-y-2 anim-rise">
          <div class="eyebrow"><span class="tick" style="background: var(--color-staff-accent)"></span>Compose</div>
          <h1 class="font-display text-4xl md:text-5xl leading-[0.95]" style="color: var(--color-staff-ink)">
            New <span class="font-display-wonk" style="color: var(--color-staff-accent)">QR</span>.
          </h1>
          <p class="text-sm" style="color: var(--color-staff-muted)">Issue one code per patient visit.</p>
        </div>

        <form class="space-y-7 anim-rise-2">
          <!-- Kind toggle -->
          <div>
            <span class="field-label">Kind of record</span>
            <div class="grid grid-cols-2 gap-0 hairline mt-1">
              <label class="px-4 py-3 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                :style="kind === 'v' ? 'background: var(--color-staff-accent); color: var(--color-staff-paper);' : ''">
                <input type="radio" value="v" v-model="kind" class="sr-only" />
                <span class="font-display text-lg">Vaccination</span>
              </label>
              <label class="px-4 py-3 flex items-center justify-center gap-2 cursor-pointer transition-colors border-l hairline"
                :style="kind === 'b' ? 'background: var(--color-staff-accent); color: var(--color-staff-paper);' : ''">
                <input type="radio" value="b" v-model="kind" class="sr-only" />
                <span class="font-display text-lg">Blood test</span>
              </label>
            </div>
          </div>

          <label class="block">
            <span class="field-label">Name</span>
            <input v-model="name" list="names" class="field font-display text-2xl" placeholder="e.g. Hepatitis B" />
            <datalist id="names">
              <option v-for="n in suggestions" :key="n" :value="n" />
            </datalist>
          </label>

          <div class="grid grid-cols-[1fr_1fr_1fr] gap-4">
            <label class="block">
              <span class="field-label">Given on</span>
              <input v-model="performedOn" type="date" class="field tabular-nums" />
            </label>
            <label v-if="kind === 'v'" class="block">
              <span class="field-label">Dose №</span>
              <input v-model.number="doseNumber" type="number" min="1" class="field tabular-nums text-2xl font-display" />
            </label>
            <label v-if="kind === 'v'" class="block">
              <span class="field-label">Of</span>
              <input v-model.number="totalDoses" type="number" min="1" class="field tabular-nums text-2xl font-display" />
            </label>
            <label v-if="kind === 'b'" class="block col-span-2">
              <span class="field-label">Next due (days)</span>
              <input v-model.number="nextDueDays" type="number" min="0" class="field tabular-nums text-2xl font-display" />
            </label>
          </div>

          <label v-if="kind === 'v'" class="block">
            <span class="field-label">Next dose in (days)</span>
            <input v-model.number="nextDueDays" type="number" min="0" class="field tabular-nums" />
          </label>

          <div class="flex gap-3 pt-4 hairline-t">
            <button type="button" class="btn-primary flex-1" @click="printPage">
              Print <span aria-hidden>↗</span>
            </button>
            <button type="button" class="btn-ghost" @click="newQr">New · next patient</button>
          </div>
        </form>
      </section>

      <!-- RIGHT: preview + print surface -->
      <section class="space-y-6">
        <div class="eyebrow print:hidden"><span class="tick" style="background: var(--color-staff-accent)"></span>Preview</div>

        <div class="paper-card p-8 md:p-12 print:shadow-none print:border-0 print:p-0 anim-rise-3 print:bg-white print:text-black">
          <!-- PRINT HEADER -->
          <div class="flex items-start justify-between pb-4 mb-6 hairline-b print:border-black/20">
            <div>
              <div class="eyebrow print:text-black" style="color: var(--color-staff-muted)">Poliklinik Ng · Patient record</div>
              <div class="folio mt-1">ref {{ id.slice(0, 10) }}</div>
            </div>
            <div class="folio text-right">
              {{ kind === 'v' ? 'Rx' : 'Lab' }} / v1<br/>
              {{ new Date().toLocaleDateString('en-GB') }}
            </div>
          </div>

          <!-- QR -->
          <div class="flex justify-center mb-6">
            <div class="p-4 bg-white border hairline">
              <QrPreview v-if="qrUrl" :text="qrUrl" />
              <div v-else class="w-[280px] h-[280px] grid place-items-center font-display-wonk text-muted-app">
                awaiting entry
              </div>
            </div>
          </div>

          <!-- SUMMARY -->
          <div v-if="payload" class="space-y-4">
            <h2 class="font-display text-3xl md:text-4xl leading-[0.95] text-center print:text-black" style="color: var(--color-staff-ink)">
              {{ payload.n }}
            </h2>
            <dl class="grid grid-cols-3 gap-3 hairline-t hairline-b py-4 text-center">
              <div>
                <dt class="eyebrow">Kind</dt>
                <dd class="font-display text-lg mt-1">{{ kind === 'v' ? 'Vaccine' : 'Blood test' }}</dd>
              </div>
              <div v-if="kind === 'v' && payload.dn && payload.td" class="border-x hairline">
                <dt class="eyebrow">Series</dt>
                <dd class="font-display text-lg mt-1 tabular-nums">{{ payload.dn }} of {{ payload.td }}</dd>
              </div>
              <div v-else-if="payload.nd" class="border-x hairline">
                <dt class="eyebrow">Next test</dt>
                <dd class="font-display text-lg mt-1 tabular-nums">in {{ payload.nd }}d</dd>
              </div>
              <div>
                <dt class="eyebrow">Given</dt>
                <dd class="font-display text-lg mt-1 tabular-nums">{{ formatDate(payload.d) }}</dd>
              </div>
            </dl>
            <p v-if="kind === 'v' && payload.nd" class="text-center text-sm font-display-wonk italic" style="color: var(--color-staff-muted)">
              Next dose due in {{ payload.nd }} days.
            </p>
          </div>

          <!-- Patient instruction -->
          <div class="mt-6 pt-4 hairline-t text-center">
            <p class="font-display-wonk text-lg leading-snug" style="color: var(--color-staff-muted)">
              Scan with your phone's camera to add this to your records.
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
