<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const email = ref('')
const error = ref<string | null>(null)
const busy = ref(false)
const sent = ref(false)

async function submit() {
  error.value = null
  busy.value = true
  try {
    await auth.requestPasswordReset(email.value.trim())
    sent.value = true
  } catch (e: any) {
    error.value = e.message ?? 'Could not send reset email'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="min-h-dvh flex flex-col">
    <header class="max-w-[920px] w-full mx-auto px-6 lg:px-12 pt-8">
      <div class="eyebrow"><span class="tick"></span>{{ $t('brand.label') }}</div>
    </header>

    <section class="flex-1 flex items-center">
      <div class="max-w-[480px] w-full mx-auto px-6 py-10 space-y-10">
        <div class="space-y-3 anim-rise">
          <div class="eyebrow"><span class="tick"></span>{{ $t('forgotPassword.eyebrow') }}</div>
          <h1 class="font-display text-5xl md:text-6xl leading-[0.95]">
            {{ $t('forgotPassword.titlePre') }} <span class="font-display-wonk">{{ $t('forgotPassword.titleWonk') }}</span>{{ $t('forgotPassword.titleSuffix') }}
          </h1>
          <p class="text-ink-2 text-sm leading-relaxed max-w-[36ch]">{{ $t('forgotPassword.description') }}</p>
        </div>

        <div v-if="sent" class="space-y-6 anim-rise-2">
          <div class="space-y-3">
            <div class="eyebrow" style="color:var(--color-accent)">{{ $t('forgotPassword.sentEyebrow') }}</div>
            <p class="text-ink-2 text-sm leading-relaxed">{{ $t('forgotPassword.sentBody', { email: email.trim() }) }}</p>
          </div>
          <p class="text-sm hairline-t pt-4">
            <router-link to="/" class="font-display-wonk underline decoration-[var(--color-accent)] decoration-2 underline-offset-4 text-ink">
              {{ $t('auth.signInLink') }}
            </router-link>
          </p>
        </div>

        <form v-else class="space-y-6 anim-rise-2" @submit.prevent="submit">
          <label class="block">
            <span class="field-label">{{ $t('auth.email') }}</span>
            <input v-model="email" type="email" autocomplete="email" class="field" required />
          </label>

          <button :disabled="busy" class="btn-primary w-full">
            {{ busy ? $t('forgotPassword.sending') : $t('forgotPassword.sendLink') }}
            <span v-if="!busy" aria-hidden>→</span>
          </button>

          <p v-if="error" class="text-crimson text-sm">
            <span class="eyebrow" style="color:var(--color-crimson)">{{ $t('common.error') }} ·</span> {{ error }}
          </p>
        </form>

        <p v-if="!sent" class="text-sm hairline-t pt-4 anim-rise-3">
          <span class="text-muted-app">{{ $t('forgotPassword.rememberItNow') }}</span>
          <router-link to="/" class="font-display-wonk ml-1 underline decoration-[var(--color-accent)] decoration-2 underline-offset-4 text-ink">
            {{ $t('auth.signInLink') }}
          </router-link>
        </p>
      </div>
    </section>
  </main>
</template>
