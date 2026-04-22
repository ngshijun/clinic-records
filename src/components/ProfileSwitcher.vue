<script setup lang="ts">
import { useProfilesStore } from '@/stores/profiles'
const store = useProfilesStore()
</script>

<template>
  <label v-if="store.profiles.length > 1" class="inline-flex items-center gap-2 text-sm">
    <span class="eyebrow">Reader</span>
    <span class="relative">
      <select
        :value="store.activeId ?? ''"
        @change="(e) => store.setActive((e.target as HTMLSelectElement).value)"
        class="appearance-none bg-transparent hairline-b pl-0 pr-6 py-1 font-display text-lg focus:outline-none focus:border-ink cursor-pointer"
      >
        <option v-for="p in store.profiles" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>
      <span aria-hidden class="absolute right-0 top-1/2 -translate-y-1/2 text-xs text-muted-app pointer-events-none">▾</span>
    </span>
  </label>
  <span v-else-if="store.active" class="inline-flex items-center gap-2 text-sm">
    <span class="eyebrow">Reader</span>
    <span class="font-display text-lg">{{ store.active.name }}</span>
  </span>
</template>
