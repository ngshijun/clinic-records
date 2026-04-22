<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRecordsStore, type Record } from '@/stores/records'
import { useProfilesStore } from '@/stores/profiles'
import { supabase } from '@/lib/supabase'

const route = useRoute()
const router = useRouter()
const records = useRecordsStore()
const profiles = useProfilesStore()

const rec = ref<Record | null>(null)
const editing = ref(false)
const form = ref<Partial<Record>>({})
const showMove = ref(false)

onMounted(async () => {
  const { data, error } = await supabase.from('records').select('*').eq('id', route.params.id).single()
  if (error) { alert(error.message); router.push('/home'); return }
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
  if (!confirm('Delete this record?')) return
  await records.deleteRecord(rec.value.id)
  router.push('/home')
}

const formattedDate = computed(() => rec.value
  ? new Date(rec.value.performed_on).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  : ''
)
const profileName = computed(() => profiles.profiles.find(p => p.id === rec.value?.profile_id)?.name ?? '')
</script>

<template>
  <main v-if="rec" class="min-h-dvh pb-20">
    <header class="max-w-[720px] w-full mx-auto px-6 pt-8 flex items-center justify-between">
      <router-link to="/home" class="folio underline underline-offset-4 decoration-[var(--color-rule)]">← ledger</router-link>
      <div class="eyebrow">Record · {{ rec.id.slice(0, 8) }}</div>
    </header>

    <section class="max-w-[720px] w-full mx-auto px-6 pt-10">
      <article class="paper-card relative overflow-hidden p-8 md:p-12 anim-rise">
        <svg class="absolute top-4 left-4 w-8 h-8 text-[var(--color-rule)]" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1" aria-hidden>
          <circle cx="16" cy="16" r="15" />
          <circle cx="16" cy="16" r="10" />
          <path d="M16 2 v28 M2 16 h28" stroke-dasharray="2 3" />
        </svg>
        <div class="absolute top-5 right-6 folio">{{ rec.kind === 'vaccination' ? 'Rx' : 'Lab' }} · № {{ rec.id.slice(0,4) }}</div>

        <div aria-hidden class="absolute -right-4 -bottom-16 font-display text-[12rem] leading-none text-ink opacity-[0.04] select-none pointer-events-none">
          {{ rec.kind === 'vaccination' ? '℞' : 'Lab' }}
        </div>

        <div v-if="!editing" class="space-y-8">
          <div class="space-y-2 pt-8">
            <div class="eyebrow">{{ rec.kind === 'vaccination' ? 'Vaccination' : 'Blood test' }}</div>
            <h1 class="font-display text-5xl md:text-6xl leading-[0.9]">{{ rec.name }}</h1>
            <p v-if="profileName" class="font-display-wonk text-muted-app text-lg">for {{ profileName }}</p>
          </div>

          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-6 hairline-t hairline-b py-6">
            <div>
              <dt class="eyebrow">Administered</dt>
              <dd class="font-display text-2xl mt-1">{{ formattedDate }}</dd>
            </div>
            <div v-if="rec.kind === 'vaccination' && rec.dose_number && rec.total_doses">
              <dt class="eyebrow">Series position</dt>
              <dd class="font-display text-2xl mt-1 tabular-nums">
                {{ rec.dose_number }}<span class="text-muted-app"> of </span>{{ rec.total_doses }}
              </dd>
            </div>
          </dl>

          <div v-if="rec.notes">
            <div class="eyebrow mb-2">Note</div>
            <p class="font-display-wonk text-xl leading-snug text-ink-2">{{ rec.notes }}</p>
          </div>

          <div class="flex flex-wrap items-center gap-3 pt-4 hairline-t">
            <button class="btn-ghost" @click="editing = true">Edit entry</button>
            <button class="btn-ghost" @click="showMove = !showMove">Reassign profile</button>
            <button class="btn-danger ml-auto" @click="del">Strike from ledger</button>
          </div>

          <div v-if="showMove" class="paper-card p-4 bg-paper-2">
            <div class="eyebrow mb-3">Move to another profile</div>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="p in profiles.profiles.filter(p => p.id !== rec!.profile_id)"
                :key="p.id"
                @click="moveToProfile(p.id)"
                class="btn-ghost text-sm"
              >{{ p.name }} →</button>
              <button class="btn-danger text-sm" @click="showMove = false">cancel</button>
            </div>
          </div>
        </div>

        <form v-else class="space-y-6 pt-4" @submit.prevent="save">
          <div class="eyebrow">Amending · {{ rec.kind === 'vaccination' ? 'Vaccination' : 'Blood test' }}</div>
          <label class="block">
            <span class="field-label">Name</span>
            <input v-model="form.name" class="field font-display text-2xl" />
          </label>
          <label class="block">
            <span class="field-label">Performed on</span>
            <input v-model="form.performed_on" type="date" class="field" />
          </label>
          <div v-if="rec.kind === 'vaccination'" class="grid grid-cols-2 gap-4">
            <label class="block">
              <span class="field-label">Dose №</span>
              <input v-model.number="form.dose_number" type="number" min="1" class="field tabular-nums" />
            </label>
            <label class="block">
              <span class="field-label">Of</span>
              <input v-model.number="form.total_doses" type="number" min="1" class="field tabular-nums" />
            </label>
          </div>
          <label class="block">
            <span class="field-label">Note</span>
            <textarea v-model="form.notes" rows="3" class="field font-display-wonk text-lg resize-none" placeholder="A word, a thought, a detail…"></textarea>
          </label>
          <div class="flex gap-3 pt-2">
            <button class="btn-primary">Save amendment</button>
            <button type="button" class="btn-ghost" @click="editing = false">Discard</button>
          </div>
        </form>
      </article>

      <footer class="flex items-center justify-between pt-6 text-xs">
        <div class="folio">filed {{ new Date(rec.created_at).toLocaleDateString('en-GB') }}</div>
        <div class="folio">ref {{ rec.qr_fingerprint?.slice(0,10) }}</div>
      </footer>
    </section>
  </main>

  <main v-else class="min-h-dvh grid place-items-center">
    <div class="font-display-wonk text-muted-app text-xl">retrieving entry…</div>
  </main>
</template>
