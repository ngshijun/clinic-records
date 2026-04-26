<script setup lang="ts">
import { onMounted, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import AppDialog from '@/components/AppDialog.vue'
import { refreshApp } from '@/lib/pwa'

const route = useRoute()

watchEffect(() => {
  const isStaff = typeof route.name === 'string' && route.name.startsWith('staff')
  document.body.classList.toggle('staff-theme', isStaff)
})

onMounted(() => {
  // Safety net: if a lazy-loaded chunk 404s after a deploy,
  // reload so the user picks up the new bundle.
  window.addEventListener('vite:preloadError', () => {
    refreshApp()
  })
})
</script>

<template>
  <router-view />
  <AppDialog />
</template>
