<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import StaffNav from '@/components/staff/StaffNav.vue'
import AdminRecordForm from '@/components/staff/AdminRecordForm.vue'
import AdminReminderForm from '@/components/staff/AdminReminderForm.vue'
import {
  fetchPatientBundle,
  adminCreateRecord,
  adminCreateReminder,
  adminUpdateReminder,
  adminSetAllergies,
  type AdminRecordInput,
  type AdminReminderInput,
} from '@/lib/admin'
import { useRecordsStore, type Record as ClinicRecord, type Reminder } from '@/stores/records'
import type { Profile } from '@/stores/profiles'
import { reminderTitle } from '@/lib/reminders'
import { formatDateShort, formatDateLong } from '@/lib/dates'
import { useDialog } from '@/lib/dialog'

const route = useRoute()
const { t, locale } = useI18n()
const dialog = useDialog()
const recordsStore = useRecordsStore()

const profile = ref<Profile | null>(null)
const records = ref<ClinicRecord[]>([])
const reminders = ref<Reminder[]>([])
const loading = ref(true)

// UI state for the inline forms.
const recordForm = ref<{ open: boolean; editing: ClinicRecord | null }>({ open: false, editing: null })
const reminderForm = ref<{ open: boolean; editing: Reminder | null }>({ open: false, editing: null })
const editingAllergies = ref(false)
const allergiesDraft = ref('')

const profileId = computed(() => route.params.profileId as string)

async function load() {
  loading.value = true
  try {
    const bundle = await fetchPatientBundle(profileId.value)
    profile.value = bundle.profile
    records.value = bundle.records
    reminders.value = bundle.reminders
  } catch (e) {
    await dialog.alertError(e, t('common.error'))
  } finally {
    loading.value = false
  }
}
onMounted(load)

function dob(): string {
  return profile.value?.date_of_birth ? formatDateLong(profile.value.date_of_birth, locale.value) : '—'
}

// --- Records ---
function openAddRecord() { recordForm.value = { open: true, editing: null } }
function openEditRecord(r: ClinicRecord) { recordForm.value = { open: true, editing: r } }
function closeRecordForm() { recordForm.value = { open: false, editing: null } }

async function submitRecord(input: AdminRecordInput) {
  try {
    if (recordForm.value.editing) {
      await recordsStore.updateRecord(recordForm.value.editing.id, {
        name: input.name,
        performed_on: input.performed_on,
        dose_number: input.kind === 'vaccination' ? input.dose_number : null,
        total_doses: input.kind === 'vaccination' ? input.total_doses : null,
        notes: input.notes,
      })
    } else {
      if (!profile.value) return
      await adminCreateRecord(profile.value.user_id, profileId.value, input)
    }
    closeRecordForm()
    await load()
  } catch (e) {
    await dialog.alertError(e, t('common.error'))
  }
}

async function deleteRecord(r: ClinicRecord) {
  const ok = await dialog.confirm({ title: t('admin.confirmDeleteRecord'), confirmLabel: t('common.delete'), variant: 'danger' })
  if (!ok) return
  try {
    await recordsStore.deleteRecord(r.id)
    await load()
  } catch (e) {
    await dialog.alertError(e, t('common.error'))
  }
}

// --- Reminders ---
function openAddReminder() { reminderForm.value = { open: true, editing: null } }
function openEditReminder(r: Reminder) { reminderForm.value = { open: true, editing: r } }
function closeReminderForm() { reminderForm.value = { open: false, editing: null } }

async function submitReminder(input: AdminReminderInput) {
  try {
    if (reminderForm.value.editing) {
      await adminUpdateReminder(reminderForm.value.editing.id, { name: input.name, due_at: input.due_at })
    } else {
      if (!profile.value) return
      await adminCreateReminder(profile.value.user_id, profileId.value, input)
    }
    closeReminderForm()
    await load()
  } catch (e) {
    await dialog.alertError(e, t('common.error'))
  }
}

async function deleteReminder(r: Reminder) {
  const ok = await dialog.confirm({ title: t('admin.confirmDeleteReminder'), confirmLabel: t('common.delete'), variant: 'danger' })
  if (!ok) return
  try {
    await recordsStore.deleteReminder(r.id)
    await load()
  } catch (e) {
    await dialog.alertError(e, t('common.error'))
  }
}

function titleFor(r: Reminder): string {
  return reminderTitle(r, records.value.find((x) => x.id === r.record_id), t)
}

// --- Allergies ---
function startEditAllergies() {
  allergiesDraft.value = profile.value?.allergies ?? ''
  editingAllergies.value = true
}
async function saveAllergies() {
  try {
    await adminSetAllergies(profileId.value, allergiesDraft.value)
    editingAllergies.value = false
    await load()
  } catch (e) {
    await dialog.alertError(e, t('common.error'))
  }
}
</script>

