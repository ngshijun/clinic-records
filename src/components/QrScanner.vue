<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Html5Qrcode } from 'html5-qrcode'

const emit = defineEmits<{ (e: 'decoded', raw: string): void; (e: 'error', msg: string): void }>()
const elId = 'qr-reader-' + Math.random().toString(36).slice(2)
const container = ref<HTMLDivElement | null>(null)
let scanner: Html5Qrcode | null = null

onMounted(async () => {
  if (!container.value) return
  container.value.id = elId
  scanner = new Html5Qrcode(elId)
  try {
    await scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 240, height: 240 } },
      (text) => emit('decoded', text),
      () => {},
    )
  } catch (e: any) {
    emit('error', e?.message ?? 'Camera unavailable')
  }
})

onBeforeUnmount(async () => {
  try { await scanner?.stop(); await scanner?.clear() } catch {}
})
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
