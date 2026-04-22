<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import QrScanner from '@/components/QrScanner.vue'

const router = useRouter()
const error = ref<string | null>(null)
const handled = ref(false)

function onDecoded(raw: string) {
  if (handled.value) return
  const hashIdx = raw.indexOf('#')
  if (hashIdx < 0) { error.value = 'QR does not contain a valid record.'; return }
  handled.value = true
  router.replace({ path: '/ingest', hash: raw.slice(hashIdx) })
}
</script>

<template>
  <main class="max-w-sm mx-auto p-4 space-y-4">
    <h1 class="text-xl font-semibold">Scan a QR</h1>
    <QrScanner @decoded="onDecoded" @error="(m) => error = m" />
    <p v-if="error" class="text-red-600 text-sm">{{ error }}</p>
    <router-link to="/home" class="text-sm underline">Cancel</router-link>
  </main>
</template>
