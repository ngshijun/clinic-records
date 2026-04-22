<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { decodeUrl, computeFingerprint, type QrPayload } from '@/lib/qr-payload'
import { useProfilesStore } from '@/stores/profiles'
import { useRecordsStore, type Record } from '@/stores/records'
import IngestConfirm from '@/components/IngestConfirm.vue'
import SimilarityDialog from '@/components/SimilarityDialog.vue'

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
  <main class="max-w-sm mx-auto p-4 space-y-4">
    <h1 class="text-xl font-semibold">New record</h1>

    <p v-if="parseError" class="text-red-600">{{ parseError }}</p>

    <template v-else-if="payload">
      <label v-if="profiles.profiles.length > 1" class="block">
        <span class="text-sm text-gray-600">For profile</span>
        <select v-model="selectedProfile" class="border rounded px-2 py-1 w-full mt-1">
          <option v-for="p in profiles.profiles" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </label>

      <IngestConfirm :payload="payload" @confirm="confirm" @cancel="router.push('/home')" />

      <SimilarityDialog v-if="similar" :existing="similar"
        @replace="doReplace" @keep-both="doKeepBoth" @cancel="similar = null" />

      <p v-if="errorMsg" class="text-red-600 text-sm">{{ errorMsg }}</p>
    </template>
  </main>
</template>
