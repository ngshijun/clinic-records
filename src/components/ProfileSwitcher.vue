<script setup lang="ts">
import { computed } from 'vue'
import { useProfilesStore } from '@/stores/profiles'
import AppDropdown from '@/components/AppDropdown.vue'

const store = useProfilesStore()
const options = computed(() => store.profiles.map(p => ({ value: p.id, label: p.name })))
</script>

<template>
  <div v-if="store.profiles.length > 1" class="inline-flex items-center gap-2 text-sm">
    <AppDropdown
      :model-value="store.activeId ?? ''"
      :options="options"
      trigger-class="hairline-b pl-0 pr-6 py-1 font-display text-lg"
      @update:model-value="(v) => store.setActive(v)"
    />
  </div>
</template>
