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
    if (caps.zoom && caps.zoom.max > caps.zoom.min) {
      zoomMin = caps.zoom.min
      zoomMax = caps.zoom.max
      state.zoom = zoomMin
      state.zoomSupported = true
    }
  } catch {}
}

async function setZoom(value: number) {
  if (!track || !state.zoomSupported) return
  const clamped = Math.min(zoomMax, Math.max(zoomMin, value))
  try {
    await track.applyConstraints({ advanced: [{ zoom: clamped } as MediaTrackConstraintSet] })
    state.zoom = clamped
  } catch {}
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
