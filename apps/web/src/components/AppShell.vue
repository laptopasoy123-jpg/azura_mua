<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useCrmStore } from '../stores/crm'
import { displayBookingStatus, formatDate } from '../utils/format'
import UiModal from './UiModal.vue'
import StatusBadge from './StatusBadge.vue'
import LiveClock from './LiveClock.vue'
import {
  LayoutDashboard, UsersRound, ShoppingBag, Layers, FileText, CreditCard,
  BookOpen, CircleDollarSign, Boxes, BarChart3, Building2, SlidersHorizontal,
  Bell, Menu, X, ChevronLeft, ChevronRight, CheckCheck, ArrowUpRight,
  Shirt, Briefcase, Calendar, CheckCircle2, AlertTriangle, Trash2, Info, MapPin, Phone,
} from '@lucide/vue'

const READ_NOTIF_STORAGE_KEY = 'azura_mua_read_notifications_v1'

const loadReadNotifs = (): string[] => {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(READ_NOTIF_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

const route = useRoute()
const router = useRouter()
const store = useCrmStore()
const collapsed = ref(false)
const mobileOpen = ref(false)
const showNotifications = ref(false)
const readNotifKeys = ref<string[]>(loadReadNotifs())

watch(
  readNotifKeys,
  (list) => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(READ_NOTIF_STORAGE_KEY, JSON.stringify(list.slice(-200)))
    } catch {
      // Ignore storage quota errors
    }
  },
  { deep: true },
)

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

const localTodayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Up to 10 nearest upcoming non-cancelled bookings from database with exact H-countdown & persistent read state
const upcomingCustomerAlerts = computed(() => {
  const today = localTodayIso()
  const todayMs = new Date(`${today}T00:00:00`).getTime()
  return [...store.bookings]
    .filter((b) => b.status !== 'Dibatalkan' && Boolean(b.eventDate) && b.eventDate >= today)
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate) || (a.eventTime ?? '').localeCompare(b.eventTime ?? ''))
    .slice(0, 10)
    .map((booking) => {
      const customer = store.customerFor(booking.customerId)
      const eventMs = new Date(`${booking.eventDate}T00:00:00`).getTime()
      const daysLeft = Math.max(0, Math.round((eventMs - todayMs) / 86_400_000))
      const hLabel = daysLeft === 0 ? 'Hari-H' : `H-${daysLeft}`
      const urgency = daysLeft === 0 ? 'today' : daysLeft <= 3 ? 'soon' : daysLeft <= 7 ? 'upcoming' : 'normal'
      const alertKey = `booking:${booking.id}:${booking.eventDate}`
      return { booking, customer, daysLeft, hLabel, urgency, alertKey }
    })
})

const readNotifSet = computed(() => new Set(readNotifKeys.value))

const unreadCustomerAlertsCount = computed(() =>
  upcomingCustomerAlerts.value.filter((item) => !readNotifSet.value.has(item.alertKey)).length,
)

const laundryAlertKey = (alert: { attireId: string; bookingId: string; daysLeft: number }) =>
  `laundry:${alert.attireId}:${alert.bookingId}:${alert.daysLeft}`

const unreadLaundryAlertsCount = computed(() =>
  store.laundryUrgentAlerts.filter((a) => !readNotifSet.value.has(laundryAlertKey(a))).length,
)

const totalUnreadNotifications = computed(() =>
  unreadCustomerAlertsCount.value + unreadLaundryAlertsCount.value,
)

const markAlertKeyRead = (key: string) => {
  if (!readNotifSet.value.has(key)) {
    readNotifKeys.value = [...readNotifKeys.value, key]
  }
}

const openCustomerAlert = (item: { booking: { id: string }; alertKey: string }) => {
  markAlertKeyRead(item.alertKey)
  showNotifications.value = false
  router.push({ path: '/customers', query: { highlight: item.booking.id } })
}

const openLaundryAlert = (alert: { attireId: string; bookingId: string; daysLeft: number }) => {
  markAlertKeyRead(laundryAlertKey(alert))
  showNotifications.value = false
  router.push('/wedding-portal')
}

