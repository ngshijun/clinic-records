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
  <div class="fixed inset-0 bg-[rgba(28,43,42,0.55)] backdrop-blur-sm flex items-center justify-center p-4 z-50 anim-rise">
    <div class="paper-card max-w-md w-full p-7 relative brackets">
      <span class="br-tr"></span><span class="br-bl"></span>

      <div class="flex items-start justify-between mb-4">
        <div class="eyebrow" style="color: var(--color-accent)">Duplicate warning</div>
        <div class="folio">§ 3.2</div>
      </div>

      <h3 class="font-display text-3xl leading-tight mb-3">
        A <span class="font-display-wonk">similar</span> entry already sits in your ledger.
      </h3>
      <p class="text-sm text-muted-app mb-5">
        Recorded {{ new Date(existing.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) }}.
      </p>

      <div class="hairline p-4 mb-6 bg-paper-2">
        <div class="eyebrow mb-1">Existing entry</div>
        <div class="font-display text-lg">{{ existing.name }}</div>
        <div class="text-xs text-muted-app mt-1">
          <span v-if="existing.kind === 'vaccination'">Dose {{ existing.dose_number }} of {{ existing.total_doses }}</span>
          <span v-else>Blood test</span>
          <span class="mx-2">·</span>
          <span>{{ existing.performed_on }}</span>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <button class="btn-primary" @click="emit('replace')">Replace with the new entry</button>
        <button class="btn-ghost" @click="emit('keep-both')">Keep both, side by side</button>
        <button class="btn-danger text-sm" @click="emit('cancel')">Cancel</button>
      </div>
    </div>
  </div>
</template>
