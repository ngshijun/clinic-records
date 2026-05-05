<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useProfilesStore } from '@/stores/profiles'
import { isValidNric, deriveDobFromNric } from '@/lib/nric'
import CountryPicker from '@/components/CountryPicker.vue'

const route = useRoute()
const router = useRouter()
const store = useProfilesStore()
const { t } = useI18n()

// Completion mode is triggered by the router guard for legacy profiles
// missing required fields. UI changes: no cancel (no escape hatch), no
// back link, page-level "completing" eyebrow + heading, and on save we
// bounce to ?next or /home so the guard can re-evaluate.
const isCompleting = computed(() => route.query.complete === '1')

const name = ref('')
const nric = ref('')
const nationality = ref('MY')
const dob = ref('')
const error = ref<string | null>(null)
const busy = ref(false)

const isMalaysian = computed(() => nationality.value === 'MY')

// DOB is fully derived from NRIC for MY (input is disabled). For non-MY
// (passport users) the DOB is a free input. Watcher clears DOB if NRIC
// becomes invalid mid-edit so we never show stale derived data.
watch([nric, nationality], ([n]) => {
  if (!isMalaysian.value) return
  dob.value = deriveDobFromNric(n) ?? ''
})

const profile = computed(() => {
  const id = typeof route.params.id === 'string' ? route.params.id : ''
  return store.profiles.find((p) => p.id === id) ?? null
})

async function load() {
  if (!store.loaded) await store.fetchAll()
  const p = profile.value
  if (!p) {
    // Profile not found — bounce back to roster. Could happen if someone
    // navigates to a stale URL or the profile was deleted on another device.
    router.replace('/profiles')
    return
  }
  name.value = p.name
  nric.value = p.nric ?? ''
  nationality.value = p.nationality || 'MY'
  dob.value = p.date_of_birth ?? ''
}

onMounted(load)

async function save() {
  if (busy.value || !profile.value) return
  error.value = null
  const nm = name.value.trim()
  const id = nric.value.trim()
  // Strict validation: same rules as the create form. Detail page is an
  // explicit edit, so we always require NRIC and DOB regardless of mode.
  if (!nm) { error.value = t('common.error'); return }
  if (!id) { error.value = t(isMalaysian.value ? 'profiles.nricRequired' : 'profiles.idRequired'); return }
  if (isMalaysian.value && !isValidNric(id)) { error.value = t('profiles.nricInvalid'); return }
  if (!dob.value) { error.value = t('profiles.dobRequired'); return }

  busy.value = true
  try {
    await store.update(profile.value.id, {
      name: nm,
      nric: id,
      nationality: nationality.value,
      date_of_birth: dob.value,
    })
    if (isCompleting.value) {
      // Bounce to the original destination (or /home). The router guard
      // re-fires and redirects to the next incomplete profile if any,
      // otherwise lets navigation through.
      const next = typeof route.query.next === 'string' ? route.query.next : '/home'
      router.replace(next)
    } else {
      router.replace('/profiles')
    }
  } catch (e: any) {
    error.value = e.message ?? 'Could not save'
  } finally {
    busy.value = false
  }
}

function cancel() {
  router.replace('/profiles')
}
</script>

<template>
  <main class="min-h-dvh pb-20">
    <header class="max-w-[760px] w-full mx-auto px-6 pt-8 flex items-center justify-between">
      <router-link v-if="!isCompleting" to="/profiles" class="folio underline underline-offset-4 decoration-[var(--color-rule)]">{{ $t('profiles.backToRoster') }}</router-link>
      <div v-else class="eyebrow" style="color: var(--color-accent)"><span class="tick"></span>{{ $t('profiles.completingProfile') }}</div>
    </header>

    <section class="max-w-[760px] w-full mx-auto px-6 py-10 space-y-12">
      <div class="space-y-2 anim-rise">
        <div class="eyebrow">
          <span class="tick"></span>{{ isCompleting ? $t('profiles.completeEyebrow') : $t('profiles.amendingProfile') }}
        </div>
        <h1 class="font-display text-5xl md:text-6xl leading-[0.95]">
          <span v-if="isCompleting">{{ $t('profiles.completeTitlePre') }} <span class="font-display-wonk">{{ $t('profiles.completeTitleWonk') }}</span></span>
          <span v-else>{{ $t('profiles.editingTitle') }} <span class="font-display-wonk">{{ profile?.name ?? '' }}</span></span>
        </h1>
        <p v-if="isCompleting" class="text-ink-2 text-sm max-w-[44ch]">{{ $t('profiles.completeHint') }}</p>
      </div>

      <form class="paper-card brackets p-6 md:p-8 space-y-5 anim-rise-2" @submit.prevent="save">
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
        <div class="flex items-center gap-3 pt-2 flex-wrap">
          <button class="btn-primary" :disabled="busy">
            {{ isCompleting ? $t('common.continue') : $t('profiles.save') }}
            <span v-if="isCompleting" aria-hidden>→</span>
          </button>
          <button v-if="!isCompleting" type="button" class="btn-ghost" :disabled="busy" @click="cancel">{{ $t('profiles.cancel') }}</button>
          <p v-if="error" class="text-crimson text-sm">
            <span class="eyebrow" style="color:var(--color-crimson)">{{ $t('common.error') }} ·</span> {{ error }}
          </p>
        </div>
      </form>
    </section>
  </main>
</template>