<template>
  <main class="min-h-dvh pb-20">
    <div class="max-w-[860px] mx-auto px-6 lg:px-10 pt-6">
      <StaffNav />
      <router-link to="/staff/patients" class="folio underline underline-offset-4">{{ $t('admin.backToPatients') }}</router-link>

      <div v-if="loading" class="mt-10 text-[var(--color-staff-muted)] font-display-wonk text-xl">{{ $t('recordDetail.retrieving') }}</div>

      <template v-else-if="profile">
        <!-- Identity (read-only) -->
        <header class="mt-4 mb-8">
          <h1 class="font-display text-5xl leading-tight">{{ profile.name }}</h1>
          <div class="text-xs text-[var(--color-staff-muted)] mt-2">
            <span>{{ $t('admin.nricLabel') }}: {{ profile.nric ?? '—' }}</span>
            <span class="mx-2">·</span>
            <span>{{ $t('admin.dobLabel') }}: {{ dob() }}</span>
            <span class="mx-2">·</span>
            <span>{{ profile.nationality }}</span>
          </div>
        </header>

        <!-- Allergies (editable) -->
        <section class="mb-10 paper-card p-5">
          <div class="flex items-center justify-between">
            <div class="eyebrow" style="color: var(--color-staff-accent)">{{ $t('admin.allergiesTitle') }}</div>
            <button v-if="!editingAllergies" class="btn-ghost !py-1 !px-3 text-xs" @click="startEditAllergies">{{ $t('admin.editAllergies') }}</button>
          </div>
          <template v-if="!editingAllergies">
            <p v-if="profile.allergies === null" class="text-sm text-[var(--color-staff-muted)] mt-2">{{ $t('admin.noAllergyRecord') }}</p>
            <p v-else-if="profile.allergies.trim() === ''" class="font-display-wonk text-base text-[var(--color-staff-muted)] mt-2">{{ $t('admin.noKnownAllergies') }}</p>
            <p v-else class="font-display-wonk text-lg leading-snug whitespace-pre-line mt-2">{{ profile.allergies }}</p>
          </template>
          <div v-else class="mt-3 space-y-3">
            <textarea v-model="allergiesDraft" rows="3" class="field resize-none" :placeholder="$t('admin.allergyPlaceholder')"></textarea>
            <div class="flex gap-2">
              <button class="btn-primary" @click="saveAllergies">{{ $t('common.save') }}</button>
              <button class="btn-ghost" @click="editingAllergies = false">{{ $t('common.cancel') }}</button>
            </div>
          </div>
        </section>

        <!-- Records -->
        <section class="mb-10">
          <div class="flex items-center justify-between mb-3">
            <h2 class="font-display text-2xl">{{ $t('admin.recordsTitle') }}</h2>
            <button v-if="!recordForm.open" class="btn-ghost !py-1 !px-3 text-xs" @click="openAddRecord">{{ $t('admin.addRecord') }}</button>
          </div>

          <AdminRecordForm
            v-if="recordForm.open && !recordForm.editing"
            class="mb-4"
            @submit="submitRecord"
            @cancel="closeRecordForm"
          />

          <p v-if="records.length === 0 && !recordForm.open" class="text-sm text-[var(--color-staff-muted)]">{{ $t('admin.noRecords') }}</p>

          <ul class="space-y-2">
            <li v-for="r in records" :key="r.id">
              <AdminRecordForm
                v-if="recordForm.open && recordForm.editing?.id === r.id"
                :record="r"
                @submit="submitRecord"
                @cancel="closeRecordForm"
              />
              <div v-else class="paper-card p-4 flex items-center justify-between gap-3">
                <div>
                  <div class="font-display text-lg leading-tight">{{ r.name }}</div>
                  <div class="text-xs text-[var(--color-staff-muted)] mt-0.5">
                    {{ formatDateShort(r.performed_on, locale) }}
                    <span class="mx-1">·</span>
                    <span>{{ r.kind === 'vaccination' ? $t('home.kindVaccination') : $t('home.kindBloodTest') }}</span>
                  </div>
                </div>
                <div class="flex gap-2 text-xs shrink-0">
                  <button class="btn-ghost !py-1 !px-3" @click="openEditRecord(r)">{{ $t('admin.editAllergies') }}</button>
                  <button class="btn-danger !py-1 !px-3" @click="deleteRecord(r)">{{ $t('common.delete') }}</button>
                </div>
              </div>
            </li>
          </ul>
        </section>

        <!-- Reminders -->
        <section>
          <div class="flex items-center justify-between mb-3">
            <h2 class="font-display text-2xl">{{ $t('admin.remindersTitle') }}</h2>
            <button v-if="!reminderForm.open" class="btn-ghost !py-1 !px-3 text-xs" @click="openAddReminder">{{ $t('admin.addReminder') }}</button>
          </div>

          <AdminReminderForm
            v-if="reminderForm.open && !reminderForm.editing"
            class="mb-4"
            @submit="submitReminder"
            @cancel="closeReminderForm"
          />

          <p v-if="reminders.length === 0 && !reminderForm.open" class="text-sm text-[var(--color-staff-muted)]">{{ $t('admin.noReminders') }}</p>

          <ul class="space-y-2">
            <li v-for="r in reminders" :key="r.id">
              <AdminReminderForm
                v-if="reminderForm.open && reminderForm.editing?.id === r.id"
                :reminder="r"
                @submit="submitReminder"
                @cancel="closeReminderForm"
              />
              <div v-else class="paper-card p-4 flex items-center justify-between gap-3">
                <div>
                  <div class="font-display text-lg leading-tight">{{ titleFor(r) }}</div>
                  <div class="text-xs text-[var(--color-staff-muted)] mt-0.5">{{ formatDateShort(r.due_at, locale) }}</div>
                </div>
                <div class="flex gap-2 text-xs shrink-0">
                  <button class="btn-ghost !py-1 !px-3" @click="openEditReminder(r)">{{ $t('admin.editAllergies') }}</button>
                  <button class="btn-danger !py-1 !px-3" @click="deleteReminder(r)">{{ $t('common.delete') }}</button>
                </div>
              </div>
            </li>
          </ul>
        </section>
      </template>
    </div>
  </main>
</template>
