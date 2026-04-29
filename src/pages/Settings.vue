<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { requestAndSubscribe, unsubscribeCurrent, isSubscribed } from '@/lib/push'
import { AVAILABLE_LOCALES, setLocale, type Locale } from '@/lib/i18n'
import { useDialog } from '@/lib/dialog'
import AppDropdown from '@/components/AppDropdown.vue'
import PasswordField from '@/components/PasswordField.vue'

const localeOptions = computed(() => AVAILABLE_LOCALES.map(l => ({ value: l.code, label: l.native })))

const auth = useAuthStore()
const router = useRouter()
const { locale, t } = useI18n()
const dialog = useDialog()

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

async function logout() {
  if (auth.isAnonymous) {
    const ok = await dialog.confirm({
      title: t('settings.discardGuestTitle'),
      body: t('settings.discardGuestBody'),
      confirmLabel: t('settings.discardGuestConfirm'),
      variant: 'danger',
    })
    if (!ok) return
    try {
      await auth.discardGuestSession()
    } catch (e) {
      await dialog.alertError(e, t('settings.discardGuestFailed'))
      return
    }
  } else {
    await auth.signOut()
  }
  router.push('/')
}

const upgradeEmail = ref('')
const upgradePassword = ref('')
const upgradeError = ref<string | null>(null)
const upgradeBusy = ref(false)
const upgraded = ref(false)

const version = __APP_VERSION__

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
    <header class="max-w-[720px] w-full mx-auto px-6 pt-8">
      <router-link to="/home" class="folio underline underline-offset-4 decoration-[var(--color-rule)]">{{ $t('settings.backToLedger') }}</router-link>
    </header>

    <section class="max-w-[720px] w-full mx-auto px-6 py-10 space-y-12">
      <div class="space-y-2 anim-rise">
        <div class="eyebrow"><span class="tick"></span>{{ $t('settings.eyebrow') }}</div>
        <h1 class="font-display text-5xl md:text-6xl leading-[0.95]">{{ $t('settings.title') }}</h1>
        <p class="text-ink-2 text-sm max-w-[40ch]">{{ $t('settings.description') }}</p>
      </div>

      <!-- Guest upgrade -->
      <section v-if="auth.isAnonymous" class="paper-card brackets p-7 anim-rise-2 relative" style="background: #faf0dc;">
        <h2 class="font-display text-3xl leading-tight mb-2">
          {{ $t('settings.yourLedgerIsPre') }}
          <span class="font-display-wonk">{{ $t('settings.yourLedgerIsWonk') }}</span>{{ $t('settings.yourLedgerIsSuffix') }}
        </h2>
        <p class="text-sm text-ink-2 max-w-[50ch] mb-5">{{ $t('settings.upgradeDescription') }}</p>
        <p v-if="upgraded" class="paper-card p-4 text-sm">
          <span class="eyebrow" style="color: var(--color-moss)">{{ $t('settings.savedHeadline') }}</span><br/>
          {{ $t('settings.savedNote') }}
        </p>
        <form v-else @submit.prevent="upgrade" class="space-y-5">
          <div class="grid sm:grid-cols-2 gap-5">
            <label class="block">
              <span class="field-label">{{ $t('auth.email') }}</span>
              <input v-model="upgradeEmail" type="email" required class="field" />
            </label>
            <label class="block">
              <span class="field-label">{{ $t('auth.password') }}</span>
              <PasswordField v-model="upgradePassword" minlength="8" required class="field" />
            </label>
          </div>
          <div class="flex items-center gap-3">
            <button :disabled="upgradeBusy" class="btn-primary">
              {{ upgradeBusy ? $t('settings.saving') : $t('settings.saveAccount') }} <span v-if="!upgradeBusy" aria-hidden>→</span>
            </button>
            <p v-if="upgradeError" class="text-crimson text-sm">
              <span class="eyebrow" style="color:var(--color-crimson)">{{ $t('common.error') }} ·</span> {{ upgradeError }}
            </p>
          </div>
        </form>
      </section>

      <!-- Notifications -->
      <section class="space-y-5 anim-rise-3">
        <h2 class="font-display text-2xl">{{ $t('settings.reminders') }}</h2>
        <p v-if="isIosSafari" class="paper-card p-4 text-sm" style="background: #faf0dc; border-color: var(--color-accent-soft);">
          <span class="eyebrow block mb-1" style="color: var(--color-accent)">{{ $t('settings.iPhoneNote') }}</span>
          {{ $t('settings.iPhoneNoteText') }}
        </p>
        <div class="flex items-center justify-between hairline-t hairline-b py-5">
          <div>
            <div class="font-display text-xl">{{ $t('settings.pushNotifications') }}</div>
            <div class="text-sm text-muted-app mt-0.5">
              <span v-if="subbed" class="inline-flex items-center gap-2">
                <span class="dot-pulse inline-block"></span> {{ $t('settings.activeOnDevice') }}
              </span>
              <span v-else>{{ $t('settings.deliveredWhenDue') }}</span>
            </div>
          </div>
          <button :disabled="busy" class="btn-ghost" @click="toggle">
            {{ subbed ? $t('settings.disable') : $t('settings.enable') }}
          </button>
        </div>
      </section>

      <!-- Language -->
      <section class="space-y-5 anim-rise-3">
        <h2 class="font-display text-2xl">{{ $t('settings.language') }}</h2>
        <div class="flex items-center justify-between hairline-t hairline-b py-5 gap-4">
          <div class="min-w-0">
            <div class="font-display text-xl">{{ AVAILABLE_LOCALES.find(l => l.code === locale)?.native }}</div>
            <div class="text-sm text-muted-app mt-0.5">{{ $t('settings.languageHint') }}</div>
          </div>
          <AppDropdown
            :model-value="locale"
            :options="localeOptions"
            :aria-label="$t('settings.language')"
            trigger-class="shrink-0 hairline-b pl-0 pr-7 py-1 font-display text-lg"
            @update:model-value="(v) => setLocale(v as Locale)"
          />
        </div>
      </section>

      <!-- Session -->
      <section class="space-y-5 anim-rise-4">
        <h2 class="font-display text-2xl">{{ $t('settings.session') }}</h2>
        <div class="flex items-center justify-between hairline-t hairline-b py-5">
          <div>
            <div class="font-display text-xl">{{ auth.isAnonymous ? $t('settings.guestSession') : $t('settings.signedIn') }}</div>
            <div class="text-sm text-muted-app mt-0.5 break-all">
              {{ auth.user?.email ?? $t('settings.noEmailOnFile') }}
            </div>
          </div>
          <button class="btn-ghost" @click="logout">{{ auth.isAnonymous ? $t('settings.discardGuestSession') : $t('auth.signOut') }}</button>
        </div>
      </section>

      <p class="folio text-xs opacity-50 text-right select-all">{{ version }}</p>

    </section>
  </main>
</template>
