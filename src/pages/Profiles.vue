<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useProfilesStore } from '@/stores/profiles'
import { useDialog } from '@/lib/dialog'
import { formatDateLong } from '@/lib/dates'
import { isValidNric, deriveDobFromNric } from '@/lib/nric'
import { flagFor, nameFor } from '@/lib/countries'
import CountryPicker from '@/components/CountryPicker.vue'

const store = useProfilesStore()
const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const dialog = useDialog()

// --- add form ---
const name = ref('')
const nric = ref('')
const nationality = ref('MY')
const dob = ref('')
const error = ref<string | null>(null)
const busy = ref(false)
const deletingId = ref<string | null>(null)

const isMalaysian = computed(() => nationality.value === 'MY')

// DOB is fully derived from NRIC for Malaysians — the input is disabled and
// always reflects the current NRIC. Clearing happens too: if NRIC becomes
// invalid (mid-edit, partial digits) we wipe DOB rather than leaving stale.
// For non-MY (passport users) the DOB is a free input.
watch([nric, nationality], ([n]) => {
  if (!isMalaysian.value) return
  dob.value = deriveDobFromNric(n) ?? ''
})

const isFirst = computed(() => route.query.first === '1' && store.profiles.length === 0)

// Add form is collapsed by default — most visits to /profiles aren't to add
// a new reader, so the prominent paper-card eats screen real estate without
// benefit. In first-login mode we force it open since adding is the whole
// point of the visit.
const showAddForm = ref(false)
const formVisible = computed(() => isFirst.value || showAddForm.value)

onMounted(async () => { await store.fetchAll() })

async function add() {
  if (busy.value) return
  error.value = null
  const nm = name.value.trim()
  const id = nric.value.trim()
  if (!nm) { error.value = t('common.error'); return }
  if (!id) { error.value = t(isMalaysian.value ? 'profiles.nricRequired' : 'profiles.idRequired'); return }
  if (isMalaysian.value && !isValidNric(id)) { error.value = t('profiles.nricInvalid'); return }
  if (!dob.value) { error.value = t('profiles.dobRequired'); return }

  busy.value = true
  try {
    await store.create({
      name: nm,
      nric: id,
      nationality: nationality.value,
      date_of_birth: dob.value,
    })
    name.value = ''
    nric.value = ''
    nationality.value = 'MY'
    dob.value = ''
    if (route.query.first === '1') router.push('/home')
    else showAddForm.value = false
  } catch (e: any) { error.value = e.message }
  finally { busy.value = false }
}

async function del(id: string) {
  if (deletingId.value) return
  const ok = await dialog.confirm({
    title: t('profiles.confirmDelete'),
    confirmLabel: t('common.delete'),
  })
  if (!ok) return
  deletingId.value = id
  try { await store.remove(id) } catch (e: any) { await dialog.alert({ title: e.message }) }
  finally { deletingId.value = null }
}

async function setDefault(id: string) { await store.setDefault(id) }

function editProfile(id: string) {
  router.push(`/profiles/${id}`)
}

function formatDob(d: string | null) {
  return d ? formatDateLong(d, locale.value) : null
}
</script>

