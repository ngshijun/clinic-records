<script setup lang="ts">
import { reactive } from 'vue'
import type { Reminder } from '@/stores/records'
import type { AdminReminderInput } from '@/lib/admin'
import { todayLocalIso, dateInMY, computeDueAt } from '@/lib/dates'

const props = defineProps<{ reminder?: Reminder | null }>()
const emit = defineEmits<{
  (e: 'submit', value: AdminReminderInput): void
  (e: 'cancel'): void
}>()

const isEdit = !!props.reminder
// The form edits a plain date; convert to a due_at timestamp on submit.
const form = reactive<{ kind: AdminReminderInput['kind']; name: string; date: string }>({
  kind: props.reminder?.kind ?? 'next_dose',
  name: props.reminder?.name ?? '',
  date: props.reminder ? dateInMY(props.reminder.due_at) : todayLocalIso(),
})

const kinds: AdminReminderInput['kind'][] = ['next_dose', 'followup_test', 'other']
function kindKey(k: AdminReminderInput['kind']): string {
  if (k === 'next_dose') return 'home.kindNextDose'
  if (k === 'followup_test') return 'home.kindFollowupTest'
  return 'admin.kindOther'
}

function submit() {
  if (!form.date) return
  emit('submit', {
    kind: form.kind,
    name: form.name.trim() || null,
    // computeDueAt(date, 0, 'd') == 08:00 MY (== 00:00 UTC) on that date,
    // matching how QR-derived reminders are scheduled.
    due_at: computeDueAt(form.date, 0, 'd'),
  })
}
</script>

<template>
  <form class="space-y-4 paper-card p-5" @submit.prevent="submit">
    <div class="eyebrow">{{ isEdit ? $t('admin.editReminderTitle') : $t('admin.addReminderTitle') }}</div>

    <label class="block">
      <span class="field-label">{{ $t('admin.reminderKind') }}</span>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="k in kinds" :key="k" type="button"
          class="btn-ghost text-sm"
          :style="form.kind === k ? 'border-color: var(--color-staff-accent); color: var(--color-staff-accent)' : ''"
          @click="form.kind = k"
        >{{ $t(kindKey(k)) }}</button>
      </div>
    </label>
    <label class="block">
      <span class="field-label">{{ $t('admin.reminderName') }}</span>
      <input v-model="form.name" class="field" />
    </label>
    <label class="block">
      <span class="field-label">{{ $t('admin.dueDate') }}</span>
      <input v-model="form.date" type="date" class="field" />
    </label>

    <div class="flex gap-2 pt-1">
      <button class="btn-primary" :disabled="!form.date">{{ $t('common.save') }}</button>
      <button type="button" class="btn-ghost" @click="emit('cancel')">{{ $t('common.cancel') }}</button>
    </div>
  </form>
</template>
