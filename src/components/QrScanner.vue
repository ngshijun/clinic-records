<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { Html5Qrcode } from 'html5-qrcode'

const emit = defineEmits<{ (e: 'decoded', raw: string): void; (e: 'error', msg: string): void }>()
const elId = 'qr-reader-' + Math.random().toString(36).slice(2)
const container = ref<HTMLDivElement | null>(null)
const state = reactive({ zoomSupported: false, zoom: 1 })
let scanner: Html5Qrcode | null = null
let track: MediaStreamTrack | null = null
let zoomMin = 1
let zoomMax = 1

function readZoomSetting(): number | undefined {
  if (!track) return undefined
  const s = track.getSettings() as MediaTrackSettings & { zoom?: number }
  return typeof s.zoom === 'number' ? s.zoom : undefined
}

async function configureTrack() {
  const video = container.value?.querySelector('video') as HTMLVideoElement | null
  const stream = video?.srcObject as MediaStream | null
  track = stream?.getVideoTracks()[0] ?? null
  if (!track) return

  try {
    await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] })
  } catch {}

  try {
    const caps = track.getCapabilities() as MediaTrackCapabilities & { zoom?: { min: number; max: number; step: number } }
    const current = readZoomSetting()
    // Only enable if both the capability AND a readable current zoom are present.
    // iOS Safari sometimes advertises caps.zoom without actually honoring it;
    // the settings.zoom readback is a better "actually wired up" signal.
    if (caps.zoom && caps.zoom.max > caps.zoom.min && current !== undefined) {
      zoomMin = caps.zoom.min
      zoomMax = caps.zoom.max
      state.zoom = current
      state.zoomSupported = true
    }
  } catch {}
}

async function setZoom(value: number) {
  if (!track || !state.zoomSupported) return
  const clamped = Math.min(zoomMax, Math.max(zoomMin, value))
  try {
    await track.applyConstraints({ advanced: [{ zoom: clamped } as MediaTrackConstraintSet] })
    // Verify the change actually took — some devices accept the constraint
    // without throwing but don't honor it. If the readback disagrees, the
    // feature isn't really supported on this device; disable going forward.
    const actual = readZoomSetting()
    if (actual === undefined || Math.abs(actual - clamped) > 0.01) {
      state.zoomSupported = false
      return
    }
    state.zoom = actual
  } catch {
    state.zoomSupported = false
  }
}

async function toggleZoom() {
  await setZoom(state.zoom > zoomMin ? zoomMin : Math.min(zoomMax, zoomMin * 2))
}

onMounted(async () => {
  if (!container.value) return
  container.value.id = elId
  scanner = new Html5Qrcode(elId)
  try {
    await scanner.start(
      { facingMode: 'environment' },
      { fps: 10 },
      (text) => emit('decoded', text),
      () => {},
    )
    await configureTrack()
  } catch (e: any) {
    emit('error', e?.message ?? 'Camera unavailable')
  }
})

onBeforeUnmount(async () => {
  try { await scanner?.stop(); await scanner?.clear() } catch {}
})

defineExpose({ state, toggleZoom })
</script>

<template>
  <div ref="container" class="w-full h-full bg-black overflow-hidden"></div>
</template>

<style scoped>
:deep(video) {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover;
  display: block;
}
</style>
