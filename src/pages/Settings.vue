<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { requestAndSubscribe, unsubscribeCurrent, isSubscribed } from '@/lib/push'

const auth = useAuthStore()
const router = useRouter()
const subbed = ref(false)
const busy = ref(false)
const isIosSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window.navigator as any).standalone

onMounted(async () => { subbed.value = await isSubscribed() })

async function toggle() {
  busy.value = true
  if (subbed.value) { await unsubscribeCurrent(); subbed.value = false }
  else { subbed.value = await requestAndSubscribe() }
  busy.value = false
}

async function logout() { await auth.signOut(); router.push('/') }

const upgradeEmail = ref('')
const upgradePassword = ref('')
const upgradeError = ref<string | null>(null)
const upgradeBusy = ref(false)
const upgraded = ref(false)

async function upgrade() {
  upgradeError.value = null
  upgradeBusy.value = true
  try {
    await auth.upgradeToEmail(upgradeEmail.value.trim(), upgradePassword.value)
    upgraded.value = true
    upgradeEmail.value = ''
    upgradePassword.value = ''
  } catch (e: any) {
    upgradeError.value = e.message ?? 'Could not create account'
  } finally {
    upgradeBusy.value = false
  }
}
</script>

<template>
  <main class="min-h-dvh pb-20">
    <header class="max-w-[720px] w-full mx-auto px-6 pt-8 flex items-center justify-between">
      <router-link to="/home" class="folio underline underline-offset-4 decoration-[var(--color-rule)]">← ledger</router-link>
      <div class="eyebrow">Settings · § IV</div>
    </header>

    <section class="max-w-[720px] w-full mx-auto px-6 py-10 space-y-12">
      <div class="space-y-2 anim-rise">
        <div class="eyebrow"><span class="tick"></span>Preferences</div>
        <h1 class="font-display text-5xl md:text-6xl leading-[0.95]">Settings.</h1>
        <p class="text-ink-2 text-sm max-w-[40ch]">Small adjustments to the way this app behaves on your device.</p>
      </div>

      <!-- Guest upgrade -->
      <section v-if="auth.isAnonymous" class="paper-card brackets p-7 anim-rise-2 relative" style="background: #faf0dc;">
        <span class="br-tr"></span><span class="br-bl"></span>
        <div class="eyebrow mb-2" style="color: var(--color-accent)">Chapter 1 · Save your work</div>
        <h2 class="font-display text-3xl leading-tight mb-2">Your ledger is <span class="font-display-wonk">borrowed</span>.</h2>
        <p class="text-sm text-ink-2 max-w-[50ch] mb-5">
          You're signed in as a guest. Add an email and password so your records survive a cleared browser, a new phone, or a borrowed laptop.
        </p>
        <p v-if="upgraded" class="paper-card p-4 text-sm">
          <span class="eyebrow" style="color: var(--color-moss)">✓ Saved</span><br/>
          Your ledger is now tied to your email. You can sign in from any device.
        </p>
        <form v-else @submit.prevent="upgrade" class="space-y-5">
          <div class="grid sm:grid-cols-2 gap-5">
            <label class="block">
              <span class="field-label">Email</span>
              <input v-model="upgradeEmail" type="email" required class="field" />
            </label>
            <label class="block">
              <span class="field-label">Password</span>
              <input v-model="upgradePassword" type="password" minlength="8" required class="field" />
            </label>
          </div>
          <div class="flex items-center gap-3">
            <button :disabled="upgradeBusy" class="btn-primary">
              {{ upgradeBusy ? 'Saving…' : 'Save account' }} <span v-if="!upgradeBusy" aria-hidden>→</span>
            </button>
            <p v-if="upgradeError" class="text-crimson text-sm">
              <span class="eyebrow" style="color:var(--color-crimson)">Error ·</span> {{ upgradeError }}
            </p>
          </div>
        </form>
      </section>

      <!-- Notifications -->
      <section class="space-y-5 anim-rise-3">
        <div class="flex items-baseline gap-3">
          <span class="folio">§ I</span>
          <h2 class="font-display text-2xl">Reminders</h2>
        </div>
        <p v-if="isIosSafari" class="paper-card p-4 text-sm" style="background: #faf0dc; border-color: var(--color-accent-soft);">
          <span class="eyebrow block mb-1" style="color: var(--color-accent)">iPhone note</span>
          Tap <strong>Share → Add to Home Screen</strong> first. Apple only permits web push for installed PWAs.
        </p>
        <div class="flex items-center justify-between hairline-t hairline-b py-5">
          <div>
            <div class="font-display text-xl">Push notifications</div>
            <div class="text-sm text-muted-app mt-0.5">
              <span v-if="subbed" class="inline-flex items-center gap-2">
                <span class="dot-pulse inline-block"></span> active on this device
              </span>
              <span v-else>delivered when a dose or test is due</span>
            </div>
          </div>
          <button :disabled="busy" class="btn-ghost" @click="toggle">
            {{ subbed ? 'Disable' : 'Enable' }}
          </button>
        </div>
      </section>

      <!-- Session -->
      <section class="space-y-5 anim-rise-4">
        <div class="flex items-baseline gap-3">
          <span class="folio">§ II</span>
          <h2 class="font-display text-2xl">Session</h2>
        </div>
        <div class="flex items-center justify-between hairline-t hairline-b py-5">
          <div>
            <div class="font-display text-xl">{{ auth.isAnonymous ? 'Guest session' : 'Signed in' }}</div>
            <div class="text-sm text-muted-app mt-0.5 break-all">
              {{ auth.user?.email ?? 'No email on file' }}
            </div>
          </div>
          <button class="btn-ghost" @click="logout">Sign out</button>
        </div>
      </section>

      <footer class="flex items-center justify-between pt-6 text-xs hairline-t">
        <div class="folio">PGN·CR / v1 · 2026</div>
        <div class="folio">end of settings</div>
      </footer>
    </section>
  </main>
</template>
