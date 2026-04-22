<script setup lang="ts">
import type { Template } from '@/lib/templates'
import { useI18n } from 'vue-i18n'

defineProps<{ tpl: Template }>()
defineEmits<{ (e: 'apply', tpl: Template): void; (e: 'remove', tpl: Template): void }>()

const { t } = useI18n()
</script>

<template>
  <div class="group relative hairline min-h-[140px] flex cursor-grab active:cursor-grabbing">
    <button
      type="button"
      class="flex-1 p-6 text-left flex flex-col justify-between transition-colors hover:bg-white/[0.03]"
      @click="$emit('apply', tpl)"
    >
      <div>
        <div class="font-display text-xl leading-tight mb-2" style="color: var(--color-staff-ink)">
          {{ tpl.name }}
        </div>
        <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs" style="color: var(--color-staff-muted)">
          <span v-if="tpl.kind === 'v' && tpl.dose_number && tpl.total_doses" class="tabular-nums">
            {{ t('staff.seriesOf', { n: tpl.dose_number, total: tpl.total_doses }) }}
          </span>
          <span v-if="tpl.next_due_days" class="tabular-nums">
            {{ t('staff.inDays', { n: tpl.next_due_days }) }}
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
      @click.stop="$emit('remove', tpl)"
    >×</button>
  </div>
</template>
