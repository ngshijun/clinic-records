<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import StaffNav from '@/components/staff/StaffNav.vue'
import { fetchUpcomingReminders, type AdminReminder } from '@/lib/admin'
import { buildMonthGrid, bucketByDate, type MonthCell } from '@/lib/calendar'
import { dateInMY, todayLocalIso, dateFmtLocale, monthRangeMY } from '@/lib/dates'
import { reminderTitle } from '@/lib/reminders'
import { useDialog } from '@/lib/dialog'

const { t, locale } = useI18n()
const router = useRouter()
const dialog = useDialog()

const today = todayLocalIso() // YYYY-MM-DD in MY
const [ty, tm] = today.split('-').map(Number)
const viewYear = ref(ty)
const viewMonth = ref(tm) // 1-based
const selectedIso = ref(today)
const reminders = ref<AdminReminder[]>([])
const loading = ref(false)

const grid = computed<MonthCell[]>(() => buildMonthGrid(viewYear.value, viewMonth.value))
const buckets = computed(() => bucketByDate(reminders.value, (r) => dateInMY(r.due_at)))
const selectedReminders = computed<AdminReminder[]>(() => buckets.value.get(selectedIso.value) ?? [])

function countFor(iso: string): number {
  return buckets.value.get(iso)?.length ?? 0
}

const monthLabel = computed(() =>
  new Date(Date.UTC(viewYear.value, viewMonth.value - 1, 1)).toLocaleDateString(
    dateFmtLocale(locale.value),
    { month: 'long', year: 'numeric', timeZone: 'UTC' },
  ),
)

const weekdays = computed(() => {
  // Sun..Sat short names in the active locale.
  const fmt = new Intl.DateTimeFormat(dateFmtLocale(locale.value), { weekday: 'short', timeZone: 'UTC' })
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2024, 0, 7 + i)))) // 2024-01-07 is a Sunday
})

async function load() {
  loading.value = true
  try {
    const { from, to } = monthRangeMY(viewYear.value, viewMonth.value)
    reminders.value = await fetchUpcomingReminders(from, to)
  } catch (e) {
    await dialog.alertError(e, t('common.error'))
  } finally {
    loading.value = false
  }
}

function prev() {
  if (viewMonth.value === 1) { viewMonth.value = 12; viewYear.value-- } else viewMonth.value--
}
function next() {
  if (viewMonth.value === 12) { viewMonth.value = 1; viewYear.value++ } else viewMonth.value++
}
function goToday() {
  viewYear.value = ty
  viewMonth.value = tm
  selectedIso.value = today
}

function titleFor(r: AdminReminder): string {
  return reminderTitle(r, r.record, t)
}

watch([viewYear, viewMonth], load)
onMounted(load)
</script>

<template>
  <main class="min-h-dvh pb-20">
    <div class="max-w-[1100px] mx-auto px-6 lg:px-10 pt-6">
      <StaffNav />

      <header class="flex items-center justify-between gap-4 mb-6">
        <div>
          <div class="eyebrow"><span class="tick" style="background: var(--color-staff-accent)"></span>{{ $t('admin.calendarTitle') }}</div>
          <h1 class="font-display text-4xl leading-tight">{{ monthLabel }}</h1>
        </div>
        <div class="flex items-center gap-2 text-sm">
          <button class="btn-ghost !py-1.5 !px-3" @click="prev" aria-label="previous month">←</button>
          <button class="btn-ghost !py-1.5 !px-3" @click="goToday">{{ $t('admin.today') }}</button>
          <button class="btn-ghost !py-1.5 !px-3" @click="next" aria-label="next month">→</button>
        </div>
      </header>

      <div class="grid grid-cols-7 gap-px text-center eyebrow mb-1">
        <div v-for="w in weekdays" :key="w" class="py-1">{{ w }}</div>
      </div>
      <div class="grid grid-cols-7 gap-px">
        <button
          v-for="cell in grid"
          :key="cell.iso"
          type="button"
          @click="selectedIso = cell.iso"
          class="aspect-square p-1.5 flex flex-col items-start hairline relative transition-colors"
          :class="[
            cell.inMonth ? '' : 'opacity-40',
            selectedIso === cell.iso ? 'bg-[var(--color-staff-panel)]' : 'hover:bg-[var(--color-staff-panel)]',
          ]"
          :style="cell.iso === today ? 'outline: 1px solid var(--color-staff-accent); outline-offset: -1px;' : ''"
        >
          <span class="text-xs tabular-nums">{{ cell.day }}</span>
          <span
            v-if="countFor(cell.iso) > 0"
            class="mt-auto self-end font-mono-app text-[10px] px-1.5 py-0.5 rounded-full"
            style="background: var(--color-staff-accent); color: var(--color-staff-paper)"
          >{{ countFor(cell.iso) }}</span>
        </button>
      </div>

      <!-- Selected-day drill-down doubles as the agenda on narrow screens. -->
      <section class="mt-8">
        <h2 class="font-display text-2xl mb-3">{{ selectedIso }}</h2>
        <p v-if="selectedReminders.length === 0" class="text-sm text-[var(--color-staff-muted)]">{{ $t('admin.nothingDue') }}</p>
        <ul v-else class="space-y-2">
          <li v-for="r in selectedReminders" :key="r.id">
            <button
              type="button"
              class="w-full text-left paper-card p-4 flex items-center justify-between gap-3 hover:bg-[var(--color-staff-panel)]"
              @click="router.push(`/staff/patients/${r.profile_id}`)"
            >
              <div>
                <div class="font-display text-lg leading-tight">{{ titleFor(r) }}</div>
                <div class="text-xs text-[var(--color-staff-muted)] mt-0.5">{{ r.profile?.name }}<span v-if="r.profile?.nric"> · {{ r.profile.nric }}</span></div>
              </div>
              <span class="text-[var(--color-staff-accent)]">→</span>
            </button>
          </li>
        </ul>
      </section>
    </div>
  </main>
</template>