const markAllNotificationsRead = () => {
  const next = new Set(readNotifKeys.value)
  for (const item of upcomingCustomerAlerts.value) next.add(item.alertKey)
  for (const l of store.laundryUrgentAlerts) next.add(laundryAlertKey(l))
  readNotifKeys.value = [...next]
}
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

        <LiveClock />

        <div class="topbar-actions">
          <button class="icon-button notification-button" aria-label="Upcoming Event Alerts" @click="showNotifications = true">
            <Bell :size="19" />
            <span v-if="totalUnreadNotifications" class="notification-count-badge">{{ totalUnreadNotifications }}</span>
          </button>
          <div class="profile-chip">
            <div class="profile-avatar">AR</div>
            <div><strong>Aura Rahma</strong><span>Owner</span></div>
          </div>
        </div>
      </header>

      <main class="page-area">
        <RouterView v-slot="{ Component, route: currentRoute }">
          <div :key="currentRoute.path" class="page-enter-anim">
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

    <UiModal
      :open="showNotifications"
      title="Upcoming Customer Event Alerts"
      :description="`${totalUnreadNotifications} unread · Click any customer event to jump directly to their record in Customers & Bookings.`"
      wide
      @close="showNotifications = false"
    >
      <div class="notif-toolbar">
        <span class="notif-unread-summary">
          {{ upcomingCustomerAlerts.length }} upcoming schedule(s) · <strong>{{ unreadCustomerAlertsCount }} unread</strong>
        </span>
        <button
          type="button"
          class="soft-button notif-mark-all-btn"
          :disabled="totalUnreadNotifications === 0"
          @click="markAllNotificationsRead"
        >
          <CheckCheck :size="15" />Mark All as Read
        </button>
      </div>

      <div v-if="upcomingCustomerAlerts.length" class="upcoming-alert-list">
        <button
          v-for="item in upcomingCustomerAlerts"
          :key="item.alertKey"
          type="button"
          class="upcoming-alert-card upcoming-alert-card--clickable"
          :class="[`is-${item.urgency}`, readNotifSet.has(item.alertKey) ? 'is-read' : 'is-unread']"
          @click="openCustomerAlert(item)"
        >
          <span class="upcoming-h-pill" :class="`is-${item.urgency}`">{{ item.hLabel }}</span>
          <div class="upcoming-alert-main">
            <div class="upcoming-alert-top">
              <span v-if="!readNotifSet.has(item.alertKey)" class="notif-unread-dot" title="Unread notification" />
              <strong>{{ item.customer?.name ?? 'Customer' }}</strong>
              <span class="mono-code">{{ item.booking.poNumber }}</span>
              <StatusBadge :label="displayBookingStatus(item.booking.status)" />
              <span v-if="readNotifSet.has(item.alertKey)" class="notif-read-pill">Read</span>
            </div>
            <div class="upcoming-alert-meta">
              <span><Calendar :size="13" />{{ formatDate(item.booking.eventDate) }}<template v-if="item.booking.eventTime"> · {{ item.booking.eventTime }}</template></span>
              <span><MapPin :size="13" />{{ item.booking.location || '-' }}</span>
              <span v-if="item.customer?.phone"><Phone :size="13" />{{ item.customer.phone }}</span>
            </div>
          </div>
          <ArrowUpRight :size="16" class="upcoming-alert-arrow" />
        </button>
      </div>
      <div v-else class="empty-state" style="min-height: 120px;">
        <Calendar :size="26" />
        <strong>No upcoming bookings</strong>
        <span>All active events have passed or no future POs are scheduled yet.</span>
      </div>

      <div v-if="store.laundryUrgentAlerts.length" class="notification-urgent-box" style="margin-top: 14px;">
        <button
          v-for="alert in store.laundryUrgentAlerts"
          :key="`${alert.attireId}-${alert.bookingId}`"
          type="button"
          class="notification-urgent-item notification-urgent-item--clickable"
          :class="{ 'is-read': readNotifSet.has(laundryAlertKey(alert)) }"
          @click="openLaundryAlert(alert)"
        >
          <strong>Wardrobe Prep Reminder ({{ alert.daysLeft === 0 ? 'Event Today' : 'H-1 Tomorrow' }})</strong>
          <span>{{ alert.message }}</span>
        </button>
      </div>
      <div class="modal-actions" style="margin-top: 14px;"><button class="primary-button" @click="showNotifications = false">Close</button></div>
    </UiModal>

    <Transition name="toast-slide" mode="out-in">
      <div
        v-if="store.pdfDownloadState.active"
        class="pdf-loader-backdrop"
        role="status"
        aria-live="assertive"
      >
        <div class="pdf-loader-card">
          <div class="pdf-loader-orbit">
            <span class="pdf-loader-spinner" aria-hidden="true"></span>
            <div class="pdf-loader-logo">
              <img
                v-if="store.businessProfile.logoUrl"
                :src="store.businessProfile.logoUrl"
                :alt="store.businessProfile.name"
              />
              <span v-else>{{ (store.businessProfile.name || 'A').charAt(0).toUpperCase() }}</span>
            </div>
          </div>
          <div class="pdf-loader-copy">
            <span class="pdf-loader-eyebrow">Generating Official PDF</span>
            <strong>{{ store.pdfDownloadState.title || 'Preparing Document...' }}</strong>
            <p>{{ store.pdfDownloadState.subtitle || 'Formatting high-resolution studio stationery' }}</p>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="toast-slide" mode="out-in">
      <div
        v-if="store.actionToast && !store.pdfDownloadState.active"
        :key="store.actionToast.id"
        class="action-popup-backdrop"
        role="status"
        aria-live="polite"
        @click.self="store.dismissActionToast"
      >
        <div class="action-toast-popup" :class="`is-${store.actionToast.tone}`">
          <button type="button" class="action-toast-close" aria-label="Dismiss notification" @click="store.dismissActionToast">
            <X :size="15" />
          </button>
          <span class="action-toast-icon" aria-hidden="true">
            <Trash2 v-if="store.actionToast.tone === 'rose'" :size="22" />
            <AlertTriangle v-else-if="store.actionToast.tone === 'amber'" :size="22" />
            <CheckCircle2 v-else-if="store.actionToast.tone === 'green' || store.actionToast.tone === 'blue'" :size="22" />
            <Info v-else :size="22" />
          </span>
          <div class="action-toast-copy">
            <strong>{{ store.actionToast.title }}</strong>
            <span>{{ store.actionToast.detail }}</span>
          </div>
          <button type="button" class="action-toast-ok" @click="store.dismissActionToast">Close</button>
        </div>
      </div>
    </Transition>
  </div>
</template>
