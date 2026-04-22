<script setup lang="ts">
import { watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import AppDialog from '@/components/AppDialog.vue'

const route = useRoute()

watchEffect(() => {
  const isStaff = typeof route.name === 'string' && route.name.startsWith('staff')
  document.body.classList.toggle('staff-theme', isStaff)
})
</script>

<template>
  <router-view />
  <AppDialog />
</template>
