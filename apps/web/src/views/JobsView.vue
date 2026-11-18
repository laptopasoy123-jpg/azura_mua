<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  Briefcase, CalendarDays, Download, MapPin, Pencil, Phone, RotateCcw,
  Search, SlidersHorizontal, Users, Plus, X,
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

// Job notes edit modal
const showNoteModal = ref(false)
const noteBooking = ref<Booking | null>(null)
const noteDraft = ref('')

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

const unassignedEmployeesFor = (bookingId: string) => {
  const assignedIds = new Set(store.jobForBooking(bookingId)?.employeeIds ?? [])
  return store.activeEmployees.filter((emp) => !assignedIds.has(emp.id))
}

const onSelectAssignCrew = (bookingId: string, event: Event) => {
  const selectEl = event.target as HTMLSelectElement
  const employeeId = selectEl.value
  if (!employeeId) return
  store.toggleBookingEmployee(bookingId, employeeId)
  selectEl.value = ''
}

const resetFilters = () => {
  search.value = ''
  fromDate.value = ''
  toDate.value = ''
  employeeFilter.value = ''
}

const openNoteModal = (booking: Booking) => {
  noteBooking.value = booking
  noteDraft.value = store.jobForBooking(booking.id)?.notes ?? ''
  showNoteModal.value = true
}

const saveJobNotes = () => {
  if (!noteBooking.value) return
  store.setBookingJobNotes(noteBooking.value.id, noteDraft.value)
  showNoteModal.value = false
  noteBooking.value = null
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
      stylingType: booking.stylingType,
      location: booking.location,
      servicesSummary: bookingServicesText(booking.id) || 'No service items yet',
      assignedNames: assigned.map((e) => e.name),
      notes: job?.notes || booking.notes,
      status: booking.status,
    }
  })

  const empName = employeeFilter.value && employeeFilter.value !== '__unassigned__'
    ? store.employees.find((e) => e.id === employeeFilter.value)?.name
    : employeeFilter.value === '__unassigned__'
      ? 'Unassigned'
      : undefined

  downloadJobReportPdf({
    fromDate: fromDate.value,
    toDate: toDate.value,
    filterEmployeeName: empName,
    rows,
    employees: store.activeEmployees,
    businessProfile: store.businessProfile,
  })
}
</script>