<template>
  <main class="min-h-dvh pb-20">
    <header class="max-w-[760px] w-full mx-auto px-6 pt-8 flex items-center justify-between">
      <router-link v-if="!isFirst" to="/home" class="folio underline underline-offset-4 decoration-[var(--color-rule)]">{{ $t('common.backToLedger') }}</router-link>
      <div v-else class="eyebrow"><span class="tick"></span>{{ $t('profiles.firstReader') }}</div>
      <div class="eyebrow">{{ $t('profiles.profilesLabel', { count: String(store.profiles.length).padStart(2, '0') }) }}</div>
    </header>

    <section class="max-w-[760px] w-full mx-auto px-6 py-10 space-y-12">
      <div class="space-y-2 anim-rise">
        <div class="eyebrow"><span class="tick"></span>{{ isFirst ? $t('profiles.welcome') : $t('profiles.rosterOfReaders') }}</div>
        <h1 class="font-display text-5xl md:text-6xl leading-[0.95]">
          <span v-if="isFirst">{{ $t('profiles.whoFor') }}<br/><span class="font-display-wonk">{{ $t('profiles.thisLedgerFor') }}</span></span>
          <span v-else>{{ $t('profiles.titleProfiles') }}</span>
        </h1>
        <p v-if="isFirst" class="text-ink-2 text-sm max-w-[40ch]">{{ $t('profiles.firstHint') }}</p>
        <p v-else class="text-ink-2 text-sm max-w-[40ch]">{{ $t('profiles.oneLedgerPerPerson') }}</p>
      </div>

      <!-- Collapsed: just a button to expand. Hidden in first-login mode where
           the form must always be visible. -->
      <div v-if="!isFirst && !showAddForm" class="anim-rise-2">
        <button type="button" class="btn-ghost" @click="showAddForm = true">
          <span aria-hidden>+</span> {{ $t('profiles.admitNew') }}
        </button>
      </div>

      <form v-if="formVisible" class="paper-card brackets p-6 md:p-8 space-y-5 anim-rise-2" @submit.prevent="add">
        <div class="flex items-center justify-between">
          <div class="eyebrow">{{ $t('profiles.admitNew') }}</div>
          <button v-if="!isFirst" type="button" class="text-ink-2 hover:text-ink text-lg leading-none" :aria-label="$t('profiles.cancel')" @click="showAddForm = false">×</button>
        </div>

        <label class="block">
          <span class="field-label">{{ $t('profiles.nationalityLabel') }}</span>
          <CountryPicker v-model="nationality" />
        </label>

        <div class="grid sm:grid-cols-[1.2fr_1fr] gap-5">
          <label class="block">
            <span class="field-label">{{ $t('profiles.nameLabel') }}</span>
            <input v-model="name" :placeholder="$t('profiles.namePlaceholder')" required class="field font-display text-2xl" />
          </label>
          <label class="block">
            <span class="field-label">{{ isMalaysian ? $t('profiles.nricLabel') : $t('profiles.idLabel') }}</span>
            <input v-model="nric" :placeholder="isMalaysian ? $t('profiles.nricPlaceholder') : $t('profiles.idPlaceholder')" required class="field tabular-nums" autocomplete="off" />
          </label>
        </div>
        <label class="block">
          <span class="field-label">
            {{ $t('profiles.bornLabel') }}
            <span v-if="isMalaysian" class="ml-1 normal-case" style="color: var(--color-ink-2)">— {{ $t('profiles.dobFromNric') }}</span>
          </span>
          <input v-model="dob" type="date" required class="field tabular-nums" :disabled="isMalaysian" />
        </label>
        <div class="flex items-center gap-3 pt-2">
          <button class="btn-primary" :disabled="busy">{{ isFirst ? $t('common.continue') : $t('profiles.addProfile') }} <span aria-hidden>→</span></button>
          <p v-if="error" class="text-crimson text-sm">
            <span class="eyebrow" style="color:var(--color-crimson)">{{ $t('common.error') }} ·</span> {{ error }}
          </p>
        </div>
      </form>

      <div v-if="store.profiles.length" class="space-y-4 anim-rise-3">
        <div class="flex items-baseline justify-between">
          <h2 class="font-display text-2xl">{{ $t('profiles.roster') }}</h2>
          <span class="eyebrow">{{ $t('profiles.onFile', { count: store.profiles.length }) }}</span>
        </div>

        <ul class="divide-y divide-[var(--color-rule-soft)] hairline-t hairline-b">
          <li v-for="(p, i) in store.profiles" :key="p.id" class="py-5 px-1">
            <div class="grid grid-cols-[auto_1fr_auto] items-center gap-5">
              <span class="folio tabular-nums w-8">№{{ String(i+1).padStart(2,'0') }}</span>
              <div>
                <div class="flex items-baseline gap-3 flex-wrap">
                  <span class="font-display text-2xl">{{ p.name }}</span>
                  <span v-if="p.is_default" class="eyebrow" style="color: var(--color-moss)">{{ $t('profiles.defaultBadge') }}</span>
                </div>
                <div class="text-xs text-muted-app mt-0.5 flex flex-wrap gap-x-2">
                  <span v-if="p.date_of_birth">{{ $t('profiles.born', { date: formatDob(p.date_of_birth) }) }}</span>
                  <span v-if="p.nric" class="tabular-nums">· {{ p.nric }}</span>
                  <span v-if="p.nationality && p.nationality !== 'MY'">· {{ flagFor(p.nationality) }} {{ nameFor(p.nationality) }}</span>
                </div>
              </div>
              <div class="flex items-center gap-1 flex-wrap justify-end">
                <button class="btn-ghost text-xs !py-1.5 !px-3" @click="editProfile(p.id)">{{ $t('profiles.edit') }}</button>
                <button v-if="!p.is_default" class="btn-ghost text-xs !py-1.5 !px-3" @click="setDefault(p.id)">{{ $t('profiles.makeDefault') }}</button>
                <button v-if="!p.is_default" class="btn-danger text-xs !py-1.5 !px-3" :disabled="deletingId === p.id" @click="del(p.id)">{{ $t('profiles.delete') }}</button>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </section>
  </main>
</template>
