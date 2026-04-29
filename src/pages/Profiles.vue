<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useProfilesStore, type Profile } from '@/stores/profiles'
import { useDialog } from '@/lib/dialog'
import { formatDateLong } from '@/lib/dates'

const store = useProfilesStore()
const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const dialog = useDialog()
const name = ref('')
const dob = ref('')
const error = ref<string | null>(null)

const busy = ref(false)
const editingId = ref<string | null>(null)
const editName = ref('')
const editDob = ref('')
const editError = ref<string | null>(null)
const editBusy = ref(false)
const deletingId = ref<string | null>(null)

const isFirst = computed(() => route.query.first === '1' && store.profiles.length === 0)

onMounted(async () => {
  await store.fetchAll()
  if (route.query.first === '1' && store.profiles.length === 0) {
    name.value = 'Me'
  }
})

async function add() {
  if (busy.value) return
  error.value = null
  busy.value = true
  try {
    await store.create({ name: name.value.trim(), date_of_birth: dob.value || null })
    name.value = ''
    dob.value = ''
    if (route.query.first === '1') router.push('/home')
  } catch (e: any) { error.value = e.message }
  finally { busy.value = false }
}

async function del(id: string) {
  if (deletingId.value) return
  const ok = await dialog.confirm({
    title: t('profiles.confirmDelete'),
    confirmLabel: t('common.delete'),
  })
  if (!ok) return
  deletingId.value = id
  try { await store.remove(id) } catch (e: any) { await dialog.alert({ title: e.message }) }
  finally { deletingId.value = null }
}

async function setDefault(id: string) { await store.setDefault(id) }

function startEdit(p: Profile) {
  editingId.value = p.id
  editName.value = p.name
  editDob.value = p.date_of_birth ?? ''
  editError.value = null
}

function cancelEdit() {
  editingId.value = null
  editError.value = null
}

async function saveEdit() {
  if (!editingId.value || editBusy.value) return
  editError.value = null
  editBusy.value = true
  try {
    await store.update(editingId.value, {
      name: editName.value.trim(),
      date_of_birth: editDob.value || null,
    })
    editingId.value = null
  } catch (e: any) { editError.value = e.message ?? 'Could not save' }
  finally { editBusy.value = false }
}

function formatDob(d: string | null) {
  return d ? formatDateLong(d, locale.value) : null
}
</script>