<template>
  <div class="page-stack">
    <section class="page-heading">
      <div>
        <span class="eyebrow">Workspace</span>
        <h2>Team Job Assignments</h2>
        <p>Select crew members from the dropdown per PO and download PDF duty schedules for any event date range.</p>
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
      <div><span>Filtered POs</span><strong>{{ filteredBookings.length }} POs</strong></div>
      <div><span>Assigned</span><strong>{{ assignedCount }} POs</strong></div>
      <div><span>Unassigned</span><strong>{{ unassignedCount }} POs</strong></div>
      <div><span>Active Staff</span><strong>{{ store.activeEmployees.length }} Staff</strong></div>
    </section>

    <section class="panel table-panel">
      <div class="job-filter-bar">
        <label class="table-search">
          <Search :size="17" />
          <input v-model="search" type="search" placeholder="Search PO, customer, venue, or employee…" />
        </label>

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
          <button
            v-if="search || fromDate || toDate || employeeFilter"
            type="button"
            class="soft-button"
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
              <th>PO &amp; Event Date</th>
              <th>Customer &amp; Venue</th>
              <th>Ordered Services</th>
              <th>Assigned Crew</th>
              <th>Crew Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="booking in filteredBookings" :key="booking.id">
              <td>
                <div class="job-po-cell">
                  <strong class="mono-code">{{ booking.poNumber }}</strong>
                  <span class="job-date-line">
                    <CalendarDays :size="13" />
                    {{ formatDate(booking.eventDate) }}<template v-if="booking.eventTime"> · {{ booking.eventTime }}</template>
                  </span>
                  <StatusBadge :label="displayBookingStatus(booking.status)" />
                </div>
              </td>
              <td>
                <div class="job-customer-cell">
                  <strong>{{ store.customerFor(booking.customerId)?.name }}</strong>
                  <span class="subtle-line"><Phone :size="12" />{{ store.customerFor(booking.customerId)?.phone }}</span>
                  <span class="subtle-line"><MapPin :size="12" />{{ booking.location }}</span>
                  <span v-if="booking.stylingType" class="job-styling-chip">Styling: {{ booking.stylingType }}</span>
                </div>
              </td>
              <td>
                <div class="job-services-cell">
                  <p v-if="bookingServicesText(booking.id)">{{ bookingServicesText(booking.id) }}</p>
                  <span v-else class="subtle-line">No order items yet under Orders.</span>
                </div>
              </td>
              <td>
                <div v-if="store.activeEmployees.length" class="job-crew-column">
                  <select
                    class="job-crew-select"
                    value=""
                    :disabled="!unassignedEmployeesFor(booking.id).length"
                    aria-label="Assign crew member"
                    @change="onSelectAssignCrew(booking.id, $event)"
                  >
                    <option value="">
                      {{ unassignedEmployeesFor(booking.id).length ? '+ Select crew member…' : 'All active staff assigned' }}
                    </option>
                    <option v-for="emp in unassignedEmployeesFor(booking.id)" :key="emp.id" :value="emp.id">
                      {{ emp.name }} — {{ emp.role }}
                    </option>
                  </select>

                  <div v-if="store.assignedEmployeesForBooking(booking.id).length" class="job-assigned-pills">
                    <span
                      v-for="emp in store.assignedEmployeesForBooking(booking.id)"
                      :key="emp.id"
                      class="job-assigned-pill"
                      :title="`${emp.name} · ${emp.role}`"
                    >
                      <span>{{ emp.name }}</span>
                      <button
                        type="button"
                        class="job-assigned-remove"
                        :aria-label="`Remove ${emp.name}`"
                        title="Remove from PO"
                        @click="store.toggleBookingEmployee(booking.id, emp.id)"
                      >
                        <X :size="12" />
                      </button>
                    </span>
                  </div>
                  <span v-else class="subtle-line">No crew assigned yet</span>
                </div>
                <span v-else class="subtle-line">Click "Manage Crew" above to add employees.</span>
              </td>
              <td>
                <div class="job-notes-column">
                  <small v-if="store.jobForBooking(booking.id)?.notes" class="job-note-preview">
                    {{ store.jobForBooking(booking.id)?.notes }}
                  </small>
                  <span v-else class="subtle-line">—</span>
                </div>
              </td>
              <td>
                <button
                  type="button"
                  class="icon-button"
                  title="Edit job notes for this PO"
                  @click="openNoteModal(booking)"
                >
                  <Pencil :size="16" />
                </button>
              </td>
            </tr>
            <tr v-if="!filteredBookings.length">
              <td colspan="6">
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
        <span>Showing {{ filteredBookings.length }} active POs · Use the Assigned Crew dropdown per column to add or remove staff</span>
      </footer>
    </section>

    <UiModal
      :open="showNoteModal"
      :title="noteBooking ? `Job Notes — ${noteBooking.poNumber}` : 'Job Notes'"
      description="Add call time instructions, role splits, or field notes for the crew."
      @close="showNoteModal = false"
    >
      <form class="form-grid" @submit.prevent="saveJobNotes">
        <label class="span-2">
          <span>Crew Notes / Instructions</span>
          <textarea v-model="noteDraft" rows="3" placeholder="e.g. Standby at venue by 04:30 AM, bring backup hijabdo pins" />
        </label>
        <div class="modal-actions span-2">
          <button type="button" class="secondary-button" @click="showNoteModal = false">Cancel</button>
          <button type="submit" class="primary-button">Save Notes</button>
        </div>
      </form>
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
