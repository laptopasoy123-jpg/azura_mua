<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { useCrmStore } from '../stores/crm'
import UiModal from './UiModal.vue'
import {
  LayoutDashboard, UsersRound, ShoppingBag, Layers, FileText, CreditCard,
  BookOpen, CircleDollarSign, Boxes, BarChart3, Building2, SlidersHorizontal,
  Bell, Search, Menu, X, ChevronLeft, ChevronRight,
  Shirt, Briefcase, Calendar, Clock, CheckCircle2, AlertTriangle, Trash2, Info,
} from '@lucide/vue'

const route = useRoute()
const store = useCrmStore()
const collapsed = ref(false)
const mobileOpen = ref(false)
const showNotifications = ref(false)

const now = ref(new Date())
let clockTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  clockTimer = setInterval(() => {
    now.value = new Date()
  }, 1000)
})

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
})

const todayDateLabel = computed(() =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(now.value),
)

const liveClockLabel = computed(() => {
  const hh = String(now.value.getHours()).padStart(2, '0')
  const mm = String(now.value.getMinutes()).padStart(2, '0')
  const ss = String(now.value.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
})

const sections = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Client & Billing',
    items: [
      { to: '/customers', label: 'Customers', icon: UsersRound },
      { to: '/catalog', label: 'Service Catalog', icon: BookOpen },
      { to: '/orders', label: 'Orders', icon: ShoppingBag },
      { to: '/additional', label: 'Add-on Services', icon: Layers },
      { to: '/invoices', label: 'Invoices', icon: FileText },
      { to: '/payments', label: 'Payments', icon: CreditCard },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/wedding-portal', label: 'Wedding Portal', icon: Shirt },
      { to: '/jobs', label: 'Team Assignments', icon: Briefcase },
    ],
  },
  {
    label: 'Finance & Stock',
    items: [
      { to: '/expenses', label: 'Expenses', icon: CircleDollarSign },
      { to: '/inventory', label: 'Inventory', icon: Boxes },
      { to: '/reports', label: 'Reports', icon: BarChart3 },
    ],
  },
  {
    label: 'Settings',
    items: [
      { to: '/profile', label: 'Business Profile', icon: Building2 },
      { to: '/settings', label: 'Dropdown Settings', icon: SlidersHorizontal },
    ],
  },
]

const currentNavItem = computed(() =>
  sections.flatMap((s) => s.items).find((item) => item.to === route.path),
)
const pageTitle = computed(() => String(route.meta.title ?? 'Dashboard'))
const closeMobile = () => { mobileOpen.value = false }
</script>

