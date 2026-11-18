import { createRouter, createWebHistory } from 'vue-router'

const DashboardView = () => import('./views/DashboardView.vue')
const BookingsView = () => import('./views/BookingsView.vue')
const CatalogView = () => import('./views/CatalogView.vue')
const PaymentsView = () => import('./views/PaymentsView.vue')
const InventoryView = () => import('./views/InventoryView.vue')
const BusinessView = () => import('./views/BusinessView.vue')
const SettingsView = () => import('./views/SettingsView.vue')
const WeddingPortalView = () => import('./views/WeddingPortalView.vue')
const JobsView = () => import('./views/JobsView.vue')
const ReceiptPublicView = () => import('./views/ReceiptPublicView.vue')

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', name: 'dashboard', component: DashboardView, meta: { title: 'Dashboard' } },
    { path: '/wedding-portal', name: 'wedding-portal', component: WeddingPortalView, meta: { title: 'Wedding Portal' } },
    { path: '/customers', name: 'customers', component: BookingsView, meta: { title: 'Customers' } },
    { path: '/orders', name: 'orders', component: BusinessView, props: { module: 'orders' }, meta: { title: 'Orders' } },
    { path: '/jobs', name: 'jobs', component: JobsView, meta: { title: 'Team Assignments' } },
    { path: '/additional', name: 'additional', component: BusinessView, props: { module: 'additional' }, meta: { title: 'Add-on Services' } },
    { path: '/invoices', name: 'invoices', component: BusinessView, props: { module: 'invoices' }, meta: { title: 'Invoices' } },
    { path: '/payments', name: 'payments', component: PaymentsView, meta: { title: 'Payments' } },
    { path: '/catalog', name: 'catalog', component: CatalogView, meta: { title: 'Service Catalog' } },
    { path: '/expenses', name: 'expenses', component: BusinessView, props: { module: 'expenses' }, meta: { title: 'Expenses' } },
    { path: '/inventory', name: 'inventory', component: InventoryView, meta: { title: 'Inventory' } },
    { path: '/reports', name: 'reports', component: BusinessView, props: { module: 'reports' }, meta: { title: 'Reports' } },
    { path: '/profile', name: 'profile', component: SettingsView, props: { section: 'profile' }, meta: { title: 'Business Profile' } },
    { path: '/settings', name: 'settings', component: SettingsView, props: { section: 'dropdown' }, meta: { title: 'Dropdown Settings' } },
    { path: '/users', redirect: '/jobs' },
    { path: '/kwitansi', name: 'public-receipt', component: ReceiptPublicView, meta: { title: 'Payment Receipt', standalone: true } },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
  ],
})

router.afterEach((to) => {
  document.title = `${String(to.meta.title ?? 'Dashboard')} — Azura MUA`
})

export default router
