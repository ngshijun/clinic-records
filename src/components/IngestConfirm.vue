<script setup lang="ts">
import type { QrPayload } from '@/lib/qr-payload'
import { computed } from 'vue'

const props = defineProps<{ payload: QrPayload }>()
const emit = defineEmits<{ (e: 'confirm'): void; (e: 'cancel'): void }>()

const kindLabel = computed(() => props.payload.k === 'v' ? 'Vaccination' : 'Blood test')
const doseLine = computed(() => {
  if (props.payload.k !== 'v' || !props.payload.dn || !props.payload.td) return null
  return `Dose ${props.payload.dn} of ${props.payload.td}`
})
const reminderLine = computed(() => {
  if (!props.payload.nd) return null
  const due = new Date(props.payload.d)
  due.setDate(due.getDate() + props.payload.nd)
  return `We'll remind you around ${due.toLocaleDateString()} for the next ${props.payload.k === 'v' ? 'dose' : 'test'}.`
})
</script>

<template>
  <section class="space-y-4">
    <h2 class="text-lg font-semibold">Add this record?</h2>
    <div class="border rounded p-4 space-y-1">
      <div><span class="text-gray-500">{{ kindLabel }}:</span> <span class="font-medium">{{ payload.n }}</span></div>
      <div v-if="doseLine" class="text-sm">{{ doseLine }}</div>
      <div class="text-sm">Given {{ new Date(payload.d).toLocaleDateString() }}</div>
      <p v-if="reminderLine" class="text-sm text-gray-600 pt-2">{{ reminderLine }}</p>
    </div>
    <div class="flex gap-3">
      <button class="bg-black text-white rounded px-4 py-2" @click="emit('confirm')">Add</button>
      <button class="border rounded px-4 py-2" @click="emit('cancel')">Cancel</button>
    </div>
  </section>
</template>
