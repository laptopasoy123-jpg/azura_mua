<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  Briefcase, CalendarDays, Check, Download, MapPin, Pencil, Phone, RotateCcw,
  Search, SlidersHorizontal, Users, Plus, ChevronRight,
} from '@lucide/vue'
import { useCrmStore, type Booking, type EmployeeRecord } from '../stores/crm'
import { displayBookingStatus, formatDate } from '../utils/format'
import type { JobReportRow } from '../utils/jobReportPdf'
import StatusBadge from '../components/StatusBadge.vue'
import UiModal from '../components/UiModal.vue'

const store = useCrmStore()

const search = ref('')
const fromDate = ref('')
const toDate = ref('')
const employeeFilter = ref('')
const poFilter = ref('')

// Complete Job Details & Crew Selection Modal
const showDetailModal = ref(false)
const detailBookingId = ref('')
const noteDraft = ref('')

const detailBooking = computed(() =>
  detailBookingId.value ? store.bookingFor(detailBookingId.value) ?? null : null,
)
const detailCustomer = computed(() =>
  detailBooking.value ? store.customerFor(detailBooking.value.customerId) : undefined,
)
const detailServices = computed(() => {
  if (!detailBooking.value) return []
  const invoice = store.bookingInvoice(detailBooking.value.id)
  if (!invoice) return []
  return store.sortInvoiceItemsIntiFirst(
    invoice.groups?.length ? invoice.groups.flatMap((g) => g.items) : invoice.items,
  )
})

const activeBookings = computed(() =>
  [...store.bookings]
    .filter((b) => b.status !== 'Dibatalkan')
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate)),
)

const bookingServicesText = (bookingId: string) => {
  const invoice = store.bookingInvoice(bookingId)
  if (!invoice) return ''
  const allItems = store.sortInvoiceItemsIntiFirst(
    invoice.groups?.length ? invoice.groups.flatMap((g) => g.items) : invoice.items,
  )
  return allItems.map((it) => `${it.name} (${it.quantity})`).join(', ')
}

const filteredBookings = computed(() => {
  const q = search.value.trim().toLowerCase()
  return activeBookings.value.filter((booking) => {
    if (poFilter.value && booking.id !== poFilter.value) return false
    if (fromDate.value && booking.eventDate < fromDate.value) return false
    if (toDate.value && booking.eventDate > toDate.value) return false
    const assigned = store.assignedEmployeesForBooking(booking.id)
    if (employeeFilter.value === '__unassigned__') {
      if (assigned.length > 0) return false
    } else if (employeeFilter.value && !assigned.some((e) => e.id === employeeFilter.value)) {
      return false
    }
    if (!q) return true
    const customer = store.customerFor(booking.customerId)
    const staffNames = assigned.map((e) => e.name.toLowerCase()).join(' ')
    return (
      booking.poNumber.toLowerCase().includes(q)
      || booking.location.toLowerCase().includes(q)
      || (customer?.name.toLowerCase().includes(q) ?? false)
      || staffNames.includes(q)
    )
  })
})

const assignedCount = computed(() =>
  filteredBookings.value.filter((b) => store.assignedEmployeesForBooking(b.id).length > 0).length,
)
const unassignedCount = computed(() => filteredBookings.value.length - assignedCount.value)

const isEmployeeAssigned = (bookingId: string, employeeId: string) =>
  (store.jobForBooking(bookingId)?.employeeIds ?? []).includes(employeeId)

const openDetailModal = (booking: Booking) => {
  detailBookingId.value = booking.id
  noteDraft.value = store.jobForBooking(booking.id)?.notes ?? ''
  showDetailModal.value = true
}

const saveJobNotesAndClose = () => {
  if (detailBooking.value) {
    const existingNotes = store.jobForBooking(detailBooking.value.id)?.notes ?? ''
    if (noteDraft.value.trim() !== existingNotes.trim()) {
      store.setBookingJobNotes(detailBooking.value.id, noteDraft.value)
    }
  }
  showDetailModal.value = false
  detailBookingId.value = ''
}

const resetFilters = () => {
  search.value = ''
  fromDate.value = ''
  toDate.value = ''
  employeeFilter.value = ''
  poFilter.value = ''
}

// Inline employee manager modal
const showStaffModal = ref(false)
const staffForm = reactive({ name: '', role: 'MUA & Hairdo', phone: '' })
const staffError = ref('')
const editingStaff = ref<EmployeeRecord | null>(null)
const roleOptions = [
  'Owner & Lead MUA',
  'MUA & Hairdo',
  'Hijabdo Stylist',
  'Assistant MUA',
  'Wardrobe & Inventory',
  'Runner / Logistics',
  'Admin / Finance',
]

