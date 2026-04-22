<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProfilesStore } from '@/stores/profiles'

const store = useProfilesStore()
const route = useRoute()
const router = useRouter()
const name = ref('')
const dob = ref('')
const error = ref<string | null>(null)

const isFirst = computed(() => route.query.first === '1' && store.profiles.length === 0)

onMounted(async () => {
  await store.fetchAll()
  if (route.query.first === '1' && store.profiles.length === 0) {
    name.value = 'Me'
  }
})

async function add() {
  error.value = null
  try {
    await store.create({ name: name.value.trim(), date_of_birth: dob.value || null })
    name.value = ''
    dob.value = ''
    if (route.query.first === '1') router.push('/home')
  } catch (e: any) { error.value = e.message }
}

async function del(id: string) {
  if (!confirm('Delete this profile and all its records?')) return
  try { await store.remove(id) } catch (e: any) { alert(e.message) }
}

async function setDefault(id: string) { await store.setDefault(id) }

function formatDob(d: string | null) {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
}
</script>

<template>
  <main class="min-h-dvh pb-20">
    <header class="max-w-[760px] w-full mx-auto px-6 pt-8 flex items-center justify-between">
      <router-link v-if="!isFirst" to="/home" class="folio underline underline-offset-4 decoration-[var(--color-rule)]">← ledger</router-link>
      <div v-else class="eyebrow"><span class="tick"></span>First reader</div>
      <div class="eyebrow">Profiles · № {{ String(store.profiles.length).padStart(2, '0') }}</div>
    </header>

    <section class="max-w-[760px] w-full mx-auto px-6 py-10 space-y-12">
      <div class="space-y-2 anim-rise">
        <div class="eyebrow"><span class="tick"></span>{{ isFirst ? 'Welcome' : 'Roster of readers' }}</div>
        <h1 class="font-display text-5xl md:text-6xl leading-[0.95]">
          <span v-if="isFirst">Who are we keeping<br/><span class="font-display-wonk">this ledger for?</span></span>
          <span v-else>Profiles.</span>
        </h1>
        <p v-if="isFirst" class="text-ink-2 text-sm max-w-[40ch]">
          Name the person whose records this will hold. You can add more later — a child, a parent, anyone you look after.
        </p>
        <p v-else class="text-ink-2 text-sm max-w-[40ch]">
          One ledger per person. Scanned QRs file under whichever you choose.
        </p>
      </div>

      <!-- Add form -->
      <form class="paper-card brackets p-6 md:p-8 space-y-5 anim-rise-2" @submit.prevent="add">
        <span class="br-tr"></span><span class="br-bl"></span>
        <div class="eyebrow">Admit a new reader</div>
        <div class="grid sm:grid-cols-[1.2fr_1fr] gap-5">
          <label class="block">
            <span class="field-label">Name</span>
            <input v-model="name" placeholder="e.g. Ahmad" required class="field font-display text-2xl" />
          </label>
          <label class="block">
            <span class="field-label">Born <span class="lowercase text-muted-app normal-case tracking-normal font-normal">— optional</span></span>
            <input v-model="dob" type="date" class="field tabular-nums" />
          </label>
        </div>
        <div class="flex items-center gap-3 pt-2">
          <button class="btn-primary">{{ isFirst ? 'Continue' : 'Add profile' }} <span aria-hidden>→</span></button>
          <p v-if="error" class="text-crimson text-sm">
            <span class="eyebrow" style="color:var(--color-crimson)">Error ·</span> {{ error }}
          </p>
        </div>
      </form>

      <!-- Roster -->
      <div v-if="store.profiles.length" class="space-y-4 anim-rise-3">
        <div class="flex items-baseline justify-between">
          <div class="flex items-baseline gap-3">
            <span class="folio">§</span>
            <h2 class="font-display text-2xl">Roster</h2>
          </div>
          <span class="eyebrow">{{ store.profiles.length }} on file</span>
        </div>

        <ul class="divide-y divide-[var(--color-rule-soft)] hairline-t hairline-b">
          <li v-for="(p, i) in store.profiles" :key="p.id" class="grid grid-cols-[auto_1fr_auto] items-center gap-5 py-5 px-1">
            <span class="folio tabular-nums w-8">№{{ String(i+1).padStart(2,'0') }}</span>
            <div>
              <div class="flex items-baseline gap-3">
                <span class="font-display text-2xl">{{ p.name }}</span>
                <span v-if="p.is_default" class="eyebrow" style="color: var(--color-moss)">· default</span>
              </div>
              <div class="text-xs text-muted-app mt-0.5" v-if="p.date_of_birth">
                born {{ formatDob(p.date_of_birth) }}
              </div>
            </div>
            <div class="flex items-center gap-1">
              <button v-if="!p.is_default" class="btn-ghost text-xs !py-1.5 !px-3" @click="setDefault(p.id)">make default</button>
              <button class="btn-danger text-xs !py-1.5 !px-3" @click="del(p.id)">delete</button>
            </div>
          </li>
        </ul>
      </div>
    </section>
  </main>
</template>
