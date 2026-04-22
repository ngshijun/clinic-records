<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useRecordsStore, type Record } from '@/stores/records'
import { useProfilesStore } from '@/stores/profiles'
import { supabase } from '@/lib/supabase'
import { useDialog } from '@/lib/dialog'
import { MY_TIMEZONE, dateFmtLocale, formatDateLong } from '@/lib/dates'

const route = useRoute()
const router = useRouter()
const records = useRecordsStore()
const profiles = useProfilesStore()
const { t, locale } = useI18n()
const dialog = useDialog()

const rec = ref<Record | null>(null)
const editing = ref(false)
const form = ref<Partial<Record>>({})
const showMove = ref(false)

onMounted(async () => {
  const { data, error } = await supabase.from('records').select('*').eq('id', route.params.id).single()
  if (error) { await dialog.alert({ title: error.message }); router.push('/home'); return }
  rec.value = data
  form.value = { ...data }
  await profiles.fetchAll()
})

async function save() {
  if (!rec.value) return
  const { name, performed_on, dose_number, total_doses, notes } = form.value
  const patch: Partial<Record> = { name: name!, performed_on: performed_on!, notes: notes ?? null }
  if (rec.value.kind === 'vaccination') {
    patch.dose_number = dose_number ?? null
    patch.total_doses = total_doses ?? null
  }
  rec.value = await records.updateRecord(rec.value.id, patch)
  editing.value = false
}

async function moveToProfile(profile_id: string) {
  if (!rec.value) return
  rec.value = await records.updateRecord(rec.value.id, { profile_id })
  router.push('/home')
}

async function del() {
  if (!rec.value) return
  const ok = await dialog.confirm({
    title: t('recordDetail.confirmDelete'),
    confirmLabel: t('common.delete'),
  })
  if (!ok) return
  await records.deleteRecord(rec.value.id)
  router.push('/home')
}

const formattedDate = computed(() => rec.value ? formatDateLong(rec.value.performed_on, locale.value) : '')
const profileName = computed(() => profiles.profiles.find(p => p.id === rec.value?.profile_id)?.name ?? '')
const kindLabel = computed(() => rec.value?.kind === 'vaccination' ? t('recordDetail.vaccinationLabel') : t('recordDetail.bloodTestLabel'))
const filedDate = computed(() => rec.value
  ? new Date(rec.value.created_at).toLocaleDateString(dateFmtLocale(locale.value), { timeZone: MY_TIMEZONE })
  : ''
)
</script>

<template>
  <main v-if="rec" class="min-h-dvh pb-20">
    <header class="max-w-[720px] w-full mx-auto px-6 pt-8">
      <router-link to="/home" class="folio underline underline-offset-4 decoration-[var(--color-rule)]">{{ $t('common.backToLedger') }}</router-link>
    </header>

    <section class="max-w-[720px] w-full mx-auto px-6 pt-10">
      <article class="paper-card relative overflow-hidden p-8 md:p-12 anim-rise">
        <div v-if="!editing" class="space-y-8">
          <div class="space-y-2">
            <div class="eyebrow">{{ kindLabel }}</div>
            <h1 class="font-display text-5xl md:text-6xl leading-[0.9]">{{ rec.name }}</h1>
            <p v-if="profileName" class="font-display-wonk text-muted-app text-lg">{{ $t('recordDetail.forPerson', { name: profileName }) }}</p>
          </div>

          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-6 hairline-t hairline-b py-6">
            <div>
              <dt class="eyebrow">{{ $t('recordDetail.administered') }}</dt>
              <dd class="font-display text-2xl mt-1">{{ formattedDate }}</dd>
            </div>
            <div v-if="rec.kind === 'vaccination' && rec.dose_number && rec.total_doses">
              <dt class="eyebrow">{{ $t('recordDetail.seriesPosition') }}</dt>
              <dd class="font-display text-2xl mt-1 tabular-nums">
                {{ rec.dose_number }}<span class="text-muted-app"> / </span>{{ rec.total_doses }}
              </dd>
            </div>
          </dl>

          <div v-if="rec.notes">
            <div class="eyebrow mb-2">{{ $t('recordDetail.note') }}</div>
            <p class="font-display-wonk text-xl leading-snug text-ink-2">{{ rec.notes }}</p>
          </div>

          <div class="flex flex-wrap items-center gap-3 pt-4 hairline-t">
            <button class="btn-ghost" @click="editing = true">{{ $t('recordDetail.editEntry') }}</button>
            <button class="btn-ghost" @click="showMove = !showMove">{{ $t('recordDetail.reassignProfile') }}</button>
            <button class="btn-danger ml-auto" @click="del">{{ $t('recordDetail.strikeFromLedger') }}</button>
          </div>

          <div v-if="showMove" class="paper-card p-4 bg-paper-2">
            <div class="eyebrow mb-3">{{ $t('recordDetail.moveToAnotherProfile') }}</div>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="p in profiles.profiles.filter(p => p.id !== rec!.profile_id)"
                :key="p.id"
                @click="moveToProfile(p.id)"
                class="btn-ghost text-sm"
              >{{ p.name }} →</button>
              <button class="btn-danger text-sm" @click="showMove = false">{{ $t('common.cancel') }}</button>
            </div>
          </div>
        </div>

        <form v-else class="space-y-6 pt-4" @submit.prevent="save">
          <div class="eyebrow">{{ $t('recordDetail.amending', { kind: kindLabel }) }}</div>
          <label class="block">
            <span class="field-label">{{ $t('recordDetail.name') }}</span>
            <input v-model="form.name" class="field font-display text-2xl" />
          </label>
          <label class="block">
            <span class="field-label">{{ $t('recordDetail.performedOn') }}</span>
            <input v-model="form.performed_on" type="date" class="field" />
          </label>
          <div v-if="rec.kind === 'vaccination'" class="grid grid-cols-2 gap-4">
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
            <textarea v-model="form.notes" rows="3" class="field font-display-wonk text-lg resize-none" :placeholder="$t('recordDetail.notePlaceholder')"></textarea>
          </label>
          <div class="flex gap-3 pt-2">
            <button class="btn-primary">{{ $t('recordDetail.saveAmendment') }}</button>
            <button type="button" class="btn-ghost" @click="editing = false">{{ $t('recordDetail.discard') }}</button>
          </div>
        </form>
      </article>

      <footer class="flex items-center justify-between pt-6 text-xs">
        <div class="folio">{{ $t('recordDetail.filed', { date: filedDate }) }}</div>
      </footer>
    </section>
  </main>

  <main v-else class="min-h-dvh grid place-items-center">
    <div class="font-display-wonk text-muted-app text-xl">{{ $t('recordDetail.retrieving') }}</div>
  </main>
</template>
