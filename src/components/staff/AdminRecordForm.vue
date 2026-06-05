<script setup lang="ts">
import { reactive } from 'vue'
import type { Record as ClinicRecord } from '@/stores/records'
import type { AdminRecordInput } from '@/lib/admin'
import { todayLocalIso } from '@/lib/dates'

const props = defineProps<{ record?: ClinicRecord | null }>()
const emit = defineEmits<{
  (e: 'submit', value: AdminRecordInput): void
  (e: 'cancel'): void
}>()

const isEdit = !!props.record
const form = reactive<AdminRecordInput>({
  kind: props.record?.kind ?? 'vaccination',
  name: props.record?.name ?? '',
  performed_on: props.record?.performed_on ?? todayLocalIso(),
  dose_number: props.record?.dose_number ?? null,
  total_doses: props.record?.total_doses ?? null,
  notes: props.record?.notes ?? null,
})

function submit() {
  if (!form.name.trim()) return
  emit('submit', { ...form })
}
</script>

<template>
  <form class="space-y-4 paper-card p-5" @submit.prevent="submit">
    <div class="eyebrow">{{ isEdit ? $t('admin.editRecordTitle') : $t('admin.addRecordTitle') }}</div>

    <div v-if="!isEdit" class="flex gap-2">
      <button type="button" class="btn-ghost text-sm" :style="form.kind === 'vaccination' ? 'border-color: var(--color-staff-accent); color: var(--color-staff-accent)' : ''" @click="form.kind = 'vaccination'">{{ $t('home.kindVaccination') }}</button>
      <button type="button" class="btn-ghost text-sm" :style="form.kind === 'blood_test' ? 'border-color: var(--color-staff-accent); color: var(--color-staff-accent)' : ''" @click="form.kind = 'blood_test'">{{ $t('home.kindBloodTest') }}</button>
    </div>

    <label class="block">
      <span class="field-label">{{ $t('recordDetail.name') }}</span>
      <input v-model="form.name" class="field" />
    </label>
    <label class="block">
      <span class="field-label">{{ $t('recordDetail.performedOn') }}</span>
      <input v-model="form.performed_on" type="date" class="field" />
    </label>
    <div v-if="form.kind === 'vaccination'" class="grid grid-cols-2 gap-3">
      <label class="block">
        <span class="field-label">{{ $t('recordDetail.doseNumber') }}</span>
        <input v-model.number="form.dose_number" type="number" min="1" class="field tabular-nums" />
      </label>
      <label class="block">
        <span class="field-label">{{ $t('recordDetail.of') }}</span>
        <input v-model.number="form.total_doses" type="number" min="1" class="field tabular-nums" />
      </label>
    </div>
    <label class="block">
      <span class="field-label">{{ $t('recordDetail.note') }}</span>
      <textarea v-model="form.notes" rows="2" class="field resize-none" :placeholder="$t('recordDetail.notePlaceholder')"></textarea>
    </label>

    <div class="flex gap-2 pt-1">
      <button class="btn-primary" :disabled="!form.name.trim()">{{ $t('common.save') }}</button>
      <button type="button" class="btn-ghost" @click="emit('cancel')">{{ $t('common.cancel') }}</button>
    </div>
  </form>
</template>
