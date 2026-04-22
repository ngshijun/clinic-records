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

const summary = computed(() => {
  if (!payload.value) return ''
  const bits = [kind.value === 'v' ? 'Vaccination' : 'Blood test', payload.value.n]
  if (kind.value === 'v' && payload.value.dn && payload.value.td) bits.push(`Dose ${payload.value.dn} of ${payload.value.td}`)
  bits.push(new Date(payload.value.d).toLocaleDateString())
  if (payload.value.nd) bits.push(`Next due in ${payload.value.nd}d`)
  return bits.join(' · ')
})

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
  <main class="max-w-4xl mx-auto p-4 space-y-6">
    <header class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">QR generator</h1>
      <button class="text-sm underline" @click="logout">Log out</button>
    </header>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <form class="space-y-3">
        <label class="block">
          <span class="text-sm text-gray-600">Kind</span>
          <div class="flex gap-4 mt-1">
            <label><input type="radio" value="v" v-model="kind" /> Vaccination</label>
            <label><input type="radio" value="b" v-model="kind" /> Blood test</label>
          </div>
        </label>
        <label class="block">
          <span class="text-sm text-gray-600">Name</span>
          <input v-model="name" list="names" class="w-full border rounded px-3 py-2" />
          <datalist id="names">
            <option v-for="n in suggestions" :key="n" :value="n" />
          </datalist>
        </label>
        <label class="block">
          <span class="text-sm text-gray-600">Date given</span>
          <input v-model="performedOn" type="date" class="w-full border rounded px-3 py-2" />
        </label>
        <template v-if="kind === 'v'">
          <div class="grid grid-cols-2 gap-2">
            <label class="block">
              <span class="text-sm text-gray-600">Dose number</span>
              <input v-model.number="doseNumber" type="number" min="1" class="w-full border rounded px-3 py-2" />
            </label>
            <label class="block">
              <span class="text-sm text-gray-600">Of</span>
              <input v-model.number="totalDoses" type="number" min="1" class="w-full border rounded px-3 py-2" />
            </label>
          </div>
        </template>
        <label class="block">
          <span class="text-sm text-gray-600">Next due (days, optional)</span>
          <input v-model.number="nextDueDays" type="number" min="0" class="w-full border rounded px-3 py-2" />
        </label>
        <div class="flex gap-2">
          <button type="button" class="border rounded px-4 py-2" @click="newQr">New QR</button>
          <button type="button" class="bg-black text-white rounded px-4 py-2" @click="printPage">Print</button>
        </div>
      </form>

      <div class="flex flex-col items-center gap-3">
        <QrPreview v-if="qrUrl" :text="qrUrl" />
        <p v-if="summary" class="text-center text-sm max-w-xs">{{ summary }}</p>
        <p class="text-xs text-gray-400 break-all">{{ qrUrl }}</p>
      </div>
    </div>
  </main>
</template>
