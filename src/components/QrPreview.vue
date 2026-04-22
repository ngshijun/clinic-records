<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import QRCode from 'qrcode'

const props = defineProps<{ text: string }>()
const canvas = ref<HTMLCanvasElement | null>(null)

async function draw() {
  if (!canvas.value || !props.text) return
  await QRCode.toCanvas(canvas.value, props.text, { width: 280, margin: 2, errorCorrectionLevel: 'M' })
}

onMounted(draw)
watch(() => props.text, draw)
</script>

<template>
  <canvas ref="canvas" class="bg-white" />
</template>
