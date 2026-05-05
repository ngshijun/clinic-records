<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useProfilesStore, type Profile } from '@/stores/profiles'
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

const isMalaysian = computed(() => nationality.value === 'MY')

// DOB is fully derived from NRIC for Malaysians — the input is disabled and
// always reflects the current NRIC. Clearing happens too: if NRIC becomes
// invalid (mid-edit, partial digits) we wipe DOB rather than leaving stale.
// For non-MY (passport users) the DOB is a free input.
watch([nric, nationality], ([n]) => {
  if (!isMalaysian.value) return
  dob.value = deriveDobFromNric(n) ?? ''
})

// --- edit form ---
const editingId = ref<string | null>(null)
const editName = ref('')
const editNric = ref('')
const editNationality = ref('MY')
const editDob = ref('')
const editError = ref<string | null>(null)
const editBusy = ref(false)
const deletingId = ref<string | null>(null)

const editIsMalaysian = computed(() => editNationality.value === 'MY')

watch([editNric, editNationality], ([n]) => {
  if (!editIsMalaysian.value) return
  editDob.value = deriveDobFromNric(n) ?? ''
})

const isFirst = computed(() => route.query.first === '1' && store.profiles.length === 0)

// Completion mode: router redirects here with ?complete=<id> when a profile
// is missing required fields (currently: nric). We auto-open the edit form
// for that profile, hide every other surface, and require strict validation
// on save so the user can't escape with the field still empty.
const completeId = computed(() => {
  const q = route.query.complete
  return typeof q === 'string' ? q : null
})
const completingProfile = computed(() =>
  completeId.value ? store.profiles.find((p) => p.id === completeId.value) ?? null : null,
)
const isCompleting = computed(() => completingProfile.value !== null)

onMounted(async () => { await store.fetchAll() })

// Auto-open the edit form for the profile being completed. Watcher with
// immediate:true handles both first mount and subsequent ?complete=<id>
// changes (e.g. after saving one incomplete profile, the guard redirects
// to the next incomplete one and we need to re-open).
watch(
  [completingProfile, () => store.loaded],
  () => {
    const p = completingProfile.value
    if (!p) return
    if (editingId.value === p.id) return
    startEdit(p)
  },
  { immediate: true },
)

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

function startEdit(p: Profile) {
  editingId.value = p.id
  editName.value = p.name
  editNric.value = p.nric ?? ''
  editNationality.value = p.nationality || 'MY'
  editDob.value = p.date_of_birth ?? ''
  editError.value = null
}

function cancelEdit() {
  editingId.value = null
  editError.value = null
}

async function saveEdit() {
  if (!editingId.value || editBusy.value) return
  editError.value = null
  const nm = editName.value.trim()
  const id = editNric.value.trim()
  if (!nm) { editError.value = t('common.error'); return }
  if (isCompleting.value) {
    // Strict in completion mode: same rules as the create form. The whole
    // point of this flow is to fill in the missing required fields, so we
    // can't allow the user to save with them still empty.
    if (!id) { editError.value = t(editIsMalaysian.value ? 'profiles.nricRequired' : 'profiles.idRequired'); return }
    if (editIsMalaysian.value && !isValidNric(id)) { editError.value = t('profiles.nricInvalid'); return }
    if (!editDob.value) { editError.value = t('profiles.dobRequired'); return }
  } else {
    // Lenient on regular edit: accept null nric/dob (existing legacy rows
    // can stay empty), but if either is provided we still validate it.
    if (id && editIsMalaysian.value && !isValidNric(id)) { editError.value = t('profiles.nricInvalid'); return }
  }

  editBusy.value = true
  try {
    await store.update(editingId.value, {
      name: nm,
      nric: id || null,
      nationality: editNationality.value,
      date_of_birth: editDob.value || null,
    })
    editingId.value = null
    if (isCompleting.value) {
      // Bounce back to home (or wherever they were trying to go). The
      // router guard re-fires and either finds the next incomplete
      // profile and redirects again, or lets the navigation through.
      const next = typeof route.query.next === 'string' ? route.query.next : '/home'
      router.replace(next)
    }
  } catch (e: any) { editError.value = e.message ?? 'Could not save' }
  finally { editBusy.value = false }
}

