import { createRouter, createWebHistory } from 'vue-router'

const DashboardView = () => import('./views/DashboardView.vue')
const BookingsView = () => import('./views/BookingsView.vue')
const CatalogView = () => import('./views/CatalogView.vue')
const PaymentsView = () => import('./views/PaymentsView.vue')
const InventoryView = () => import('./views/InventoryView.vue')
const BusinessView = () => import('./views/BusinessView.vue')
const SettingsView = () => import('./views/SettingsView.vue')
const WeddingPortalView = () => import('./views/WeddingPortalView.vue')

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', name: 'dashboard', component: DashboardView, meta: { title: 'Dashboard' } },
    { path: '/wedding-portal', name: 'wedding-portal', component: WeddingPortalView, meta: { title: 'Wedding Portal' } },
    { path: '/customers', name: 'customers', component: BookingsView, meta: { title: 'Database Customer' } },
    { path: '/orders', name: 'orders', component: BusinessView, props: { module: 'orders' }, meta: { title: 'Pesanan' } },
    { path: '/additional', name: 'additional', component: BusinessView, props: { module: 'additional' }, meta: { title: 'Additional' } },
    { path: '/invoices', name: 'invoices', component: BusinessView, props: { module: 'invoices' }, meta: { title: 'Invoice' } },
    { path: '/payments', name: 'payments', component: PaymentsView, meta: { title: 'Pembayaran' } },
    { path: '/catalog', name: 'catalog', component: CatalogView, meta: { title: 'Katalog Jasa' } },
    { path: '/expenses', name: 'expenses', component: BusinessView, props: { module: 'expenses' }, meta: { title: 'Pengeluaran' } },
    { path: '/inventory', name: 'inventory', component: InventoryView, meta: { title: 'Inventory' } },
    { path: '/reports', name: 'reports', component: BusinessView, props: { module: 'reports' }, meta: { title: 'Laporan' } },
    { path: '/profile', name: 'profile', component: SettingsView, props: { section: 'profile' }, meta: { title: 'Profil Bisnis' } },
    { path: '/settings', name: 'settings', component: SettingsView, props: { section: 'system' }, meta: { title: 'Pengaturan Sistem' } },
    { path: '/users', name: 'users', component: SettingsView, props: { section: 'users' }, meta: { title: 'Pengguna & Hak Akses' } },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
  ],
})

router.afterEach((to) => {
  document.title = `${String(to.meta.title ?? 'Dashboard')} — Azura MUA`
})

export default router
