<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { COUNTRIES, flagFor, nameFor } from '@/lib/countries'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()
const { t } = useI18n()

const open = ref(false)
const hover = ref(0)
const search = ref('')
const rootEl = ref<HTMLElement | null>(null)
const btnEl = ref<HTMLButtonElement | null>(null)
const menuEl = ref<HTMLDivElement | null>(null)
const searchEl = ref<HTMLInputElement | null>(null)
const triggerRect = ref<DOMRect | null>(null)
const menuLeft = ref<number | null>(null)

const currentLabel = computed(() => {
  const code = props.modelValue
  if (!code) return ''
  return `${flagFor(code)} ${nameFor(code)}`
})

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return COUNTRIES
  // Match either the country name or the ISO code itself — useful when a
  // staff member knows the code (e.g. "MY") but not the spelling variant.
  return COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
  )
})

watch(filtered, () => { hover.value = 0 })

function refreshRect() {
  triggerRect.value = btnEl.value?.getBoundingClientRect() ?? null
}

async function toggle() {
  open.value = !open.value
  if (open.value) {
    refreshRect()
    menuLeft.value = null
    search.value = ''
    hover.value = Math.max(0, filtered.value.findIndex(c => c.code === props.modelValue))
    await nextTick()
    searchEl.value?.focus()
  }
}

watch(open, async (v) => {
  if (!v) return
  await nextTick()
  const r = triggerRect.value
  const m = menuEl.value
  if (!r || !m) return
  const margin = 8
  const w = m.offsetWidth
  let left = r.left
  if (left + w > window.innerWidth - margin) {
    left = Math.max(margin, r.right - w)
  }
  menuLeft.value = left
})

function pick(code: string) {
  emit('update:modelValue', code)
  open.value = false
  btnEl.value?.focus()
}

function onKey(e: KeyboardEvent) {
  if (!open.value) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (filtered.value.length === 0) return
    hover.value = (hover.value + 1) % filtered.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (filtered.value.length === 0) return
    hover.value = (hover.value - 1 + filtered.value.length) % filtered.value.length
  } else if (e.key === 'Enter' && filtered.value.length > 0) {
    e.preventDefault()
    pick(filtered.value[hover.value].code)
  } else if (e.key === 'Escape') {
    e.preventDefault()
    open.value = false
    btnEl.value?.focus()
  }
}

function onDocClick(e: MouseEvent) {
  const target = e.target as Node
  if (rootEl.value?.contains(target)) return
  if (menuEl.value?.contains(target)) return
  open.value = false
}

function onWindowScroll(e: Event) {
  if (!open.value) return
  // Don't close on scrolls inside the menu itself — that's the user
  // scrolling the country list, not the page scrolling under the menu.
  const target = e.target as Node | null
  if (target && menuEl.value?.contains(target)) return
  open.value = false
}
function onWindowResize() { if (open.value) open.value = false }

onMounted(() => {
  document.addEventListener('click', onDocClick, { capture: true })
  window.addEventListener('scroll', onWindowScroll, { capture: true })
  window.addEventListener('resize', onWindowResize)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick, { capture: true })
  window.removeEventListener('scroll', onWindowScroll, { capture: true })
  window.removeEventListener('resize', onWindowResize)
})

const menuStyle = computed(() => {
  const r = triggerRect.value
  if (!r) return {}
  return {
    position: 'fixed' as const,
    top: `${r.bottom + 4}px`,
    left: `${menuLeft.value ?? r.left}px`,
    minWidth: `${Math.max(r.width, 280)}px`,
    zIndex: 50,
    visibility: menuLeft.value === null ? ('hidden' as const) : ('visible' as const),
  }
})
</script>

<template>
  <div ref="rootEl" class="relative inline-block w-full">
    <button
      ref="btnEl"
      type="button"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="toggle"
      class="field flex items-center gap-2 cursor-pointer focus:outline-none text-left"
    >
      <span class="truncate flex-1">{{ currentLabel || $t('profiles.searchCountry') }}</span>
      <span aria-hidden class="text-[0.65em] opacity-70">▾</span>
    </button>
    <Teleport to="body">
      <div
        v-if="open"
        ref="menuEl"
        class="country-picker-menu hairline shadow-xl"
        :style="menuStyle"
        @keydown="onKey"
      >
        <div class="p-2 hairline-b">
          <input
            ref="searchEl"
            v-model="search"
            type="text"
            :placeholder="t('profiles.searchCountry')"
            class="w-full px-2 py-1.5 text-sm bg-transparent outline-none"
            autocomplete="off"
            spellcheck="false"
          />
        </div>
        <ul role="listbox" class="max-h-72 overflow-auto">
          <li
            v-for="(c, i) in filtered"
            :key="c.code"
            role="option"
            :aria-selected="c.code === modelValue"
            :class="['country-picker-item flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors', i === hover ? 'is-active' : '']"
            @mousedown.prevent="pick(c.code)"
            @mouseenter="hover = i"
          >
            <span class="text-lg leading-none">{{ flagFor(c.code) }}</span>
            <span class="flex-1 truncate">{{ c.name }}</span>
            <span class="opacity-40 text-xs tabular-nums">{{ c.code }}</span>
          </li>
          <li v-if="filtered.length === 0" class="px-4 py-3 text-sm opacity-60">
            —
          </li>
        </ul>
      </div>
    </Teleport>
  </div>
</template>

<style>
.country-picker-menu {
  background: var(--color-paper-2);
  color: var(--color-ink);
  border-color: var(--color-rule);
}
.country-picker-item.is-active,
.country-picker-item:hover {
  background: var(--color-accent);
  color: var(--color-paper);
}
.staff-theme .country-picker-menu {
  background: var(--color-staff-panel);
  color: var(--color-staff-ink);
  border-color: var(--color-staff-rule);
}
.staff-theme .country-picker-item.is-active,
.staff-theme .country-picker-item:hover {
  background: var(--color-staff-accent);
  color: var(--color-staff-paper);
}
</style>