<template>
  <main class="min-h-dvh pb-20">
    <header class="max-w-[760px] w-full mx-auto px-6 pt-8 flex items-center justify-between">
      <router-link v-if="!isFirst" to="/home" class="folio underline underline-offset-4 decoration-[var(--color-rule)]">{{ $t('common.backToLedger') }}</router-link>
      <div v-else class="eyebrow"><span class="tick"></span>{{ $t('profiles.firstReader') }}</div>
      <div class="eyebrow">{{ $t('profiles.profilesLabel', { count: String(store.profiles.length).padStart(2, '0') }) }}</div>
    </header>

    <section class="max-w-[760px] w-full mx-auto px-6 py-10 space-y-12">
      <div class="space-y-2 anim-rise">
        <div class="eyebrow"><span class="tick"></span>{{ isFirst ? $t('profiles.welcome') : $t('profiles.rosterOfReaders') }}</div>
        <h1 class="font-display text-5xl md:text-6xl leading-[0.95]">
          <span v-if="isFirst">{{ $t('profiles.whoFor') }}<br/><span class="font-display-wonk">{{ $t('profiles.thisLedgerFor') }}</span></span>
          <span v-else>{{ $t('profiles.titleProfiles') }}</span>
        </h1>
        <p v-if="isFirst" class="text-ink-2 text-sm max-w-[40ch]">{{ $t('profiles.firstHint') }}</p>
        <p v-else class="text-ink-2 text-sm max-w-[40ch]">{{ $t('profiles.oneLedgerPerPerson') }}</p>
      </div>

      <form class="paper-card brackets p-6 md:p-8 space-y-5 anim-rise-2" @submit.prevent="add">
        <div class="eyebrow">{{ $t('profiles.admitNew') }}</div>
        <div class="grid sm:grid-cols-[1.2fr_1fr] gap-5">
          <label class="block">
            <span class="field-label">{{ $t('profiles.nameLabel') }}</span>
            <input v-model="name" :placeholder="$t('profiles.namePlaceholder')" required class="field font-display text-2xl" />
          </label>
          <label class="block">
            <span class="field-label">{{ $t('profiles.bornLabel') }} <span class="lowercase text-muted-app normal-case tracking-normal font-normal">{{ $t('profiles.optional') }}</span></span>
            <input v-model="dob" type="date" class="field tabular-nums" />
          </label>
        </div>
        <div class="flex items-center gap-3 pt-2">
          <button class="btn-primary" :disabled="busy">{{ isFirst ? $t('common.continue') : $t('profiles.addProfile') }} <span aria-hidden>→</span></button>
          <p v-if="error" class="text-crimson text-sm">
            <span class="eyebrow" style="color:var(--color-crimson)">{{ $t('common.error') }} ·</span> {{ error }}
          </p>
        </div>
      </form>

      <div v-if="store.profiles.length" class="space-y-4 anim-rise-3">
        <div class="flex items-baseline justify-between">
          <h2 class="font-display text-2xl">{{ $t('profiles.roster') }}</h2>
          <span class="eyebrow">{{ $t('profiles.onFile', { count: store.profiles.length }) }}</span>
        </div>

        <ul class="divide-y divide-[var(--color-rule-soft)] hairline-t hairline-b">
          <li v-for="(p, i) in store.profiles" :key="p.id" class="py-5 px-1">
            <div v-if="editingId !== p.id" class="grid grid-cols-[auto_1fr_auto] items-center gap-5">
              <span class="folio tabular-nums w-8">№{{ String(i+1).padStart(2,'0') }}</span>
              <div>
                <div class="flex items-baseline gap-3 flex-wrap">
                  <span class="font-display text-2xl">{{ p.name }}</span>
                  <span v-if="p.is_default" class="eyebrow" style="color: var(--color-moss)">{{ $t('profiles.defaultBadge') }}</span>
                </div>
                <div class="text-xs text-muted-app mt-0.5" v-if="p.date_of_birth">
                  {{ $t('profiles.born', { date: formatDob(p.date_of_birth) }) }}
                </div>
              </div>
              <div class="flex items-center gap-1 flex-wrap justify-end">
                <button class="btn-ghost text-xs !py-1.5 !px-3" @click="startEdit(p)">{{ $t('profiles.edit') }}</button>
                <button v-if="!p.is_default" class="btn-ghost text-xs !py-1.5 !px-3" @click="setDefault(p.id)">{{ $t('profiles.makeDefault') }}</button>
                <button v-if="!p.is_default" class="btn-danger text-xs !py-1.5 !px-3" :disabled="deletingId === p.id" @click="del(p.id)">{{ $t('profiles.delete') }}</button>
              </div>
            </div>

            <form v-else class="grid grid-cols-[auto_1fr] gap-5 items-start" @submit.prevent="saveEdit">
              <span class="folio tabular-nums w-8 pt-6">№{{ String(i+1).padStart(2,'0') }}</span>
              <div class="space-y-4">
                <div class="eyebrow" style="color: var(--color-accent)">{{ $t('profiles.amendingProfile') }}</div>
                <div class="grid sm:grid-cols-[1.2fr_1fr] gap-4">
                  <label class="block">
                    <span class="field-label">{{ $t('profiles.nameLabel') }}</span>
                    <input v-model="editName" required class="field font-display text-xl" />
                  </label>
                  <label class="block">
                    <span class="field-label">{{ $t('profiles.bornLabel') }}</span>
                    <input v-model="editDob" type="date" class="field tabular-nums" />
                  </label>
                </div>
                <p v-if="editError" class="text-crimson text-xs">
                  <span class="eyebrow" style="color:var(--color-crimson)">{{ $t('common.error') }} ·</span> {{ editError }}
                </p>
                <div class="flex items-center gap-2 pt-1">
                  <button class="btn-primary !py-2 !px-4 text-sm" :disabled="editBusy">{{ $t('profiles.save') }}</button>
                  <button type="button" class="btn-ghost !py-2 !px-4 text-sm" :disabled="editBusy" @click="cancelEdit">{{ $t('profiles.cancel') }}</button>
                </div>
              </div>
            </form>
          </li>
        </ul>
      </div>
    </section>
  </main>
</template>
