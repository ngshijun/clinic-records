<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { verifyPassword, markStaffUnlocked, isStaffUnlocked } from '@/lib/staff-auth'

const router = useRouter()
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
  if (!ok) { error.value = 'Incorrect password'; return }
  markStaffUnlocked()
  router.replace('/staff/generate')
}
</script>

<template>
  <main class="min-h-dvh grid lg:grid-cols-[1fr_1fr]">
    <!-- Instrument panel left side -->
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

      <header class="flex items-start justify-between relative z-10">
        <div class="eyebrow"><span class="tick" style="background: var(--color-staff-accent)"></span>Staff console</div>
        <div class="folio">Node · 01 / staff</div>
      </header>

      <div class="relative z-10 space-y-6">
        <h1 class="font-display text-[clamp(3rem,7vw,5rem)] leading-[0.92]" style="color: var(--color-staff-ink)">
          Clinic<br/>
          <span class="font-display-wonk" style="color: var(--color-staff-accent)">dispatch</span>
        </h1>
        <p class="text-[15px] max-w-[40ch] leading-relaxed" style="color: var(--color-staff-muted)">
          A small instrument for printing patient QR codes. Restricted to staff on this tablet.
        </p>
      </div>

      <footer class="relative z-10 flex items-end justify-between text-[11px]">
        <div class="eyebrow space-y-1">
          <div>Poliklinik Ng</div>
          <div>Version I · 2026</div>
        </div>
        <div class="folio">PGN·CR / s</div>
      </footer>
    </aside>

    <!-- Login form -->
    <section class="flex items-center justify-center px-6 py-10">
      <div class="w-full max-w-[400px] space-y-10">
        <div class="space-y-3 anim-rise">
          <div class="eyebrow"><span class="tick" style="background: var(--color-staff-accent)"></span>Authorise</div>
          <h2 class="font-display text-5xl leading-[0.95]" style="color: var(--color-staff-ink)">Unlock.</h2>
          <p class="text-sm" style="color: var(--color-staff-muted)">Enter the clinic password to continue.</p>
        </div>

        <form @submit.prevent="submit" class="space-y-6 anim-rise-2">
          <label class="block">
            <span class="field-label">Password</span>
            <input v-model="pw" type="password" autocomplete="current-password" class="field" required />
          </label>
          <button :disabled="busy" class="btn-primary w-full">
            {{ busy ? 'Verifying…' : 'Unlock console' }}
            <span v-if="!busy" aria-hidden>→</span>
          </button>
          <p v-if="error" class="text-sm" style="color: #e89b7a">
            <span class="eyebrow" style="color:#e89b7a">Denied ·</span> {{ error }}
          </p>
        </form>

        <p class="text-[11px] folio pt-6 hairline-t">
          ⓘ unauthorised access attempts are logged locally.
        </p>
      </div>
    </section>
  </main>
</template>
