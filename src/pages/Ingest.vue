<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { decodeUrl, computeFingerprint, type QrPayload } from '@/lib/qr-payload'
import { useProfilesStore } from '@/stores/profiles'
import { useRecordsStore, type Record } from '@/stores/records'
import IngestConfirm from '@/components/IngestConfirm.vue'
import SimilarityDialog from '@/components/SimilarityDialog.vue'
import { requestAndSubscribe } from '@/lib/push'
import { supabase } from '@/lib/supabase'

const route = useRoute()
const router = useRouter()
const profiles = useProfilesStore()
const records = useRecordsStore()

const payload = ref<QrPayload | null>(null)
const fingerprint = ref<string>('')
const parseError = ref<string | null>(null)
const selectedProfile = ref<string | null>(null)
const similar = ref<Record | null>(null)
const busy = ref(false)
const errorMsg = ref<string | null>(null)

onMounted(async () => {
  try {
    const hash = route.hash || window.location.hash
    payload.value = decodeUrl(hash)
    fingerprint.value = await computeFingerprint(payload.value)
  } catch (e: any) { parseError.value = e.message; return }
  await profiles.fetchAll()
  selectedProfile.value = profiles.defaultProfile?.id ?? null
})

async function confirm() {
  if (!payload.value || !selectedProfile.value) return
  busy.value = true
  errorMsg.value = null
  try {
    const kind = payload.value.k === 'v' ? 'vaccination' : 'blood_test'
    const match = await records.findSimilar(selectedProfile.value, kind, payload.value.n, payload.value.d)
    if (match) { similar.value = match; busy.value = false; return }
    const rec = await records.insertWithReminder({
      profile_id: selectedProfile.value,
      payload: payload.value,
      fingerprint: fingerprint.value,
    })
    const { count } = await supabase.from('records').select('*', { count: 'exact', head: true })
    if ((count ?? 0) === 1 && Notification.permission === 'default') {
      await requestAndSubscribe()
    }
    router.replace({ name: 'record', params: { id: rec.id } })
  } catch (e: any) {
    if (String(e.message).includes('qr_fingerprint')) {
      errorMsg.value = 'This record is already in your history.'
    } else { errorMsg.value = e.message ?? 'Insert failed' }
  } finally { busy.value = false }
}

async function doReplace() {
  if (!payload.value || !selectedProfile.value || !similar.value) return
  busy.value = true
  try {
    const rec = await records.replaceRecord(similar.value.id, {
      profile_id: selectedProfile.value,
      payload: payload.value,
      fingerprint: fingerprint.value,
    })
    router.replace({ name: 'record', params: { id: rec.id } })
  } catch (e: any) { errorMsg.value = e.message } finally { busy.value = false }
}

async function doKeepBoth() {
  if (!payload.value || !selectedProfile.value) return
  busy.value = true
  try {
    const rec = await records.insertWithReminder({
      profile_id: selectedProfile.value,
      payload: payload.value,
      fingerprint: fingerprint.value,
    })
    router.replace({ name: 'record', params: { id: rec.id } })
  } catch (e: any) { errorMsg.value = e.message } finally { busy.value = false }
}
</script>

<template>
  <main class="min-h-dvh flex flex-col">
    <header class="max-w-[620px] w-full mx-auto px-6 pt-8 pb-4 flex items-center justify-between">
      <div class="eyebrow"><span class="tick"></span>Ingest · new entry</div>
      <router-link to="/home" class="folio underline underline-offset-4 decoration-[var(--color-rule)]">← home</router-link>
    </header>

    <section class="flex-1 max-w-[620px] w-full mx-auto px-6 py-6 space-y-8">
      <div v-if="parseError" class="paper-card p-6 anim-rise">
        <div class="eyebrow mb-2" style="color: var(--color-crimson)">Unreadable</div>
        <h1 class="font-display text-3xl">{{ parseError }}</h1>
        <p class="text-sm text-muted-app mt-3">Ask your clinic to regenerate the code, or return home to try again.</p>
        <router-link to="/home" class="btn-ghost mt-5 inline-flex">Return home</router-link>
      </div>

      <template v-else-if="payload">
        <div class="space-y-2 anim-rise">
          <div class="eyebrow"><span class="tick"></span>§ Entry verification</div>
          <h1 class="font-display text-4xl md:text-5xl leading-[0.95]">
            A new entry <span class="font-display-wonk">awaits</span>.
          </h1>
        </div>

        <div v-if="profiles.profiles.length > 1" class="paper-card p-5 anim-rise-2 flex items-center justify-between gap-4">
          <div>
            <div class="eyebrow mb-1">File under</div>
            <div class="text-sm text-muted-app">Choose which ledger receives this entry.</div>
          </div>
          <select v-model="selectedProfile" class="bg-transparent hairline-b font-display text-xl px-0 pr-6 py-1 focus:outline-none focus:border-ink">
            <option v-for="p in profiles.profiles" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </div>

        <div class="anim-rise-3">
          <IngestConfirm :payload="payload" @confirm="confirm" @cancel="router.push('/home')" />
        </div>

        <SimilarityDialog v-if="similar" :existing="similar"
          @replace="doReplace" @keep-both="doKeepBoth" @cancel="similar = null" />

        <p v-if="errorMsg" class="text-crimson text-sm paper-card p-4">
          <span class="eyebrow" style="color: var(--color-crimson)">Error ·</span> {{ errorMsg }}
        </p>
      </template>

      <div v-if="busy" class="text-center text-sm text-muted-app font-display-wonk">
        Committing to the ledger…
      </div>
    </section>

    <footer class="max-w-[620px] w-full mx-auto px-6 pb-6 flex items-center justify-between">
      <div class="folio">PGN·CR / ingest</div>
      <div v-if="payload" class="folio">ref {{ payload.id.slice(0, 6) }}</div>
    </footer>
  </main>
</template>
