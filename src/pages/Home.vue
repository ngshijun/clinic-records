<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useProfilesStore } from '@/stores/profiles'
import { useRecordsStore } from '@/stores/records'
import { useAuthStore } from '@/stores/auth'
import ProfileSwitcher from '@/components/ProfileSwitcher.vue'

const profiles = useProfilesStore()
const records = useRecordsStore()
const auth = useAuthStore()
const dismissed = ref(localStorage.getItem('guest_nudge_dismissed') === '1')
function dismiss() {
  localStorage.setItem('guest_nudge_dismissed', '1')
  dismissed.value = true
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
const installPrompt = ref<BeforeInstallPromptEvent | null>(null)
const installDismissed = ref(localStorage.getItem('install_dismissed') === '1')
function onBeforeInstallPrompt(e: Event) {
  e.preventDefault()
  installPrompt.value = e as BeforeInstallPromptEvent
}
async function doInstall() {
  if (!installPrompt.value) return
  await installPrompt.value.prompt()
  const { outcome } = await installPrompt.value.userChoice
  if (outcome === 'accepted') installPrompt.value = null
}
function dismissInstall() {
  localStorage.setItem('install_dismissed', '1')
  installDismissed.value = true
}

async function refresh() {
  if (profiles.activeId) await records.fetchForProfile(profiles.activeId)
}

onMounted(async () => {
  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  await profiles.fetchAll()
  await refresh()
})
onBeforeUnmount(() => {
  window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
})
watch(() => profiles.activeId, refresh)

const ledgerName = computed(() => profiles.active?.name ?? 'Your')
const totalCount = computed(() => records.records.length)
const vaccinationCount = computed(() => records.records.filter(r => r.kind === 'vaccination').length)
const testCount = computed(() => records.records.filter(r => r.kind === 'blood_test').length)

// Group records by year for the "history" section
const recordsByYear = computed(() => {
  const groups: { year: string; items: typeof records.records }[] = []
  for (const r of records.records) {
    const y = r.performed_on.slice(0, 4)
    const last = groups[groups.length - 1]
    if (last && last.year === y) last.items.push(r)
    else groups.push({ year: y, items: [r] })
  }
  return groups
})

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
function formatMonthDay(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}
function relativeDue(iso: string) {
  const days = Math.round((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (days < -1) return `${Math.abs(days)} days ago`
  if (days === -1) return 'yesterday'
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days <= 30) return `in ${days} days`
  if (days <= 60) return `in ${Math.round(days / 7)} weeks`
  return `in ${Math.round(days / 30)} months`
}
</script>

<template>
  <main class="min-h-dvh pb-36">
    <!-- Masthead -->
    <header class="max-w-[1100px] mx-auto px-6 lg:px-10 pt-6 pb-4 anim-rise">
      <div class="flex items-center justify-between gap-4 hairline-b pb-3">
        <div class="eyebrow"><span class="tick"></span>Clinic Records · Poliklinik Ng</div>
        <ProfileSwitcher />
      </div>
    </header>

    <div class="max-w-[1100px] mx-auto px-6 lg:px-10 space-y-6">
      <!-- Banners -->
      <div v-if="(auth.isAnonymous && !dismissed) || (installPrompt && !installDismissed)" class="space-y-3 anim-rise-2">
        <div v-if="auth.isAnonymous && !dismissed"
          class="paper-card brackets p-4 flex items-start gap-4">
          <span class="br-tr"></span><span class="br-bl"></span>
          <div class="flex-1">
            <div class="eyebrow mb-1">Guest mode</div>
            <div class="text-sm text-ink-2 leading-relaxed">
              Records live only on this device. Add credentials in Settings to carry them elsewhere.
            </div>
          </div>
          <div class="flex flex-col gap-2 shrink-0 text-xs">
            <router-link to="/settings" class="underline underline-offset-4 decoration-[var(--color-accent)] text-ink">Set up →</router-link>
            <button @click="dismiss" class="text-muted-app">Not now</button>
          </div>
        </div>

        <div v-if="installPrompt && !installDismissed"
          class="paper-card p-4 flex items-center justify-between gap-4">
          <div>
            <div class="eyebrow mb-1">Install to Home Screen</div>
            <div class="text-sm text-ink-2">Faster access and receive reminders when a dose is due.</div>
          </div>
          <div class="flex gap-3 items-center shrink-0">
            <button class="text-xs text-muted-app" @click="dismissInstall">Not now</button>
            <button class="btn-primary !py-2 !px-4 text-sm" @click="doInstall">Install</button>
          </div>
        </div>
      </div>

      <!-- Compact hero + inline stats -->
      <section class="flex flex-wrap items-end justify-between gap-4 anim-rise-2 pb-1">
        <div class="min-w-0">
          <div class="eyebrow mb-1">Your ledger</div>
          <h1 class="font-display leading-[0.95] text-[clamp(1.75rem,4vw,2.5rem)]">
            {{ ledgerName }}<span class="text-accent">’s</span>
            <span class="font-display-wonk">health record.</span>
          </h1>
        </div>
        <dl class="flex items-baseline gap-5 tabular-nums shrink-0">
          <div class="flex items-baseline gap-1.5">
            <dd class="font-display text-2xl">{{ String(totalCount).padStart(2, '0') }}</dd>
            <dt class="eyebrow">total</dt>
          </div>
          <div class="flex items-baseline gap-1.5">
            <dd class="font-display text-2xl">{{ String(vaccinationCount).padStart(2, '0') }}</dd>
            <dt class="eyebrow">vax</dt>
          </div>
          <div class="flex items-baseline gap-1.5">
            <dd class="font-display text-2xl">{{ String(testCount).padStart(2, '0') }}</dd>
            <dt class="eyebrow">tests</dt>
          </div>
        </dl>
      </section>

      <div class="rule-line"></div>

      <!-- Upcoming -->
      <section class="space-y-5 anim-rise-3">
        <div class="flex items-baseline justify-between">
          <div class="flex items-baseline gap-3">
            <span class="folio">I.</span>
            <h2 class="font-display text-2xl">Upcoming</h2>
          </div>
          <span class="eyebrow">
            <span v-if="records.reminders.length > 0" class="dot-pulse inline-block mr-2 align-middle"></span>
            {{ records.reminders.length }} pending
          </span>
        </div>

        <div v-if="records.reminders.length === 0" class="paper-card p-8 text-center">
          <p class="font-display-wonk text-2xl text-ink-2">No reminders in view.</p>
          <p class="text-sm text-muted-app mt-2">When a follow-up is due, it will surface here.</p>
        </div>

        <ul v-else class="grid sm:grid-cols-2 gap-4">
          <li v-for="r in records.reminders" :key="r.id" class="paper-card p-5 brackets">
            <span class="br-tr"></span><span class="br-bl"></span>
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="eyebrow mb-2">Reminder · {{ r.kind.replace('_', ' ') }}</div>
                <h3 class="font-display text-xl leading-tight">{{ r.title }}</h3>
              </div>
              <span class="font-mono-app text-xs text-accent whitespace-nowrap">{{ relativeDue(r.due_at) }}</span>
            </div>
            <div class="flex items-center justify-between pt-4 mt-4 hairline-t text-xs">
              <span class="folio">due {{ formatDate(r.due_at) }}</span>
              <router-link v-if="r.record_id" :to="`/records/${r.record_id}`" class="underline underline-offset-4 decoration-[var(--color-accent)]">
                view record →
              </router-link>
            </div>
          </li>
        </ul>
      </section>

      <!-- History -->
      <section class="space-y-6 pt-4 anim-rise-4">
        <div class="flex items-baseline justify-between">
          <div class="flex items-baseline gap-3">
            <span class="folio">II.</span>
            <h2 class="font-display text-2xl">History</h2>
          </div>
          <span class="eyebrow">{{ totalCount }} entries</span>
        </div>

        <div v-if="totalCount === 0" class="paper-card p-10 text-center">
          <div class="eyebrow mb-3">Chapter I · The first page</div>
          <p class="font-display text-3xl leading-snug max-w-[32ch] mx-auto">
            An empty page is still a <span class="font-display-wonk">beginning</span>.
          </p>
          <p class="text-sm text-muted-app mt-3 max-w-[40ch] mx-auto">
            Tap the Scan button below to read your first QR from the clinic.
          </p>
        </div>

        <div v-else class="space-y-10">
          <div v-for="group in recordsByYear" :key="group.year" class="grid sm:grid-cols-[120px_1fr] gap-6">
            <div class="sm:text-right">
              <div class="font-display text-5xl leading-none tabular-nums">{{ group.year }}</div>
              <div class="eyebrow mt-2">{{ group.items.length }} record{{ group.items.length > 1 ? 's' : '' }}</div>
            </div>
            <ul class="divide-y divide-[var(--color-rule-soft)] hairline-t hairline-b">
              <li v-for="r in group.items" :key="r.id">
                <router-link
                  :to="`/records/${r.id}`"
                  class="group grid grid-cols-[auto_1fr_auto] items-baseline gap-4 py-4 px-1 hover:bg-[var(--color-paper-2)] transition-colors"
                >
                  <span class="folio w-[54px]">{{ formatMonthDay(r.performed_on) }}</span>
                  <div>
                    <div class="font-display text-lg leading-tight">{{ r.name }}</div>
                    <div class="text-xs text-muted-app mt-0.5">
                      <span v-if="r.kind === 'vaccination'">Dose {{ r.dose_number }} of {{ r.total_doses }}</span>
                      <span v-else>Blood test</span>
                      <span class="mx-2">·</span>
                      <span class="uppercase tracking-wider">{{ r.kind.replace('_', ' ') }}</span>
                    </div>
                  </div>
                  <span class="text-accent opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                </router-link>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>

    <!-- Scan FAB + nav bar -->
    <nav class="fixed bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-0 paper-card !shadow-xl rounded-none">
      <router-link to="/profiles" class="px-5 py-3 text-xs eyebrow hover:text-ink">Profiles</router-link>
      <div class="w-px h-6 bg-[var(--color-rule)]"></div>
      <router-link to="/scan" class="px-6 py-3 bg-ink text-paper font-display text-lg flex items-center gap-2">
        Scan <span aria-hidden>↗</span>
      </router-link>
      <div class="w-px h-6 bg-[var(--color-rule)]"></div>
      <router-link to="/settings" class="px-5 py-3 text-xs eyebrow hover:text-ink">Settings</router-link>
    </nav>
  </main>
</template>

<style scoped>
.bg-ink { background: var(--color-ink); color: var(--color-paper); }
</style>
