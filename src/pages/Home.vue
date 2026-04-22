<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProfilesStore } from '@/stores/profiles'
import { useRecordsStore, type Reminder } from '@/stores/records'
import { MY_TIMEZONE } from '@/lib/dates'
import { useAuthStore } from '@/stores/auth'
import ProfileSwitcher from '@/components/ProfileSwitcher.vue'

const profiles = useProfilesStore()
const records = useRecordsStore()
const auth = useAuthStore()
const { t, locale } = useI18n()

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

const ledgerName = computed(() => profiles.active?.name ?? '')
const totalCount = computed(() => records.records.length)
const vaccinationCount = computed(() => records.records.filter(r => r.kind === 'vaccination').length)
const testCount = computed(() => records.records.filter(r => r.kind === 'blood_test').length)

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

function dateFmtLocale(): string {
  return locale.value === 'zh' ? 'zh-CN' : locale.value === 'ms' ? 'ms-MY' : 'en-GB'
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString(dateFmtLocale(), {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: MY_TIMEZONE,
  })
}
function formatMonthDay(d: string) {
  return new Date(d).toLocaleDateString(dateFmtLocale(), {
    day: '2-digit', month: 'short', timeZone: MY_TIMEZONE,
  })
}
function relativeDue(iso: string) {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: MY_TIMEZONE })
  const [dy, dm, dd] = fmt.format(new Date(iso)).split('-').map(Number)
  const [ny, nm, nd] = fmt.format(new Date()).split('-').map(Number)
  const days = Math.round(
    (Date.UTC(dy, dm - 1, dd) - Date.UTC(ny, nm - 1, nd)) / 86400000,
  )
  if (days < -1) return t('home.rel_daysAgo', { n: Math.abs(days) })
  if (days === -1) return t('home.rel_yesterday')
  if (days === 0) return t('home.rel_today')
  if (days === 1) return t('home.rel_tomorrow')
  if (days <= 30) return t('home.rel_inDays', { n: days })
  if (days <= 60) return t('home.rel_inWeeks', { n: Math.round(days / 7) })
  return t('home.rel_inMonths', { n: Math.round(days / 30) })
}
function reminderKindLabel(k: string) {
  if (k === 'next_dose') return t('home.kindNextDose')
  if (k === 'followup_test') return t('home.kindFollowupTest')
  return k.replace('_', ' ')
}
function reminderTitle(r: Reminder) {
  const rec = records.records.find(x => x.id === r.record_id)
  if (rec) {
    if (r.kind === 'next_dose' && rec.kind === 'vaccination' && rec.dose_number != null) {
      return t('home.nextDoseTitle', { name: rec.name, n: rec.dose_number + 1 })
    }
    if (r.kind === 'followup_test') {
      return t('home.followupTitle', { name: rec.name })
    }
  }
  if (r.kind === 'followup_test' && r.name) {
    return t('home.followupTitle', { name: r.name })
  }
  return r.title
}
function recordKindLabel(k: string) {
  return k === 'vaccination' ? t('home.kindVaccination') : t('home.kindBloodTest')
}
function recordsWord(n: number) {
  return n === 1 ? t('home.recordOne', { count: n }) : t('home.recordMany', { count: n })
}
</script>

