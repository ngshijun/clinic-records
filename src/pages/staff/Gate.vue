<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { verifyPassword, markStaffUnlocked, isStaffUnlocked } from '@/lib/staff-auth'

const router = useRouter()
const { t } = useI18n()
const pw = ref('')
const error = ref<string | null>(null)
const busy = ref(false)

if (isStaffUnlocked()) router.replace('/staff/generate')

async function submit() {
  busy.value = true
  error.value = null
  const ok = await verifyPassword(
    pw.value,
    import.meta.env.VITE_STAFF_PASSWORD_SALT as string,
    import.meta.env.VITE_STAFF_PASSWORD_HASH as string,
  )
  busy.value = false
  if (!ok) { error.value = t('common.error'); return }
  markStaffUnlocked()
  router.replace('/staff/generate')
}
</script>

<template>
  <main class="min-h-dvh grid lg:grid-cols-[1fr_1fr]">
    <aside class="hidden lg:flex flex-col justify-between p-10 border-r hairline relative overflow-hidden">
      <div class="absolute inset-0 pointer-events-none" aria-hidden>
        <svg class="w-full h-full opacity-[0.07]" viewBox="0 0 400 600" fill="none">
          <g stroke="currentColor" stroke-width="0.5" style="color: var(--color-staff-accent)">
            <circle cx="200" cy="300" r="180" />
            <circle cx="200" cy="300" r="140" />
            <circle cx="200" cy="300" r="100" />
            <circle cx="200" cy="300" r="60" />
            <line x1="0" y1="300" x2="400" y2="300" />
            <line x1="200" y1="0" x2="200" y2="600" />
          </g>
        </svg>
      </div>

      <header class="relative z-10">
        <div class="eyebrow"><span class="tick" style="background: var(--color-staff-accent)"></span>{{ $t('staff.consoleLabel') }}</div>
      </header>

      <div class="relative z-10 space-y-6">
        <h1 class="font-display-wonk text-[clamp(3rem,7vw,5rem)] leading-[0.92]" style="color: var(--color-staff-accent)">
          {{ $t('staff.consoleLabel') }}
        </h1>
        <p class="text-[15px] max-w-[40ch] leading-relaxed" style="color: var(--color-staff-muted)">
          {{ $t('staff.dispatchDesc') }}
        </p>
      </div>

      <div class="relative z-10 eyebrow">Poliklinik Ng</div>
    </aside>

    <section class="flex items-center justify-center px-6 py-10">
      <div class="w-full max-w-[400px] space-y-10">
        <div class="space-y-3 anim-rise">
          <div class="eyebrow"><span class="tick" style="background: var(--color-staff-accent)"></span>{{ $t('staff.authorise') }}</div>
          <h2 class="font-display text-5xl leading-[0.95]" style="color: var(--color-staff-ink)">{{ $t('staff.unlock') }}</h2>
          <p class="text-sm" style="color: var(--color-staff-muted)">{{ $t('staff.enterPassword') }}</p>
        </div>

        <form @submit.prevent="submit" class="space-y-6 anim-rise-2">
          <label class="block">
            <span class="field-label">{{ $t('staff.passwordPlaceholder') }}</span>
            <input v-model="pw" type="password" autocomplete="current-password" class="field" required />
          </label>
          <button :disabled="busy" class="btn-primary w-full">
            {{ busy ? $t('staff.verifying') : $t('staff.unlockConsole') }}
            <span v-if="!busy" aria-hidden>→</span>
          </button>
          <p v-if="error" class="text-sm" style="color: #e89b7a">
            <span class="eyebrow" style="color:#e89b7a">{{ $t('staff.denied') }} ·</span> {{ error }}
          </p>
        </form>

      </div>
    </section>
  </main>
</template>
