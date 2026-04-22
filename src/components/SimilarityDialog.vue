<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Record } from '@/stores/records'
import { MY_TIMEZONE, dateFmtLocale } from '@/lib/dates'

const props = defineProps<{ existing: Record }>()
const emit = defineEmits<{
  (e: 'replace'): void
  (e: 'keep-both'): void
  (e: 'cancel'): void
}>()

const { locale } = useI18n()
const recordedAt = computed(() => new Date(props.existing.created_at).toLocaleString(dateFmtLocale(locale.value), {
  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: MY_TIMEZONE,
}))
</script>

<template>
  <div class="fixed inset-0 bg-[rgba(28,43,42,0.55)] backdrop-blur-sm flex items-center justify-center p-4 z-50 anim-rise">
    <div class="paper-card max-w-md w-full p-7 relative brackets">
      <span class="br-tr"></span><span class="br-bl"></span>

      <div class="flex items-start justify-between mb-4">
        <div class="eyebrow" style="color: var(--color-accent)">{{ $t('ingest.duplicateWarning') }}</div>
        <div class="folio">§ 3.2</div>
      </div>

      <h3 class="font-display text-3xl leading-tight mb-3">
        {{ $t('ingest.similarExistsTitle') }}
      </h3>
      <p class="text-sm text-muted-app mb-5">
        {{ $t('ingest.recordedAt', { datetime: recordedAt }) }}
      </p>

      <div class="hairline p-4 mb-6 bg-paper-2">
        <div class="eyebrow mb-1">{{ $t('ingest.existingEntry') }}</div>
        <div class="font-display text-lg">{{ existing.name }}</div>
        <div class="text-xs text-muted-app mt-1">
          <span v-if="existing.kind === 'vaccination'">{{ $t('home.doseOf', { n: existing.dose_number, total: existing.total_doses }) }}</span>
          <span v-else>{{ $t('home.bloodTest') }}</span>
          <span class="mx-2">·</span>
          <span>{{ existing.performed_on }}</span>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <button class="btn-primary" @click="emit('replace')">{{ $t('ingest.replaceWithNew') }}</button>
        <button class="btn-ghost" @click="emit('keep-both')">{{ $t('ingest.keepBoth') }}</button>
        <button class="btn-danger text-sm" @click="emit('cancel')">{{ $t('common.cancel') }}</button>
      </div>
    </div>
  </div>
</template>
