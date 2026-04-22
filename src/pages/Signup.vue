<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useProfilesStore } from '@/stores/profiles'

const auth = useAuthStore()
const profiles = useProfilesStore()
const router = useRouter()
const name = ref('')
const email = ref('')
const password = ref('')
const error = ref<string | null>(null)
const busy = ref(false)

async function submit() {
  error.value = null
  busy.value = true
  try {
    await auth.signUp(email.value.trim(), password.value)
    if (auth.user) {
      await profiles.create({ name: name.value.trim() })
      router.push('/home')
    } else {
      router.push('/profiles?first=1')
    }
  } catch (e: any) {
    error.value = e.message ?? 'Sign-up failed'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="min-h-dvh flex flex-col">
    <header class="max-w-[920px] w-full mx-auto px-6 lg:px-12 pt-8 flex items-center justify-between">
      <div class="eyebrow"><span class="tick"></span>{{ $t('brand.label') }}</div>
      <div class="folio">{{ $t('signup.enrolmentLabel') }}</div>
    </header>

    <section class="flex-1 flex items-center">
      <div class="max-w-[480px] w-full mx-auto px-6 py-10 space-y-10">
        <div class="space-y-3 anim-rise">
          <div class="eyebrow"><span class="tick"></span>{{ $t('signup.eyebrow') }}</div>
          <h1 class="font-display text-5xl md:text-6xl leading-[0.95]">
            {{ $t('signup.titlePre') }} <span class="font-display-wonk">{{ $t('signup.titleWonk') }}</span>{{ $t('signup.titleSuffix') }}
          </h1>
          <p class="text-ink-2 text-sm leading-relaxed max-w-[36ch]">{{ $t('auth.oneAccountAny') }}</p>
        </div>

        <form class="space-y-6 anim-rise-2" @submit.prevent="submit">
          <label class="block">
            <span class="field-label">{{ $t('auth.yourName') }}</span>
            <input v-model="name" type="text" autocomplete="name" class="field font-display text-2xl" :placeholder="$t('auth.namePlaceholder')" required />
            <span class="text-[11px] text-muted-app mt-1 block">{{ $t('auth.firstProfileHint') }}</span>
          </label>
          <label class="block">
            <span class="field-label">{{ $t('auth.email') }}</span>
            <input v-model="email" type="email" autocomplete="email" class="field" required />
          </label>
          <label class="block">
            <span class="field-label">{{ $t('auth.password') }}</span>
            <input v-model="password" type="password" autocomplete="new-password" minlength="8" class="field" required />
            <span class="text-[11px] text-muted-app mt-1 block">{{ $t('auth.eightCharMin') }}</span>
          </label>

          <button :disabled="busy" class="btn-primary w-full">
            {{ busy ? $t('auth.creatingAccount') : $t('auth.createAccount') }}
            <span v-if="!busy" aria-hidden>→</span>
          </button>

          <p v-if="error" class="text-crimson text-sm">
            <span class="eyebrow" style="color:var(--color-crimson)">{{ $t('common.error') }} ·</span> {{ error }}
          </p>
        </form>

        <p class="text-sm hairline-t pt-4 anim-rise-3">
          <span class="text-muted-app">{{ $t('auth.alreadyEnrolled') }}</span>
          <router-link to="/" class="font-display-wonk ml-1 underline decoration-[var(--color-accent)] decoration-2 underline-offset-4 text-ink">
            {{ $t('auth.signInLink') }}
          </router-link>
        </p>
      </div>
    </section>

    <footer class="max-w-[920px] w-full mx-auto px-6 lg:px-12 pb-6 flex items-center justify-between">
      <div class="folio">PGN·CR / enrol</div>
      <div class="eyebrow">{{ $t('signup.page02') }}</div>
    </footer>
  </main>
</template>
