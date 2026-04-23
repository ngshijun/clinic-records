<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import QrScanner from '@/components/QrScanner.vue'

const router = useRouter()
const { t } = useI18n()
const error = ref<string | null>(null)
const handled = ref(false)
const qr = ref<InstanceType<typeof QrScanner> | null>(null)
const zoomSupported = computed(() => qr.value?.state?.zoomSupported ?? false)
const zoomLabel = computed(() => ((qr.value?.state?.zoom ?? 1) > 1 ? '1×' : '2×'))

function onDecoded(raw: string) {
  if (handled.value) return
  const hashIdx = raw.indexOf('#')
  if (hashIdx < 0) { error.value = t('scan.invalid'); return }
  handled.value = true
  router.replace({ path: '/ingest', hash: raw.slice(hashIdx) })
}
</script>

<template>
  <main class="min-h-dvh flex flex-col">
    <header class="max-w-[560px] w-full mx-auto px-6 pt-8 flex items-center justify-between">
      <div class="eyebrow"><span class="tick"></span>{{ $t('scan.eyebrow') }}</div>
      <router-link to="/home" class="folio underline underline-offset-4 decoration-[var(--color-rule)]">{{ $t('common.back') }}</router-link>
    </header>

    <section class="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-8">
      <div class="text-center space-y-2 anim-rise">
        <div class="eyebrow">{{ $t('scan.viewfinder') }}</div>
        <h1 class="font-display text-4xl leading-tight">{{ $t('scan.title') }}</h1>
        <p class="text-sm text-muted-app max-w-[32ch]">{{ $t('scan.description') }}</p>
      </div>

      <div class="relative anim-rise-2 w-full flex flex-col items-center">
        <div class="relative w-full max-w-[440px] aspect-square">
          <div class="absolute inset-0 overflow-hidden">
            <QrScanner ref="qr" @decoded="onDecoded" @error="(m) => error = m" />
          </div>
          <svg class="absolute inset-0 pointer-events-none text-ink" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <g fill="none" stroke="currentColor" stroke-width="1.25" stroke-opacity="0.7" vector-effect="non-scaling-stroke">
              <polyline points="0,18 0,0 18,0" />
              <polyline points="82,0 100,0 100,18" />
              <polyline points="100,82 100,100 82,100" />
              <polyline points="18,100 0,100 0,82" />
            </g>
          </svg>
          <div class="absolute left-4 right-4 top-0 h-px bg-[var(--color-accent)] shadow-[0_0_10px_rgba(162,76,40,0.6)] scan-line" aria-hidden></div>
          <button
            v-if="zoomSupported"
            @click="qr?.toggleZoom()"
            :aria-label="t('scan.toggleZoom')"
            class="absolute bottom-4 right-4 px-3 py-1.5 text-xs font-mono-app tabular-nums rounded-full transition-opacity hover:opacity-100"
            style="background: var(--color-paper); color: var(--color-ink); border: 1px solid var(--color-ink); opacity: 0.88;"
          >
            {{ zoomLabel }}
          </button>
        </div>
        <div class="text-center mt-4 folio">
          <span class="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-moss)] mr-2 align-middle dot-pulse"></span>
          {{ $t('scan.seeking') }}
        </div>
      </div>

      <p v-if="error" class="text-crimson text-sm max-w-[32ch] text-center">
        <span class="eyebrow" style="color:var(--color-crimson)">{{ $t('common.error') }} ·</span> {{ error }}
      </p>
    </section>

    <footer class="max-w-[560px] w-full mx-auto px-6 pb-6 flex items-center justify-end text-xs">
      <router-link to="/home" class="btn-ghost !py-2 !px-4">{{ $t('common.cancel') }}</router-link>
    </footer>
  </main>
</template>

<style scoped>
.scan-line { animation: sweep 2.6s ease-in-out infinite; }
@keyframes sweep {
  0% { top: 8%; opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { top: 92%; opacity: 0; }
}
</style>
