<script setup lang="ts">
import type { QrDueUnit } from '@/lib/qr-payload'

defineProps<{ modelValue: QrDueUnit }>()
defineEmits<{ (e: 'update:modelValue', value: QrDueUnit): void }>()

const UNITS: { value: QrDueUnit; key: string }[] = [
  { value: 'd', key: 'staff.unitDayShort' },
  { value: 'w', key: 'staff.unitWeekShort' },
  { value: 'mo', key: 'staff.unitMonthShort' },
  { value: 'y', key: 'staff.unitYearShort' },
]
</script>

<template>
  <div class="grid grid-cols-4 gap-0 hairline" role="radiogroup">
    <label
      v-for="(u, i) in UNITS"
      :key="u.value"
      class="px-2 py-3 flex items-center justify-center cursor-pointer transition-colors text-sm font-display tabular-nums"
      :class="{ 'border-l hairline': i !== 0 }"
      :style="modelValue === u.value ? 'background: var(--color-staff-accent); color: var(--color-staff-paper);' : ''"
    >
      <input
        type="radio"
        :value="u.value"
        :checked="modelValue === u.value"
        @change="$emit('update:modelValue', u.value)"
        class="sr-only"
      />
      <span>{{ $t(u.key) }}</span>
    </label>
  </div>
</template>
