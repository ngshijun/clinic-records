<script setup lang="ts">
import type { Record } from '@/stores/records'

defineProps<{ existing: Record }>()
const emit = defineEmits<{
  (e: 'replace'): void
  (e: 'keep-both'): void
  (e: 'cancel'): void
}>()
</script>

<template>
  <div class="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
    <div class="bg-white rounded-lg max-w-sm w-full p-5 space-y-4">
      <h3 class="font-semibold">Similar record already exists</h3>
      <p class="text-sm text-gray-600">Added {{ new Date(existing.created_at).toLocaleString() }}:</p>
      <div class="border rounded p-3 text-sm">
        {{ existing.name }} · {{ existing.kind === 'vaccination' ? `Dose ${existing.dose_number} of ${existing.total_doses}` : 'Blood test' }} · {{ existing.performed_on }}
      </div>
      <div class="flex flex-col gap-2">
        <button class="bg-black text-white rounded py-2" @click="emit('replace')">Replace with new</button>
        <button class="border rounded py-2" @click="emit('keep-both')">Keep both</button>
        <button class="text-gray-600 py-2" @click="emit('cancel')">Cancel</button>
      </div>
    </div>
  </div>
</template>
