<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDialog } from '@/lib/dialog'

const { t } = useI18n()
const { state } = useDialog()
const current = computed(() => state.queue[0] ?? null)

const input = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const primaryRef = ref<HTMLButtonElement | null>(null)

watch(current, async (c) => {
  if (!c) return
  input.value = c.kind === 'prompt' ? (c.defaultValue ?? '') : ''
  await nextTick()
  if (c.kind === 'prompt') {
    inputRef.value?.focus()
    inputRef.value?.select()
  } else {
    primaryRef.value?.focus()
  }
}, { immediate: true })

function close() {
  state.queue.shift()
}

function onConfirm() {
  const c = current.value
  if (!c) return
  if (c.kind === 'prompt') c.resolve(input.value)
  else if (c.kind === 'confirm') c.resolve(true)
  else c.resolve(undefined)
  close()
}

function onCancel() {
  const c = current.value
  if (!c) return
  if (c.kind === 'prompt') c.resolve(null)
  else if (c.kind === 'confirm') c.resolve(false)
  else c.resolve(undefined)
  close()
}

function onBackdrop() {
  if (!current.value) return
  if (current.value.kind === 'alert') onConfirm()
  else onCancel()
}

function onKeydown(e: KeyboardEvent) {
  if (!current.value) return
  if (e.key === 'Escape') { e.preventDefault(); onCancel() }
  if (e.key === 'Enter' && current.value.kind !== 'prompt') { e.preventDefault(); onConfirm() }
}

const confirmLabel = computed(() => {
  const c = current.value
  if (!c) return ''
  if (c.confirmLabel) return c.confirmLabel
  if (c.kind === 'alert') return t('common.close')
  if (c.kind === 'prompt') return t('common.save')
  return t('common.continue')
})
const cancelLabel = computed(() => current.value?.cancelLabel ?? t('common.cancel'))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="current"
      class="app-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      @click.self="onBackdrop"
      @keydown="onKeydown"
    >
      <div class="paper-card app-dialog-card anim-rise">
        <h2 class="font-display text-2xl leading-[1.12]">{{ current.title }}</h2>
        <p v-if="current.body" class="text-sm mt-3 leading-relaxed" style="color: var(--color-muted)">{{ current.body }}</p>

        <form
          v-if="current.kind === 'prompt'"
          class="mt-5"
          @submit.prevent="onConfirm"
        >
          <input
            ref="inputRef"
            v-model="input"
            class="field"
            :placeholder="current.placeholder ?? ''"
            autocomplete="off"
            spellcheck="false"
          />
        </form>

        <div class="flex justify-end gap-3 mt-6">
          <button
            v-if="current.kind !== 'alert'"
            type="button"
            class="btn-ghost"
            @click="onCancel"
          >
            {{ cancelLabel }}
          </button>
          <button
            ref="primaryRef"
            type="button"
            class="btn-primary"
            @click="onConfirm"
          >
            {{ confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.app-dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.42);
  display: grid;
  place-items: center;
  padding: 1rem;
  z-index: 100;
  animation: app-dialog-fade 140ms ease-out;
}
.app-dialog-card {
  width: 100%;
  max-width: 440px;
  padding: 1.75rem 1.75rem 1.5rem;
}
@keyframes app-dialog-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