const openManageStaff = () => {
  staffError.value = ''
  editingStaff.value = null
  Object.assign(staffForm, { name: '', role: 'MUA & Hairdo', phone: '' })
  showStaffModal.value = true
}

const submitNewStaff = () => {
  try {
    staffError.value = ''
    if (!staffForm.name.trim()) throw new Error('Employee name is required.')
    if (editingStaff.value) {
      store.updateEmployee(editingStaff.value.id, {
        name: staffForm.name,
        role: staffForm.role,
        phone: staffForm.phone,
      })
      editingStaff.value = null
    } else {
      store.addEmployee({
        name: staffForm.name,
        role: staffForm.role,
        phone: staffForm.phone || undefined,
      })
    }
    Object.assign(staffForm, { name: '', role: 'MUA & Hairdo', phone: '' })
  } catch (err) {
    staffError.value = err instanceof Error ? err.message : 'Failed to save employee.'
  }
}

const startEditStaff = (emp: EmployeeRecord) => {
  editingStaff.value = emp
  Object.assign(staffForm, { name: emp.name, role: emp.role, phone: emp.phone ?? '' })
}

const exportPdf = async () => {
  const empName = employeeFilter.value && employeeFilter.value !== '__unassigned__'
    ? store.employees.find((e) => e.id === employeeFilter.value)?.name
    : employeeFilter.value === '__unassigned__'
      ? 'Unassigned'
      : undefined

  await store.runWithPdfLoader(
    'Team Job Assignments PDF',
    `${filteredBookings.value.length} PO · ${empName || 'All Staff'}`,
    async () => {
      const { downloadJobReportPdf } = await import('../utils/jobReportPdf')
      const rows: JobReportRow[] = filteredBookings.value.map((booking) => {
        const customer = store.customerFor(booking.customerId)
        const assigned = store.assignedEmployeesForBooking(booking.id)
        const job = store.jobForBooking(booking.id)
        return {
          poNumber: booking.poNumber,
          eventDate: booking.eventDate,
          eventTime: booking.eventTime,
          customerName: customer?.name ?? 'Customer',
          customerPhone: customer?.phone,
          stylingType: booking.stylingType,
          location: booking.location,
          servicesSummary: bookingServicesText(booking.id) || 'No service items yet',
          assignedNames: assigned.map((e) => e.name),
          notes: job?.notes || booking.notes,
          status: booking.status,
        }
      })

      downloadJobReportPdf({
        fromDate: fromDate.value,
        toDate: toDate.value,
        filterEmployeeName: empName,
        rows,
        employees: store.activeEmployees,
        businessProfile: store.businessProfile,
      })
    },
  )
}
</script>

