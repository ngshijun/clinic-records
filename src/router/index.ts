import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'landing', component: () => import('@/pages/Landing.vue') },
  { path: '/signup', name: 'signup', component: () => import('@/pages/Signup.vue') },
  { path: '/home', name: 'home', component: () => import('@/pages/Home.vue'), meta: { requiresAuth: true } },
  { path: '/scan', name: 'scan', component: () => import('@/pages/Scan.vue'), meta: { requiresAuth: true } },
  { path: '/ingest', name: 'ingest', component: () => import('@/pages/Ingest.vue'), meta: { requiresAuth: true } },
  { path: '/records/:id', name: 'record', component: () => import('@/pages/RecordDetail.vue'), meta: { requiresAuth: true } },
  { path: '/profiles', name: 'profiles', component: () => import('@/pages/Profiles.vue'), meta: { requiresAuth: true } },
  { path: '/settings', name: 'settings', component: () => import('@/pages/Settings.vue'), meta: { requiresAuth: true } },
  { path: '/staff', name: 'staff', component: () => import('@/pages/staff/Gate.vue') },
  { path: '/staff/generate', name: 'staff-generate', component: () => import('@/pages/staff/Generate.vue'), meta: { requiresStaff: true } },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})
