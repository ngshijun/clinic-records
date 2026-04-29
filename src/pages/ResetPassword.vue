<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import PasswordField from '@/components/PasswordField.vue'

const auth = useAuthStore()
const router = useRouter()
const password = ref('')
const confirm = ref('')
const error = ref<string | null>(null)
const busy = ref(false)
const ready = ref(false)

onMounted(async () => {
  if (!auth.loaded) await auth.init()
  // Supabase parses the recovery hash on load (detectSessionInUrl: true) and
  // establishes a short-lived session. If we have no session at all, the link
  // was invalid or expired.
  const { data } = await supabase.auth.getSession()
  if (!data.session) {
    error.value = null
    ready.value = false
  } else {
    ready.value = true
  }
})

async function submit() {
  error.value = null
  if (password.value !== confirm.value) {
    error.value = 'mismatch'
    return
  }
  busy.value = true
  try {
    await auth.updatePassword(password.value)
    router.replace('/home')
  } catch (e: any) {
    error.value = e.message ?? 'Could not update password'
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
          <div class="eyebrow"><span class="tick"></span>{{ $t('resetPassword.eyebrow') }}</div>
          <h1 class="font-display text-5xl md:text-6xl leading-[0.95]">
            {{ $t('resetPassword.titlePre') }} <span class="font-display-wonk">{{ $t('resetPassword.titleWonk') }}</span>{{ $t('resetPassword.titleSuffix') }}
          </h1>
          <p class="text-ink-2 text-sm leading-relaxed max-w-[36ch]">{{ $t('resetPassword.description') }}</p>
        </div>

        <div v-if="!ready" class="space-y-6 anim-rise-2">
          <p class="text-crimson text-sm leading-snug">
            <span class="eyebrow" style="color:var(--color-crimson)">{{ $t('common.error') }} ·</span> {{ $t('resetPassword.linkExpired') }}
          </p>
          <p class="text-sm hairline-t pt-4">
            <router-link to="/forgot-password" class="font-display-wonk underline decoration-[var(--color-accent)] decoration-2 underline-offset-4 text-ink">
              {{ $t('resetPassword.requestNew') }}
            </router-link>
          </p>
        </div>

        <form v-else class="space-y-6 anim-rise-2" @submit.prevent="submit">
          <label class="block">
            <span class="field-label">{{ $t('resetPassword.newPassword') }}</span>
            <PasswordField v-model="password" autocomplete="new-password" minlength="8" class="field" required />
            <span class="text-[11px] text-muted-app mt-1 block">{{ $t('auth.eightCharMin') }}</span>
          </label>
          <label class="block">
            <span class="field-label">{{ $t('resetPassword.confirmPassword') }}</span>
            <PasswordField v-model="confirm" autocomplete="new-password" minlength="8" class="field" required />
          </label>

          <button :disabled="busy" class="btn-primary w-full">
            {{ busy ? $t('resetPassword.saving') : $t('resetPassword.savePassword') }}
            <span v-if="!busy" aria-hidden>→</span>
          </button>

          <p v-if="error === 'mismatch'" class="text-crimson text-sm">
            <span class="eyebrow" style="color:var(--color-crimson)">{{ $t('common.error') }} ·</span> {{ $t('resetPassword.mismatch') }}
          </p>
          <p v-else-if="error" class="text-crimson text-sm">
            <span class="eyebrow" style="color:var(--color-crimson)">{{ $t('common.error') }} ·</span> {{ error }}
          </p>
        </form>
      </div>
    </section>
  </main>
</template>
