<script setup lang="ts">
import type { Template } from '@/lib/templates'
import { useI18n } from 'vue-i18n'

defineProps<{ tpl: Template }>()
defineEmits<{ (e: 'apply', tpl: Template): void; (e: 'remove', tpl: Template): void }>()

const { t } = useI18n()
</script>

<template>
  <div class="group relative hairline flex cursor-grab active:cursor-grabbing">
    <button
      type="button"
      class="flex-1 p-4 text-left transition-colors hover:bg-white/[0.03]"
      @click="$emit('apply', tpl)"
    >
      <div class="eyebrow mb-1.5" style="color: var(--color-staff-muted)">
        <span v-if="tpl.reminder_only">{{ t('staff.reminder') }}</span>
        <span v-else-if="tpl.next_due_days">{{ t('staff.tagRecordReminder') }}</span>
        <span v-else>{{ t('staff.tagRecord') }}</span>
      </div>
      <div class="font-display text-lg leading-tight mb-1" style="color: var(--color-staff-ink)">
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
    </button>
    <button
      type="button"
      class="px-3 border-l hairline opacity-40 hover:opacity-100 transition-opacity"
      :aria-label="'Delete ' + tpl.name"
      style="color: var(--color-staff-muted)"
      @click.stop="$emit('remove', tpl)"
    >×</button>
  </div>
</template>