<template>
  <main class="min-h-dvh pb-36">
    <!-- Masthead -->
    <header class="max-w-[1100px] mx-auto px-6 lg:px-10 pt-6 pb-4 anim-rise">
      <div class="flex items-center justify-between gap-4 hairline-b pb-3">
        <div class="eyebrow"><span class="tick"></span>{{ $t('brand.labelShort') }}</div>
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
            <div class="eyebrow mb-1">{{ $t('home.guestMode') }}</div>
            <div class="text-sm text-ink-2 leading-relaxed">{{ $t('home.guestBannerText') }}</div>
          </div>
          <div class="flex flex-col gap-2 shrink-0 text-xs">
            <router-link to="/settings" class="underline underline-offset-4 decoration-[var(--color-accent)] text-ink">{{ $t('home.setUp') }}</router-link>
            <button @click="dismiss" class="text-muted-app">{{ $t('common.notNow') }}</button>
          </div>
        </div>

        <div v-if="installPrompt && !installDismissed"
          class="paper-card p-4 flex items-center justify-between gap-4">
          <div>
            <div class="eyebrow mb-1">{{ $t('home.installBanner') }}</div>
            <div class="text-sm text-ink-2">{{ $t('home.installText') }}</div>
          </div>
          <div class="flex gap-3 items-center shrink-0">
            <button class="text-xs text-muted-app" @click="dismissInstall">{{ $t('common.notNow') }}</button>
            <button class="btn-primary !py-2 !px-4 text-sm" @click="doInstall">{{ $t('home.install') }}</button>
          </div>
        </div>
      </div>

      <!-- Hero / stats -->
      <section class="grid md:grid-cols-[1.3fr_1fr] gap-6 items-end anim-rise-2">
        <div class="space-y-2">
          <div class="eyebrow">{{ $t('home.yourLedger') }}</div>
          <h1 class="font-display leading-[0.92] text-[clamp(2.5rem,6vw,4.25rem)]">
            <span class="block">{{ ledgerName }}<span class="text-accent">’s</span></span>
            <span class="block font-display-wonk">{{ $t('home.healthRecord') }}</span>
          </h1>
          <p class="text-ink-2 text-sm max-w-[42ch] pt-1">
            {{ totalCount > 0 ? $t('home.catalogueHasRecords') : $t('home.catalogueEmpty') }}
          </p>
        </div>
        <dl class="grid grid-cols-3 gap-0 hairline-t pt-3">
          <div>
            <dt class="eyebrow">{{ $t('home.total') }}</dt>
            <dd class="font-display text-3xl tabular-nums leading-tight">{{ String(totalCount).padStart(2, '0') }}</dd>
          </div>
          <div class="pl-4 border-l border-[var(--color-rule-soft)]">
            <dt class="eyebrow">{{ $t('home.vaccines') }}</dt>
            <dd class="font-display text-3xl tabular-nums leading-tight">{{ String(vaccinationCount).padStart(2, '0') }}</dd>
          </div>
          <div class="pl-4 border-l border-[var(--color-rule-soft)]">
            <dt class="eyebrow">{{ $t('home.tests') }}</dt>
            <dd class="font-display text-3xl tabular-nums leading-tight">{{ String(testCount).padStart(2, '0') }}</dd>
          </div>
        </dl>
      </section>

      <!-- Upcoming -->
      <section class="space-y-5 anim-rise-3">
        <div class="flex items-baseline justify-between">
          <h2 class="font-display text-2xl">{{ $t('home.upcoming') }}</h2>
          <span class="eyebrow">
            <span v-if="records.reminders.length > 0" class="dot-pulse inline-block mr-2 align-middle"></span>
            {{ $t('home.pendingCount', { count: records.reminders.length }) }}
          </span>
        </div>

        <div v-if="records.reminders.length === 0" class="paper-card p-8 text-center">
          <p class="font-display-wonk text-2xl text-ink-2">{{ $t('home.noReminders') }}</p>
          <p class="text-sm text-muted-app mt-2">{{ $t('home.noRemindersHint') }}</p>
        </div>

        <ul v-else class="grid sm:grid-cols-2 gap-4">
          <li v-for="r in records.reminders" :key="r.id" class="paper-card p-5 brackets">
            <span class="br-tr"></span><span class="br-bl"></span>
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="eyebrow mb-2">{{ $t('home.reminderKind') }} · {{ reminderKindLabel(r.kind) }}</div>
                <h3 class="font-display text-xl leading-tight">{{ reminderTitle(r) }}</h3>
              </div>
              <span class="font-mono-app text-xs text-accent whitespace-nowrap">{{ relativeDue(r.due_at) }}</span>
            </div>
            <div class="flex items-center justify-between pt-4 mt-4 hairline-t text-xs">
              <span class="folio">{{ $t('home.dueAround', { date: formatDate(r.due_at) }) }}</span>
              <router-link v-if="r.record_id" :to="`/records/${r.record_id}`" class="underline underline-offset-4 decoration-[var(--color-accent)]">
                {{ $t('home.viewRecord') }}
              </router-link>
            </div>
          </li>
        </ul>
      </section>

      <!-- History -->
      <section class="space-y-6 pt-4 anim-rise-4">
        <div class="flex items-baseline justify-between">
          <h2 class="font-display text-2xl">{{ $t('home.history') }}</h2>
          <span class="eyebrow">{{ $t('home.entriesCount', { count: totalCount }) }}</span>
        </div>

        <div v-if="totalCount === 0" class="paper-card p-10 text-center">
          <div class="eyebrow mb-3">{{ $t('home.emptyChapter') }}</div>
          <p class="font-display text-3xl leading-snug max-w-[32ch] mx-auto">
            {{ $t('home.emptyTitlePre') }} <span class="font-display-wonk">{{ $t('home.emptyTitleWonk') }}</span>.
          </p>
          <p class="text-sm text-muted-app mt-3 max-w-[40ch] mx-auto">{{ $t('home.emptyHint') }}</p>
        </div>

        <div v-else class="space-y-10">
          <div v-for="group in recordsByYear" :key="group.year" class="grid sm:grid-cols-[120px_1fr] gap-6">
            <div class="sm:text-right">
              <div class="font-display text-5xl leading-none tabular-nums">{{ group.year }}</div>
              <div class="eyebrow mt-2">{{ recordsWord(group.items.length) }}</div>
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
                      <span v-if="r.kind === 'vaccination'">{{ $t('home.doseOf', { n: r.dose_number, total: r.total_doses }) }}</span>
                      <span v-else>{{ $t('home.bloodTest') }}</span>
                      <span class="mx-2">·</span>
                      <span class="uppercase tracking-wider">{{ recordKindLabel(r.kind) }}</span>
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
      <router-link to="/profiles" class="px-5 py-3 text-xs eyebrow hover:text-ink whitespace-nowrap">{{ $t('home.navProfiles') }}</router-link>
      <div class="w-px h-6 bg-[var(--color-rule)]"></div>
      <router-link to="/scan" class="px-6 py-3 bg-ink text-paper font-display text-lg flex items-center gap-2 whitespace-nowrap">
        {{ $t('home.navScan') }} <span aria-hidden>↗</span>
      </router-link>
      <div class="w-px h-6 bg-[var(--color-rule)]"></div>
      <router-link to="/settings" class="px-5 py-3 text-xs eyebrow hover:text-ink whitespace-nowrap">{{ $t('home.navSettings') }}</router-link>
    </nav>
  </main>
</template>

<style scoped>
.bg-ink { background: var(--color-ink); color: var(--color-paper); }
</style>