<template>
  <div class="app-frame" :class="{ 'sidebar-is-collapsed': collapsed }">
    <div v-if="mobileOpen" class="mobile-scrim" @click="closeMobile" />
    <aside class="sidebar" :class="{ 'is-mobile-open': mobileOpen }">
      <div class="brand-row">
        <div class="brand-mark brand-mark--azura" :class="{ 'has-custom-logo': Boolean(store.businessProfile.logoUrl) }" aria-hidden="true">
          <img v-if="store.businessProfile.logoUrl" :src="store.businessProfile.logoUrl" :alt="store.businessProfile.name" />
          <svg v-else viewBox="0 0 48 48" width="26" height="26">
            <path
              d="M25.2 7L38.4 39.2H42V41H30.2V39.2H33.1L29.6 30.2H18.1L14.5 39.2H17.8V41H8.4V39.2H11.6L23.9 8.2C18.4 13.4 15.8 18.9 18.8 22.8C20.9 25.4 25.1 26.2 28.4 26.2L29.1 28C24.1 28.2 18.3 27.1 15.6 23.4C12.2 18.8 14.5 12.1 23.2 7H25.2ZM18.8 28.4H28.9L24 15.6L18.8 28.4Z"
              fill="currentColor"
            />
          </svg>
        </div>
        <div v-if="!collapsed" class="brand-copy">
          <strong>{{ store.businessProfile.name || 'AZURA' }}</strong>
          <span>{{ store.businessProfile.tagline || 'MAKEUP ARTIST' }}</span>
        </div>
        <button class="icon-button mobile-close" aria-label="Close menu" @click="closeMobile"><X :size="19" /></button>
      </div>

      <a
        href="https://daysheet.id"
        target="_blank"
        rel="noopener noreferrer"
        class="daysheet-sidebar-credit"
        :title="collapsed ? 'Powered by DaySheet (daysheet.id)' : 'Visit daysheet.id'"
      >
        <span class="daysheet-logo-circle" aria-hidden="true">
          <svg viewBox="0 0 64 40" width="26" height="17">
            <text x="6" y="17" font-family="Plus Jakarta Sans, Arial, sans-serif" font-size="16" font-weight="800" fill="#4BA3F7">Day</text>
            <text x="4" y="34" font-family="Plus Jakarta Sans, Arial, sans-serif" font-size="16" font-weight="800" fill="#00897B">Sheet.</text>
          </svg>
        </span>
        <div v-if="!collapsed" class="daysheet-credit-copy">
          <strong>DaySheet.</strong>
          <span>Copyright © {{ new Date().getFullYear() }} Daysheet.id</span>
        </div>
      </a>

      <nav class="side-nav" aria-label="Main navigation">
        <section v-for="section in sections" :key="section.label" class="nav-section">
          <p v-if="!collapsed" class="nav-label">{{ section.label }}</p>
          <div v-else class="nav-divider" />
          <RouterLink
            v-for="item in section.items"
            :key="item.to"
            :to="item.to"
            class="nav-item"
            :title="collapsed ? item.label : undefined"
            @click="closeMobile"
          >
            <component :is="item.icon" class="nav-icon" :size="18" :stroke-width="1.75" aria-hidden="true" />
            <span v-if="!collapsed" class="nav-text">{{ item.label }}</span>
          </RouterLink>
        </section>
      </nav>

      <div class="sidebar-foot">
        <button class="collapse-button" @click="collapsed = !collapsed">
          <component :is="collapsed ? ChevronRight : ChevronLeft" :size="17" />
          <span v-if="!collapsed">Collapse menu</span>
        </button>
      </div>
    </aside>

    <div class="workspace">
      <header class="topbar">
        <div class="topbar-title">
          <button class="icon-button mobile-menu" aria-label="Open menu" @click="mobileOpen = true"><Menu :size="21" /></button>
          <div>
            <p>{{ store.businessProfile.name }} {{ store.businessProfile.tagline }} <span>/</span></p>
            <h1>
              <component :is="currentNavItem.icon" v-if="currentNavItem" class="topbar-icon" :size="19" :stroke-width="1.75" aria-hidden="true" />
              {{ pageTitle }}
            </h1>
          </div>
        </div>

        <div class="topbar-live-clock" aria-live="off">
          <span class="live-date-part"><Calendar :size="14" :stroke-width="1.8" />{{ todayDateLabel }}</span>
          <i class="live-clock-sep" aria-hidden="true" />
          <strong class="live-time-part"><Clock :size="14" :stroke-width="1.8" />{{ liveClockLabel }} WIB</strong>
          <i class="live-clock-sep" aria-hidden="true" />
          <a href="https://daysheet.id" target="_blank" rel="noopener noreferrer" class="topbar-daysheet-link" title="Visit daysheet.id">
            <span class="daysheet-pill-dot" />
            <span class="daysheet-text-day">Day</span><span class="daysheet-text-sheet">Sheet.</span>
          </a>
        </div>

        <div class="topbar-actions">
          <label class="global-search">
            <Search :size="17" />
            <input type="search" placeholder="Search PO, customer, invoice…" />
            <kbd>⌘ K</kbd>
          </label>
          <button class="icon-button notification-button" aria-label="Notifications" @click="showNotifications = true"><Bell :size="19" /><i /></button>
          <div class="profile-chip">
            <div class="profile-avatar">AR</div>
            <div><strong>Aura Rahma</strong><span>Owner</span></div>
          </div>
        </div>
      </header>

      <main class="page-area">
        <RouterView v-slot="{ Component, route: currentRoute }">
          <div :key="currentRoute.fullPath" class="page-enter-anim">
            <component :is="Component" v-if="Component" />
          </div>
        </RouterView>
        <footer class="workspace-footer">
          <a href="https://daysheet.id" target="_blank" rel="noopener noreferrer" class="daysheet-copyright-link">
            Copyright © {{ new Date().getFullYear() }} Daysheet.id
          </a>
        </footer>
      </main>
    </div>

    <UiModal :open="showNotifications" title="Notifications" description="Attire schedule reminders and recent studio activity." @close="showNotifications = false">
      <div v-if="store.laundryUrgentAlerts.length" class="notification-urgent-box">
        <article v-for="alert in store.laundryUrgentAlerts" :key="`${alert.attireId}-${alert.bookingId}`" class="notification-urgent-item">
          <strong>Prepare Attire Immediately ({{ alert.daysLeft === 0 ? 'Event Today' : 'H-1 Tomorrow' }})</strong>
          <span>{{ alert.message }}</span>
        </article>
      </div>
      <div class="notification-list">
        <article v-for="activity in store.activities.slice(0, 6)" :key="activity.id"><i :class="`activity-${activity.tone}`" /><div><strong>{{ activity.title }}</strong><span>{{ activity.detail }}</span></div><time>{{ new Date(activity.at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) }}</time></article>
      </div>
      <div class="modal-actions"><button class="primary-button" @click="showNotifications = false">Close</button></div>
    </UiModal>

    <Transition name="toast-slide">
      <div
        v-if="store.actionToast"
        :key="store.actionToast.id"
        class="action-toast-popup"
        :class="`is-${store.actionToast.tone}`"
        role="status"
        aria-live="polite"
      >
        <span class="action-toast-icon" aria-hidden="true">
          <Trash2 v-if="store.actionToast.tone === 'rose'" :size="18" />
          <AlertTriangle v-else-if="store.actionToast.tone === 'amber'" :size="18" />
          <CheckCircle2 v-else-if="store.actionToast.tone === 'green' || store.actionToast.tone === 'blue'" :size="18" />
          <Info v-else :size="18" />
        </span>
        <div class="action-toast-copy">
          <strong>{{ store.actionToast.title }}</strong>
          <span>{{ store.actionToast.detail }}</span>
        </div>
        <button type="button" class="action-toast-close" aria-label="Dismiss notification" @click="store.dismissActionToast">
          <X :size="15" />
        </button>
      </div>
    </Transition>
  </div>
</template>