<template>
  <div class="page-stack">
    <section class="page-heading">
      <div>
        <span class="eyebrow">Workspace</span>
        <h2>Team Job Assignments</h2>
        <p>Click Select Crew on any PO to inspect full job details, assign staff, or export matching PDF duty schedules.</p>
      </div>
      <div class="heading-actions">
        <button type="button" class="secondary-button" @click="openManageStaff">
          <Users :size="16" />Manage Crew ({{ store.activeEmployees.length }})
        </button>
        <button type="button" class="primary-button" @click="exportPdf">
          <Download :size="17" />Download Job Report PDF
        </button>
      </div>
    </section>

    <section class="summary-strip">
      <div><span>Filtered PO</span><strong>{{ filteredBookings.length }} PO</strong></div>
      <div><span>Assigned</span><strong>{{ assignedCount }} PO</strong></div>
      <div><span>Unassigned</span><strong>{{ unassignedCount }} PO</strong></div>
      <div><span>Active Staff</span><strong>{{ store.activeEmployees.length }} Staff</strong></div>
    </section>

    <section class="panel table-panel">
      <div class="job-filter-bar job-filter-bar--stacked">
        <div class="job-date-filters">
          <label class="job-filter-field">
            <span>From Date</span>
            <input v-model="fromDate" type="date" aria-label="From event date" />
          </label>
          <label class="job-filter-field">
            <span>To Date</span>
            <input v-model="toDate" type="date" aria-label="To event date" />
          </label>
          <label class="job-filter-field">
            <span>Filter Staff</span>
            <div class="filter-row">
              <SlidersHorizontal :size="15" />
              <select v-model="employeeFilter" aria-label="Filter employee">
                <option value="">All Employees</option>
                <option value="__unassigned__">Unassigned Only</option>
                <option v-for="emp in store.activeEmployees" :key="emp.id" :value="emp.id">
                  {{ emp.name }} ({{ emp.role }})
                </option>
              </select>
            </div>
          </label>
        </div>

        <div class="job-order-search-row">
          <label class="job-filter-field job-po-select-field">
            <span>Filter PO / Customer</span>
            <select v-model="poFilter" aria-label="Filter by PO or Customer">
              <option value="">All Active PO Orders ({{ activeBookings.length }})</option>
              <option v-for="b in activeBookings" :key="b.id" :value="b.id">
                {{ b.poNumber }} — {{ store.customerFor(b.customerId)?.name }} ({{ formatDate(b.eventDate) }})
              </option>
            </select>
          </label>
          <label class="job-filter-field job-search-field">
            <span>Search Order / Customer / Venue</span>
            <div class="table-search">
              <Search :size="17" />
              <input v-model="search" type="search" placeholder="Search PO number, customer name, venue, or staff…" />
            </div>
          </label>
          <button
            v-if="search || fromDate || toDate || employeeFilter || poFilter"
            type="button"
            class="soft-button job-reset-btn"
            title="Reset filters"
            @click="resetFilters"
          >
            <RotateCcw :size="14" />Reset
          </button>
        </div>
      </div>

      <div class="data-table-wrap">
        <table class="data-table jobs-table">
          <thead>
            <tr>
              <th>PO Number</th>
              <th>Event Date</th>
              <th>Customer &amp; Venue</th>
              <th>Assigned Crew</th>
              <th>Details &amp; Crew</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="booking in filteredBookings"
              :key="booking.id"
              class="jobs-table-row"
              @click="openDetailModal(booking)"
            >
              <td>
                <div class="job-po-cell">
                  <strong class="mono-code">{{ booking.poNumber }}</strong>
                  <StatusBadge :label="displayBookingStatus(booking.status)" />
                </div>
              </td>
              <td>
                <span class="job-date-line">
                  <CalendarDays :size="14" />
                  {{ formatDate(booking.eventDate) }}<template v-if="booking.eventTime"> · {{ booking.eventTime }}</template>
                </span>
              </td>
              <td>
                <div class="job-customer-cell">
                  <strong>{{ store.customerFor(booking.customerId)?.name }}</strong>
                  <span class="subtle-line"><MapPin :size="12" />{{ booking.location }}</span>
                </div>
              </td>
              <td>
                <div v-if="store.assignedEmployeesForBooking(booking.id).length" class="job-crew-summary">
                  <span class="job-crew-count">{{ store.assignedEmployeesForBooking(booking.id).length }} Crew</span>
                  <span class="job-crew-names">
                    {{ store.assignedEmployeesForBooking(booking.id).map((e) => e.name).join(', ') }}
                  </span>
                </div>
                <span v-else class="job-unassigned-pill">Unassigned</span>
              </td>
              <td @click.stop>
                <button
                  type="button"
                  class="soft-button job-detail-trigger"
                  @click="openDetailModal(booking)"
                >
                  <Users :size="14" />Select Crew<ChevronRight :size="14" />
                </button>
              </td>
            </tr>
            <tr v-if="!filteredBookings.length">
              <td colspan="5">
                <div class="empty-state">
                  <Briefcase :size="28" />
                  <strong>No jobs match this filter</strong>
                  <span>Adjust the date range or reset filters to view all active POs.</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <footer class="table-footer">
        <span>Showing {{ filteredBookings.length }} active PO · Click any row or Select Crew to view full details and assign staff</span>
      </footer>
    </section>

    <UiModal
      :open="showDetailModal"
      :title="detailBooking ? `Job Details & Crew Selection — ${detailBooking.poNumber}` : 'Job Details'"
      description="Complete booking details, ordered services, crew roster assignment, and field notes."
      wide
      @close="showDetailModal = false"
    >
      <template v-if="detailBooking">
        <div class="detail-grid job-overview-grid">
          <div class="job-overview-card">
            <span>PO Number &amp; Status</span>
            <div class="job-overview-inline">
              <strong class="mono-code">{{ detailBooking.poNumber }}</strong>
              <StatusBadge :label="displayBookingStatus(detailBooking.status)" />
            </div>
          </div>
          <div class="job-overview-card">
            <span>Event Schedule</span>
            <strong>{{ formatDate(detailBooking.eventDate) }}</strong>
            <small>{{ detailBooking.eventTime ? `Ready / Call Time: ${detailBooking.eventTime}` : 'Time not specified' }}</small>
          </div>
          <div class="job-overview-card">
            <span>Customer</span>
            <strong>{{ detailCustomer?.name ?? '-' }}</strong>
            <small>{{ detailCustomer?.phone ?? '-' }}</small>
          </div>
          <div class="job-overview-card">
            <span>Venue &amp; Styling</span>
            <strong>{{ detailBooking.location }}</strong>
            <small>{{ detailBooking.stylingType ? `Styling: ${detailBooking.stylingType}` : 'No styling type specified' }}</small>
          </div>
        </div>

        <div class="job-modal-section">
          <div class="job-modal-section-head">
            <strong>Ordered Services</strong>
            <span>{{ detailServices.length }} item(s)</span>
          </div>
          <div v-if="detailServices.length" class="job-modal-services">
            <span v-for="(item, idx) in detailServices" :key="`${item.name}-${idx}`" class="item-pill">
              {{ item.name }} ({{ item.quantity }} {{ item.unit || 'qty' }})
            </span>
          </div>
          <p v-else class="subtle-line">No order items recorded under Orders yet.</p>
        </div>

        <div class="job-modal-section">
          <div class="job-modal-section-head">
            <strong>Select Crew Members ({{ store.assignedEmployeesForBooking(detailBooking.id).length }} selected)</strong>
            <button type="button" class="text-link" @click="openManageStaff">+ Manage Crew Roster</button>
          </div>
          <div v-if="store.activeEmployees.length" class="job-crew-picker-grid">
            <button
              v-for="emp in store.activeEmployees"
              :key="emp.id"
              type="button"
              class="job-crew-option-card"
              :class="{ 'is-selected': isEmployeeAssigned(detailBooking.id, emp.id) }"
              @click="store.toggleBookingEmployee(detailBooking.id, emp.id)"
            >
              <span class="job-crew-check" aria-hidden="true">
                <Check v-if="isEmployeeAssigned(detailBooking.id, emp.id)" :size="14" :stroke-width="2.5" />
              </span>
              <div class="job-crew-option-info">
                <strong>{{ emp.name }}</strong>
                <small>{{ emp.role }}<template v-if="emp.phone"> · <Phone :size="10" /> {{ emp.phone }}</template></small>
              </div>
            </button>
          </div>
          <p v-else class="subtle-line">No active employees yet. Click Manage Crew Roster above to add staff.</p>
        </div>

        <form class="form-grid" @submit.prevent="saveJobNotesAndClose">
          <label class="span-2">
            <span>Crew Notes / Call-Time Instructions</span>
            <textarea v-model="noteDraft" rows="3" placeholder="e.g. Standby at venue by 04:30 AM, bring backup hijabdo pins" />
          </label>
          <div class="modal-actions span-2">
            <button type="button" class="secondary-button" @click="showDetailModal = false">Close</button>
            <button type="submit" class="primary-button">Save Notes &amp; Done</button>
          </div>
        </form>
      </template>
    </UiModal>

    <UiModal
      :open="showStaffModal"
      title="Manage Crew Roster"
      description="Add, update, or toggle staff members; active employees appear in PO assignment chips."
      wide
      @close="showStaffModal = false"
    >
      <form class="form-grid" @submit.prevent="submitNewStaff">
        <label><span>Employee Name *</span><input v-model="staffForm.name" placeholder="e.g. Sinta Dewi" /></label>
        <label><span>Role / Position *</span>
          <select v-model="staffForm.role">
            <option v-for="role in roleOptions" :key="role" :value="role">{{ role }}</option>
          </select>
        </label>
        <label class="span-2"><span>Phone / WhatsApp (optional)</span><input v-model="staffForm.phone" placeholder="08xxxxxxxxxx" /></label>
        <p v-if="staffError" class="form-error span-2">{{ staffError }}</p>
        <div class="modal-actions span-2">
          <button v-if="editingStaff" type="button" class="secondary-button" @click="editingStaff = null; Object.assign(staffForm, { name: '', role: 'MUA & Hairdo', phone: '' })">
            Cancel Edit
          </button>
          <button type="submit" class="primary-button">
            <Plus :size="15" />{{ editingStaff ? 'Save Employee' : 'Add Employee' }}
          </button>
        </div>
      </form>

      <div class="staff-manage-list">
        <h4>Registered Crew ({{ store.employees.length }})</h4>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead>
              <tr><th>Name</th><th>Role</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              <tr v-for="emp in store.employees" :key="emp.id">
                <td><strong>{{ emp.name }}</strong><span v-if="emp.phone" class="subtle-line">{{ emp.phone }}</span></td>
                <td>{{ emp.role }}</td>
                <td><StatusBadge :label="emp.active ? 'Active' : 'Inactive'" /></td>
                <td>
                  <div class="row-actions">
                    <button type="button" class="icon-button" title="Edit employee" @click="startEditStaff(emp)"><Pencil :size="15" /></button>
                    <button type="button" class="soft-button" @click="store.toggleEmployeeStatus(emp.id)">
                      {{ emp.active ? 'Deactivate' : 'Activate' }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </UiModal>
  </div>
</template>
