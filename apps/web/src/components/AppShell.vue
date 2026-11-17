<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { useCrmStore } from '../stores/crm'
import UiModal from './UiModal.vue'
import {
  LayoutDashboard, UsersRound, ShoppingBag, Sparkles, ReceiptText, WalletCards,
  BookOpen, CircleDollarSign, Boxes, ChartNoAxesCombined, Building2, Settings,
  ShieldCheck, Bell, Search, Menu, X, ChevronLeft, ChevronRight,
  Shirt,
} from '@lucide/vue'

const route = useRoute()
const store = useCrmStore()
const collapsed = ref(false)
const mobileOpen = ref(false)
const showNotifications = ref(false)

const sections = [
  {
    label: 'Workspace',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/wedding-portal', label: 'Wedding Portal', icon: Shirt },
      { to: '/customers', label: 'Database Customer', icon: UsersRound },
      { to: '/orders', label: 'Pesanan', icon: ShoppingBag },
      { to: '/additional', label: 'Additional', icon: Sparkles },
      { to: '/invoices', label: 'Invoice', icon: ReceiptText },
      { to: '/payments', label: 'Pembayaran', icon: WalletCards },
      { to: '/catalog', label: 'Katalog Jasa', icon: BookOpen },
    ],
  },
  {
    label: 'Bisnis',
    items: [
      { to: '/expenses', label: 'Pengeluaran', icon: CircleDollarSign },
      { to: '/inventory', label: 'Inventory', icon: Boxes },
      { to: '/reports', label: 'Laporan', icon: ChartNoAxesCombined },
    ],
  },
  {
    label: 'Pengaturan',
    items: [
      { to: '/profile', label: 'Profil Bisnis', icon: Building2 },
      { to: '/settings', label: 'Pengaturan Sistem', icon: Settings },
      { to: '/users', label: 'Pengguna & Hak Akses', icon: ShieldCheck },
    ],
  },
]

const pageTitle = computed(() => String(route.meta.title ?? 'Dashboard'))
const closeMobile = () => { mobileOpen.value = false }
</script>

<template>
  <div class="app-frame" :class="{ 'sidebar-is-collapsed': collapsed }">
    <div v-if="mobileOpen" class="mobile-scrim" @click="closeMobile" />
    <aside class="sidebar" :class="{ 'is-mobile-open': mobileOpen }">
      <div class="brand-row">
        <div class="brand-mark"><span>A</span></div>
        <div v-if="!collapsed" class="brand-copy">
          <strong>Azura</strong>
          <span>Makeup Studio</span>
        </div>
        <button class="icon-button mobile-close" aria-label="Tutup menu" @click="closeMobile"><X :size="19" /></button>
      </div>

      <nav class="side-nav" aria-label="Navigasi utama">
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
            <component :is="item.icon" :size="19" :stroke-width="1.8" />
            <span v-if="!collapsed">{{ item.label }}</span>
          </RouterLink>
        </section>
      </nav>

      <div class="sidebar-foot">
        <button class="collapse-button" @click="collapsed = !collapsed">
          <component :is="collapsed ? ChevronRight : ChevronLeft" :size="17" />
          <span v-if="!collapsed">Ciutkan menu</span>
        </button>
      </div>
    </aside>

    <div class="workspace">
      <header class="topbar">
        <div class="topbar-title">
          <button class="icon-button mobile-menu" aria-label="Buka menu" @click="mobileOpen = true"><Menu :size="21" /></button>
          <div>
            <p>Azura MUA <span>/</span></p>
            <h1>{{ pageTitle }}</h1>
          </div>
        </div>
        <div class="topbar-actions">
          <label class="global-search">
            <Search :size="17" />
            <input type="search" placeholder="Cari PO, customer, invoice…" />
            <kbd>⌘ K</kbd>
          </label>
          <button class="icon-button notification-button" aria-label="Notifikasi" @click="showNotifications = true"><Bell :size="19" /><i /></button>
          <div class="profile-chip">
            <div class="profile-avatar">AR</div>
            <div><strong>Aura Rahma</strong><span>Owner</span></div>
          </div>
        </div>
      </header>

      <main class="page-area">
        <RouterView />
      </main>
    </div>

    <UiModal :open="showNotifications" title="Notifikasi" description="Aktivitas terbaru pada workspace Azura MUA." @close="showNotifications = false">
      <div class="notification-list">
        <article v-for="activity in store.activities.slice(0, 6)" :key="activity.id"><i :class="`activity-${activity.tone}`" /><div><strong>{{ activity.title }}</strong><span>{{ activity.detail }}</span></div><time>{{ new Date(activity.at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) }}</time></article>
      </div>
      <div class="modal-actions"><button class="primary-button" @click="showNotifications = false">Tutup</button></div>
    </UiModal>
  </div>
</template>
