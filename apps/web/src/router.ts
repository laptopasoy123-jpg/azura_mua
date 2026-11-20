import { createRouter, createWebHistory } from 'vue-router'

const loadDashboardView = () => import('./views/DashboardView.vue')
const loadBookingsView = () => import('./views/BookingsView.vue')
const loadCatalogView = () => import('./views/CatalogView.vue')
const loadPaymentsView = () => import('./views/PaymentsView.vue')
const loadInventoryView = () => import('./views/InventoryView.vue')
const loadBusinessView = () => import('./views/BusinessView.vue')
const loadSettingsView = () => import('./views/SettingsView.vue')
const loadWeddingPortalView = () => import('./views/WeddingPortalView.vue')
const loadJobsView = () => import('./views/JobsView.vue')
const loadReceiptPublicView = () => import('./views/ReceiptPublicView.vue')
const loadInvoicePublicView = () => import('./views/InvoicePublicView.vue')

let prefetched = false
export const prefetchAllRoutes = () => {
  if (prefetched || typeof window === 'undefined') return
  prefetched = true
  const run = () => {
    void Promise.allSettled([
      loadDashboardView(),
      loadBookingsView(),
      loadCatalogView(),
      loadPaymentsView(),
      loadInventoryView(),
      loadBusinessView(),
      loadSettingsView(),
      loadWeddingPortalView(),
      loadJobsView(),
    ])
  }
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 1200 })
  } else {
    setTimeout(run, 250)
  }
}

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', name: 'dashboard', component: loadDashboardView, meta: { title: 'Dashboard' } },
    { path: '/wedding-portal', name: 'wedding-portal', component: loadWeddingPortalView, meta: { title: 'Wedding Portal' } },
    { path: '/customers', name: 'customers', component: loadBookingsView, meta: { title: 'Customers' } },
    { path: '/orders', name: 'orders', component: loadBusinessView, props: { module: 'orders' }, meta: { title: 'Orders' } },
    { path: '/jobs', name: 'jobs', component: loadJobsView, meta: { title: 'Team Assignments' } },
    { path: '/additional', name: 'additional', component: loadBusinessView, props: { module: 'additional' }, meta: { title: 'Add-on Services' } },
    { path: '/invoices', name: 'invoices', component: loadBusinessView, props: { module: 'invoices' }, meta: { title: 'Invoices' } },
    { path: '/payments', name: 'payments', component: loadPaymentsView, meta: { title: 'Payments' } },
    { path: '/catalog', name: 'catalog', component: loadCatalogView, meta: { title: 'Service Catalog' } },
    { path: '/expenses', name: 'expenses', component: loadBusinessView, props: { module: 'expenses' }, meta: { title: 'Expenses' } },
    { path: '/inventory', name: 'inventory', component: loadInventoryView, meta: { title: 'Inventory' } },
    { path: '/reports', name: 'reports', component: loadBusinessView, props: { module: 'reports' }, meta: { title: 'Reports' } },
    { path: '/profile', name: 'profile', component: loadSettingsView, props: { section: 'profile' }, meta: { title: 'Business Profile' } },
    { path: '/settings', name: 'settings', component: loadSettingsView, props: { section: 'dropdown' }, meta: { title: 'Dropdown Settings' } },
    { path: '/users', redirect: '/jobs' },
    { path: '/kwitansi', name: 'public-receipt', component: loadReceiptPublicView, meta: { title: 'Payment Receipt', standalone: true } },
    { path: '/invoice', name: 'public-invoice', component: loadInvoicePublicView, meta: { title: 'Official Invoice', standalone: true } },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
  ],
})

router.afterEach((to) => {
  document.title = `${String(to.meta.title ?? 'Dashboard')} — Azura MUA`
})

export default router
