<script setup lang="ts">
import { useProfilesStore } from '@/stores/profiles'
const store = useProfilesStore()
</script>

<template>
  <select
    v-if="store.profiles.length > 1"
    :value="store.activeId ?? ''"
    @change="(e) => store.setActive((e.target as HTMLSelectElement).value)"
    class="border rounded px-2 py-1 text-sm"
  >
    <option v-for="p in store.profiles" :key="p.id" :value="p.id">{{ p.name }}</option>
  </select>
  <span v-else-if="store.active" class="text-sm font-medium">{{ store.active.name }}</span>
</template>
