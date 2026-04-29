<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Eye, EyeOff } from 'lucide-vue-next'

const model = defineModel<string>({ required: true })
defineOptions({ inheritAttrs: false })

const { t } = useI18n()
const visible = ref(false)
</script>

<template>
  <div class="relative">
    <input
      v-model="model"
      :type="visible ? 'text' : 'password'"
      v-bind="$attrs"
      :class="[$attrs.class, '!pr-10']"
    />
    <button
      type="button"
      tabindex="-1"
      :aria-label="visible ? t('auth.hidePassword') : t('auth.showPassword')"
      :aria-pressed="visible"
      class="absolute right-0 bottom-1 p-1.5 opacity-50 hover:opacity-100 transition-opacity"
      @click="visible = !visible"
    >
      <EyeOff v-if="visible" :size="18" :stroke-width="1.5" aria-hidden />
      <Eye v-else :size="18" :stroke-width="1.5" aria-hidden />
    </button>
  </div>
</template>
