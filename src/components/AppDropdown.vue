<script setup lang="ts" generic="T extends string">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

interface Option { value: T; label: string }

const props = defineProps<{
  modelValue: T | '' | null | undefined
  options: Option[]
  placeholder?: string
  ariaLabel?: string
  triggerClass?: string
}>()

const emit = defineEmits<{ (e: 'update:modelValue', v: T): void }>()

const open = ref(false)
const hover = ref(0)
const rootEl = ref<HTMLElement | null>(null)
const btnEl = ref<HTMLButtonElement | null>(null)

const currentLabel = computed(() => {
  const o = props.options.find(x => x.value === props.modelValue)
  return o?.label ?? ''
})

function toggle() {
  open.value = !open.value
  if (open.value) {
    const i = props.options.findIndex(x => x.value === props.modelValue)
    hover.value = i >= 0 ? i : 0
  }
}

function pick(o: Option) {
  emit('update:modelValue', o.value)
  open.value = false
  btnEl.value?.focus()
}

function onKey(e: KeyboardEvent) {
  if (!open.value) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggle()
    }
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    hover.value = (hover.value + 1) % props.options.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    hover.value = (hover.value - 1 + props.options.length) % props.options.length
  } else if (e.key === 'Enter' && props.options.length > 0) {
    e.preventDefault()
    pick(props.options[hover.value])
  } else if (e.key === 'Escape') {
    e.preventDefault()
    open.value = false
    btnEl.value?.focus()
  }
}

function onDocClick(e: MouseEvent) {
  if (!rootEl.value) return
  if (!rootEl.value.contains(e.target as Node)) open.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocClick, { capture: true })
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick, { capture: true })
})

watch(() => props.options, () => { hover.value = 0 })
</script>

<template>
  <div ref="rootEl" class="relative inline-block">
    <button
      ref="btnEl"
      type="button"
      :aria-label="ariaLabel"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="toggle"
      @keydown="onKey"
      :class="['inline-flex items-center gap-2 cursor-pointer focus:outline-none', triggerClass]"
    >
      <span class="truncate">{{ currentLabel || placeholder }}</span>
      <span aria-hidden class="text-[0.65em] opacity-70 ml-auto">▾</span>
    </button>
    <ul
      v-if="open"
      role="listbox"
      class="app-dropdown-menu absolute top-full mt-1 z-20 min-w-full max-h-60 overflow-auto hairline shadow-xl left-0"
    >
      <li
        v-for="(o, i) in options"
        :key="o.value"
        role="option"
        :aria-selected="o.value === modelValue"
        :class="['app-dropdown-item px-4 py-2.5 cursor-pointer transition-colors whitespace-nowrap', i === hover ? 'is-active' : '']"
        @mousedown.prevent="pick(o)"
        @mouseenter="hover = i"
      >{{ o.label }}</li>
    </ul>
  </div>
</template>

<style>
.app-dropdown-menu {
  background: var(--color-paper-2);
  color: var(--color-ink);
  border-color: var(--color-rule);
}
.app-dropdown-item.is-active,
.app-dropdown-item:hover {
  background: var(--color-accent);
  color: var(--color-paper);
}
.staff-theme .app-dropdown-menu {
  background: var(--color-staff-panel);
  color: var(--color-staff-ink);
  border-color: var(--color-staff-rule);
}
.staff-theme .app-dropdown-item.is-active,
.staff-theme .app-dropdown-item:hover {
  background: var(--color-staff-accent);
  color: var(--color-staff-paper);
}
</style>
