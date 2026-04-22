<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const { t } = useI18n()
const email = ref('')
const password = ref('')
const error = ref<string | null>(null)
const busy = ref(false)

async function submit() {
  error.value = null
  busy.value = true
  try {
    await auth.signIn(email.value.trim(), password.value)
    router.push('/home')
  } catch (e: any) {
    error.value = e.message ?? t('auth.signIn') + ' failed'
  } finally {
    busy.value = false
  }
}

async function guest() {
  error.value = null
  busy.value = true
  try {
    await auth.signInAnonymously()
    router.push('/profiles?first=1')
  } catch (e: any) {
    error.value = e.message ?? 'Could not start as guest'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="min-h-dvh grid lg:grid-cols-[1.1fr_0.9fr]">
    <aside class="hidden lg:flex flex-col justify-between px-12 py-10 hairline-b lg:hairline-b-0 lg:border-r border-[var(--color-rule)]">
      <header class="anim-rise">
        <div class="eyebrow"><span class="tick"></span>{{ $t('brand.label') }}</div>
      </header>

      <div class="space-y-6 anim-rise-2">
        <h1 class="font-display text-[clamp(3rem,8vw,5.5rem)] leading-[0.92] tracking-tight">
          {{ $t('landing.headline') }}
        </h1>
        <p class="text-ink-2 max-w-md text-[15px] leading-relaxed">{{ $t('landing.description') }}</p>
      </div>

      <div></div>
    </aside>

    <section class="flex flex-col justify-center px-6 lg:px-16 py-12">
      <div class="max-w-[420px] w-full mx-auto space-y-10">
        <div class="space-y-3 anim-rise">
          <div class="eyebrow"><span class="tick"></span>{{ $t('landing.beginHere') }}</div>
          <h2 class="font-display text-5xl leading-[0.95]">{{ $t('landing.signInTitle') }}</h2>
          <p class="text-ink-2 text-sm">{{ $t('auth.welcomeBack') }}</p>
        </div>

        <form class="space-y-6 anim-rise-2" @submit.prevent="submit">
          <label class="block">
            <span class="field-label">{{ $t('auth.email') }}</span>
            <input v-model="email" type="email" autocomplete="email" class="field" required />
          </label>
          <label class="block">
            <span class="field-label">{{ $t('auth.password') }}</span>
            <input v-model="password" type="password" autocomplete="current-password" class="field" required />
          </label>

          <button :disabled="busy" class="btn-primary w-full">
            {{ busy ? $t('auth.signingIn') : $t('auth.signIn') }}
            <span v-if="!busy" aria-hidden>→</span>
          </button>

          <p v-if="error" class="text-crimson text-sm leading-snug">
            <span class="eyebrow" style="color:var(--color-crimson)">{{ $t('common.error') }} ·</span> {{ error }}
          </p>
        </form>

        <div class="flex items-center gap-4 text-muted-app text-[11px] anim-rise-3">
          <div class="rule-line flex-1"></div>
          <span class="eyebrow">{{ $t('common.or') }}</span>
          <div class="rule-line flex-1"></div>
        </div>

        <div class="space-y-4 anim-rise-4">
          <button :disabled="busy" class="btn-ghost w-full" @click="guest">
            {{ $t('auth.continueAsGuest') }}
          </button>
          <p class="text-muted-app text-[13px] leading-relaxed">{{ $t('auth.guestNote') }}</p>
          <p class="text-sm hairline-t pt-4">
            <span class="text-muted-app">{{ $t('auth.noAccountYet') }}</span>
            <router-link to="/signup" class="font-display-wonk ml-1 underline decoration-[var(--color-accent)] decoration-2 underline-offset-4 text-ink">
              {{ $t('auth.createOne') }}
            </router-link>
          </p>
        </div>
      </div>
    </section>
  </main>
</template>