function formatDob(d: string | null) {
  return d ? formatDateLong(d, locale.value) : null
}
</script>

<template>
  <main class="min-h-dvh pb-20">
    <header class="max-w-[760px] w-full mx-auto px-6 pt-8 flex items-center justify-between">
      <router-link v-if="!isFirst && !isCompleting" to="/home" class="folio underline underline-offset-4 decoration-[var(--color-rule)]">{{ $t('common.backToLedger') }}</router-link>
      <div v-else-if="isFirst" class="eyebrow"><span class="tick"></span>{{ $t('profiles.firstReader') }}</div>
      <div v-else class="eyebrow" style="color: var(--color-accent)"><span class="tick"></span>{{ $t('profiles.completingProfile') }}</div>
      <div class="eyebrow">{{ $t('profiles.profilesLabel', { count: String(store.profiles.length).padStart(2, '0') }) }}</div>
    </header>

    <section class="max-w-[760px] w-full mx-auto px-6 py-10 space-y-12">
      <div class="space-y-2 anim-rise">
        <div class="eyebrow"><span class="tick"></span>{{ isFirst ? $t('profiles.welcome') : isCompleting ? $t('profiles.completeEyebrow') : $t('profiles.rosterOfReaders') }}</div>
        <h1 class="font-display text-5xl md:text-6xl leading-[0.95]">
          <span v-if="isFirst">{{ $t('profiles.whoFor') }}<br/><span class="font-display-wonk">{{ $t('profiles.thisLedgerFor') }}</span></span>
          <span v-else-if="isCompleting">{{ $t('profiles.completeTitlePre') }} <span class="font-display-wonk">{{ $t('profiles.completeTitleWonk') }}</span></span>
          <span v-else>{{ $t('profiles.titleProfiles') }}</span>
        </h1>
        <p v-if="isFirst" class="text-ink-2 text-sm max-w-[40ch]">{{ $t('profiles.firstHint') }}</p>
        <p v-else-if="isCompleting" class="text-ink-2 text-sm max-w-[44ch]">{{ $t('profiles.completeHint') }}</p>
        <p v-else class="text-ink-2 text-sm max-w-[40ch]">{{ $t('profiles.oneLedgerPerPerson') }}</p>
      </div>

      <form v-if="!isCompleting" class="paper-card brackets p-6 md:p-8 space-y-5 anim-rise-2" @submit.prevent="add">
        <div class="eyebrow">{{ $t('profiles.admitNew') }}</div>

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

      <!-- Completion form: prominent paper-card surface mirroring the first-login
           create form. Pre-filled with the targeted profile's existing values
           via startEdit() (called from the watcher above). Submits through
           saveEdit() in strict mode. -->
      <form v-if="isCompleting" class="paper-card brackets p-6 md:p-8 space-y-5 anim-rise-2" @submit.prevent="saveEdit">
        <div class="eyebrow" style="color: var(--color-accent)">{{ $t('profiles.completingProfile') }}</div>

        <label class="block">
          <span class="field-label">{{ $t('profiles.nationalityLabel') }}</span>
          <CountryPicker v-model="editNationality" />
        </label>

        <div class="grid sm:grid-cols-[1.2fr_1fr] gap-5">
          <label class="block">
            <span class="field-label">{{ $t('profiles.nameLabel') }}</span>
            <input v-model="editName" :placeholder="$t('profiles.namePlaceholder')" required class="field font-display text-2xl" />
          </label>
          <label class="block">
            <span class="field-label">{{ editIsMalaysian ? $t('profiles.nricLabel') : $t('profiles.idLabel') }}</span>
            <input v-model="editNric" :placeholder="editIsMalaysian ? $t('profiles.nricPlaceholder') : $t('profiles.idPlaceholder')" required class="field tabular-nums" autocomplete="off" />
          </label>
        </div>
        <label class="block">
          <span class="field-label">
            {{ $t('profiles.bornLabel') }}
            <span v-if="editIsMalaysian" class="ml-1 normal-case" style="color: var(--color-ink-2)">— {{ $t('profiles.dobFromNric') }}</span>
          </span>
          <input v-model="editDob" type="date" required class="field tabular-nums" :disabled="editIsMalaysian" />
        </label>
        <div class="flex items-center gap-3 pt-2">
          <button class="btn-primary" :disabled="editBusy">{{ $t('common.continue') }} <span aria-hidden>→</span></button>
          <p v-if="editError" class="text-crimson text-sm">
            <span class="eyebrow" style="color:var(--color-crimson)">{{ $t('common.error') }} ·</span> {{ editError }}
          </p>
        </div>
      </form>

      <div v-if="store.profiles.length && !isCompleting" class="space-y-4 anim-rise-3">
        <div class="flex items-baseline justify-between">
          <h2 class="font-display text-2xl">{{ $t('profiles.roster') }}</h2>
          <span class="eyebrow">{{ $t('profiles.onFile', { count: store.profiles.length }) }}</span>
        </div>

        <ul class="divide-y divide-[var(--color-rule-soft)] hairline-t hairline-b">
          <li v-for="(p, i) in store.profiles" :key="p.id" class="py-5 px-1">
            <div v-if="editingId !== p.id" class="grid grid-cols-[auto_1fr_auto] items-center gap-5">
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
                <button class="btn-ghost text-xs !py-1.5 !px-3" @click="startEdit(p)">{{ $t('profiles.edit') }}</button>
                <button v-if="!p.is_default" class="btn-ghost text-xs !py-1.5 !px-3" @click="setDefault(p.id)">{{ $t('profiles.makeDefault') }}</button>
                <button v-if="!p.is_default" class="btn-danger text-xs !py-1.5 !px-3" :disabled="deletingId === p.id" @click="del(p.id)">{{ $t('profiles.delete') }}</button>
              </div>
            </div>

            <form v-else class="grid grid-cols-[auto_1fr] gap-5 items-start" @submit.prevent="saveEdit">
              <span class="folio tabular-nums w-8 pt-6">№{{ String(i+1).padStart(2,'0') }}</span>
              <div class="space-y-4">
                <div class="eyebrow" style="color: var(--color-accent)">{{ $t('profiles.amendingProfile') }}</div>
                <label class="block">
                  <span class="field-label">{{ $t('profiles.nationalityLabel') }}</span>
                  <CountryPicker v-model="editNationality" />
                </label>
                <div class="grid sm:grid-cols-[1.2fr_1fr] gap-4">
                  <label class="block">
                    <span class="field-label">{{ $t('profiles.nameLabel') }}</span>
                    <input v-model="editName" required class="field font-display text-xl" />
                  </label>
                  <label class="block">
                    <span class="field-label">{{ editIsMalaysian ? $t('profiles.nricLabel') : $t('profiles.idLabel') }}</span>
                    <input v-model="editNric" :placeholder="editIsMalaysian ? $t('profiles.nricPlaceholder') : $t('profiles.idPlaceholder')" class="field tabular-nums" autocomplete="off" />
                  </label>
                </div>
                <label class="block">
                  <span class="field-label">
                    {{ $t('profiles.bornLabel') }}
                    <span v-if="editIsMalaysian" class="ml-1 normal-case" style="color: var(--color-ink-2)">— {{ $t('profiles.dobFromNric') }}</span>
                  </span>
                  <input v-model="editDob" type="date" class="field tabular-nums" :disabled="editIsMalaysian" />
                </label>
                <p v-if="editError" class="text-crimson text-xs">
                  <span class="eyebrow" style="color:var(--color-crimson)">{{ $t('common.error') }} ·</span> {{ editError }}
                </p>
                <div class="flex items-center gap-2 pt-1">
                  <button class="btn-primary !py-2 !px-4 text-sm" :disabled="editBusy">{{ $t('profiles.save') }}</button>
                  <button type="button" class="btn-ghost !py-2 !px-4 text-sm" :disabled="editBusy" @click="cancelEdit">{{ $t('profiles.cancel') }}</button>
                </div>
              </div>
            </form>
          </li>
        </ul>
      </div>
    </section>
  </main>
</template>
