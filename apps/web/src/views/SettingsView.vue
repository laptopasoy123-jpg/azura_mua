<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  Building2,
  LoaderCircle,
  Pencil,
  Plus,
  Save,
  Trash2,
  UploadCloud,
  Users,
  WalletCards,
  Receipt,
  Check,
  X,
  Sparkles,
  Boxes,
  Ruler,
  Package,
} from '@lucide/vue'
import { useCrmStore, type DropdownOptionGroup, type EmployeeRecord, type InventoryItem } from '../stores/crm'
import { sortAlpha } from '../utils/format'
import { uploadImageWithFallback } from '../utils/uploadImage'
import UiModal from '../components/UiModal.vue'
import SearchSelect from '../components/SearchSelect.vue'

const props = withDefaults(defineProps<{ section?: 'profile' | 'dropdown' }>(), {
  section: 'profile',
})
const store = useCrmStore()

const isDropdownMode = computed(() => props.section === 'dropdown')

const profileForm = reactive({
  name: store.businessProfile.name,
  tagline: store.businessProfile.tagline,
  phone: store.businessProfile.phone,
  email: store.businessProfile.email,
  address: store.businessProfile.address,
  invoiceNote: store.businessProfile.invoiceNote,
  logoUrl: store.businessProfile.logoUrl ?? '',
})

watch(
  () => store.businessProfile,
  (next) => {
    Object.assign(profileForm, {
      name: next.name,
      tagline: next.tagline,
      phone: next.phone,
      email: next.email,
      address: next.address,
      invoiceNote: next.invoiceNote,
      logoUrl: next.logoUrl ?? '',
    })
  },
  { deep: true },
)

const uploadingLogo = ref(false)
const uploadError = ref('')
const showSaved = ref(false)

const handleLogoUpload = async (event: Event) => {
  const inputEl = event.target as HTMLInputElement
  const file = inputEl.files?.[0]
  if (!file) return
  uploadError.value = ''
  uploadingLogo.value = true
  try {
    const res = await uploadImageWithFallback(file, 'business-logo')
    profileForm.logoUrl = res.url
    store.updateBusinessProfile({ logoUrl: res.url })
  } catch (err) {
    uploadError.value = err instanceof Error ? err.message : 'Failed to upload logo image.'
  } finally {
    uploadingLogo.value = false
    inputEl.value = ''
  }
}

const removeLogo = () => {
  profileForm.logoUrl = ''
  store.updateBusinessProfile({ logoUrl: '' })
}

const saveProfile = () => {
  store.updateBusinessProfile({
    name: profileForm.name.trim() || 'AZURA',
    tagline: profileForm.tagline.trim() || 'MAKEUP ARTIST',
    phone: profileForm.phone.trim(),
    email: profileForm.email.trim(),
    address: profileForm.address.trim(),
    invoiceNote: profileForm.invoiceNote.trim(),
    logoUrl: profileForm.logoUrl,
  })
  showSaved.value = true
}

// --- Dropdown & Master List Management ---
const dropdownFeedback = ref('')

// Employees
const newEmployee = reactive({ name: '', role: 'MUA / Team', phone: '' })
const editingEmpId = ref('')
const editEmpDraft = reactive({ name: '', role: '', phone: '' })

const handleAddEmployee = () => {
  dropdownFeedback.value = ''
  try {
    store.addEmployee({
      name: newEmployee.name,
      role: newEmployee.role || 'MUA / Team',
      phone: newEmployee.phone,
      active: true,
    })
    newEmployee.name = ''
    newEmployee.role = 'MUA / Team'
    newEmployee.phone = ''
  } catch (err) {
    dropdownFeedback.value = err instanceof Error ? err.message : 'Failed to add employee.'
  }
}

const startEditEmployee = (emp: EmployeeRecord) => {
  editingEmpId.value = emp.id
  editEmpDraft.name = emp.name
  editEmpDraft.role = emp.role
  editEmpDraft.phone = emp.phone ?? ''
}

const saveEditEmployee = (emp: EmployeeRecord) => {
  dropdownFeedback.value = ''
  if (!editEmpDraft.name.trim()) {
    dropdownFeedback.value = 'Employee name cannot be empty.'
    return
  }
  store.updateEmployee(emp.id, {
    name: editEmpDraft.name,
    role: editEmpDraft.role || 'MUA / Team',
    phone: editEmpDraft.phone,
  })
  editingEmpId.value = ''
}

// Generic dropdown groups
const newOptionInput = reactive<Record<DropdownOptionGroup, string>>({
  paymentMethods: '',
  poExpenseCategories: '',
  generalExpenseCategories: '',
  stylingTypes: '',
  inventoryCategories: '',
  units: '',
})
const editingOption = reactive<{ group: DropdownOptionGroup | ''; oldLabel: string; draft: string }>({
  group: '',
  oldLabel: '',
  draft: '',
})

const handleAddOption = (group: DropdownOptionGroup) => {
  dropdownFeedback.value = ''
  try {
    store.addDropdownOption(group, newOptionInput[group])
    newOptionInput[group] = ''
  } catch (err) {
    dropdownFeedback.value = err instanceof Error ? err.message : 'Failed to add option.'
  }
}

const startEditOption = (group: DropdownOptionGroup, label: string) => {
  editingOption.group = group
  editingOption.oldLabel = label
  editingOption.draft = label
}

const saveEditOption = () => {
  if (!editingOption.group || !editingOption.oldLabel) return
  dropdownFeedback.value = ''
  try {
    store.updateDropdownOption(editingOption.group, editingOption.oldLabel, editingOption.draft)
    editingOption.group = ''
    editingOption.oldLabel = ''
    editingOption.draft = ''
  } catch (err) {
    dropdownFeedback.value = err instanceof Error ? err.message : 'Failed to update option.'
  }
}

const handleRemoveOption = (group: DropdownOptionGroup, label: string) => {
  dropdownFeedback.value = ''
  try {
    store.removeDropdownOption(group, label)
  } catch (err) {
    dropdownFeedback.value = err instanceof Error ? err.message : 'Failed to remove option.'
  }
}

// Inventory Item Names & Product Photos master dropdown management
const newInvItem = reactive({
  name: '',
  category: store.inventoryCategories[0] ?? 'Complexion',
  unit: store.units[0] ?? 'pcs',
  imageUrl: '',
})
const uploadingNewInvPhoto = ref(false)
const uploadingInvId = ref('')
const editingInvId = ref('')
const editInvDraft = reactive({ name: '', category: '', unit: '', imageUrl: '' })

const handleNewInvPhoto = async (event: Event) => {
  const inputEl = event.target as HTMLInputElement
  const file = inputEl.files?.[0]
  if (!file) return
  dropdownFeedback.value = ''
  uploadingNewInvPhoto.value = true
  try {
    const res = await uploadImageWithFallback(file, 'inventory')
    newInvItem.imageUrl = res.url
  } catch (err) {
    dropdownFeedback.value = err instanceof Error ? err.message : 'Failed to upload inventory product photo.'
  } finally {
    uploadingNewInvPhoto.value = false
    inputEl.value = ''
  }
}

const handleRowInvPhoto = async (item: InventoryItem, event: Event) => {
  const inputEl = event.target as HTMLInputElement
  const file = inputEl.files?.[0]
  if (!file) return
  dropdownFeedback.value = ''
  uploadingInvId.value = item.id
  try {
    const res = await uploadImageWithFallback(file, 'inventory')
    store.updateInventoryItem(item.id, {
      name: item.name,
      category: item.category,
      unit: item.unit,
      location: item.location,
      initialStock: item.initialStock,
      minimumStock: item.minimumStock,
      imageUrl: res.url,
    })
    if (editingInvId.value === item.id) {
      editInvDraft.imageUrl = res.url
    }
  } catch (err) {
    dropdownFeedback.value = err instanceof Error ? err.message : 'Failed to upload product photo.'
  } finally {
    uploadingInvId.value = ''
    inputEl.value = ''
  }
}

const clearRowInvPhoto = (item: InventoryItem) => {
  store.updateInventoryItem(item.id, {
    name: item.name,
    category: item.category,
    unit: item.unit,
    location: item.location,
    initialStock: item.initialStock,
    minimumStock: item.minimumStock,
    imageUrl: '',
  })
  if (editingInvId.value === item.id) {
    editInvDraft.imageUrl = ''
  }
}

const handleAddInvItem = () => {
  dropdownFeedback.value = ''
  const name = newInvItem.name.trim()
  if (!name) {
    dropdownFeedback.value = 'Inventory item name cannot be empty.'
    return
  }
  store.addInventoryItem({
    name,
    category: newInvItem.category || store.inventoryCategories[0] || 'Complexion',
    unit: newInvItem.unit || store.units[0] || 'pcs',
    location: 'Studio Rack',
    initialStock: 0,
    minimumStock: 2,
    imageUrl: newInvItem.imageUrl || undefined,
  })
  newInvItem.name = ''
  newInvItem.imageUrl = ''
}

const startEditInvItem = (item: InventoryItem) => {
  editingInvId.value = item.id
  editInvDraft.name = item.name
  editInvDraft.category = item.category
  editInvDraft.unit = item.unit
  editInvDraft.imageUrl = item.imageUrl ?? ''
}

const saveEditInvItem = (item: InventoryItem) => {
  dropdownFeedback.value = ''
  if (!editInvDraft.name.trim()) {
    dropdownFeedback.value = 'Inventory item name cannot be empty.'
    return
  }
  store.updateInventoryItem(item.id, {
    name: editInvDraft.name,
    category: editInvDraft.category || item.category,
    unit: editInvDraft.unit || item.unit,
    location: item.location,
    initialStock: item.initialStock,
    minimumStock: item.minimumStock,
    imageUrl: editInvDraft.imageUrl,
  })
  editingInvId.value = ''
}

const handleDeleteInvItem = (item: InventoryItem) => {
  dropdownFeedback.value = ''
  try {
    store.deleteInventoryItem(item.id)
  } catch (err) {
    dropdownFeedback.value = err instanceof Error ? err.message : 'Failed to delete inventory item.'
  }
}

const sortedEmployees = computed(() => sortAlpha(store.employees, (emp) => emp.name))
const sortedPaymentMethods = computed(() => sortAlpha(store.paymentMethods, (x) => x))
const sortedPoCategories = computed(() => sortAlpha(store.poExpenseCategories, (x) => x))
const sortedGeneralCategories = computed(() => sortAlpha(store.generalExpenseCategories, (x) => x))
const sortedStylingTypes = computed(() => sortAlpha(store.stylingTypes, (x) => x))
const sortedInventoryCategories = computed(() => sortAlpha(store.inventoryCategories, (x) => x))
const sortedUnits = computed(() => sortAlpha(store.units, (x) => x))
const sortedInventory = computed(() => sortAlpha(store.inventory, (item) => item.name))

const invCategoryOptions = computed(() =>
  sortedInventoryCategories.value.map((c) => ({ value: c, label: c })),
)

const invUnitOptions = computed(() =>
  sortedUnits.value.map((u) => ({ value: u, label: u })),
)
</script>

<template>
  <div class="page-stack">
    <section class="page-heading">
      <div>
        <span class="eyebrow">Settings</span>
        <h2>{{ isDropdownMode ? 'Dropdown Settings & Master Lists' : 'Business Profile' }}</h2>
        <p>
          {{
            isDropdownMode
              ? 'Manage all selectable dropdown lists used across Bookings, Payments, Expenses, Service Catalog, and Inventory.'
              : 'Configure studio identity, logo, and footer notes displayed across web views, invoices, receipts, and PDF reports.'
          }}
        </p>
      </div>
      <div v-if="!isDropdownMode" class="heading-actions">
        <button type="button" class="primary-button" :disabled="uploadingLogo" @click="saveProfile">
          <Save :size="17" />Save Changes
        </button>
      </div>
    </section>

    <!-- BUSINESS PROFILE SECTION -->
    <section v-if="!isDropdownMode" class="settings-layout">
      <article class="panel settings-card">
        <header>
          <span class="settings-icon"><Building2 :size="21" /></span>
          <div>
            <h3>Business Identity &amp; Logo</h3>
            <p>Displayed in the sidebar header, invoices, payment receipts, and all downloadable PDF documents.</p>
          </div>
        </header>

        <div class="form-grid">
          <div class="span-2 attire-upload-block">
            <span class="upload-field-label">Studio Brand Logo (Used on Web, Invoices &amp; Receipts)</span>
            <label class="upload-zone logo-upload-zone">
              <img v-if="profileForm.logoUrl" :src="profileForm.logoUrl" alt="Business logo" class="uploaded-logo-preview" />
              <div v-else>
                <span class="logo-upload-cta-icon"><UploadCloud :size="22" /></span>
                <div class="logo-upload-cta-copy">
                  <strong>Upload JPG, PNG (transparent), or WebP logo</strong>
                  <span>Square aspect ratio recommended · Max 5 MB</span>
                </div>
                <span class="logo-upload-cta-pill">Choose File</span>
              </div>
              <input type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" @change="handleLogoUpload" />
            </label>
            <div v-if="profileForm.logoUrl" class="logo-upload-actions">
              <button type="button" class="soft-button remove-photo-btn" @click="removeLogo">
                <Trash2 :size="14" />Remove Logo &amp; Use Default Monogram
              </button>
            </div>
            <p v-if="uploadingLogo" class="upload-state"><LoaderCircle class="spin" :size="15" />Processing logo…</p>
            <p v-if="uploadError" class="form-error">{{ uploadError }}</p>
          </div>

          <label class="is-required"><span>Brand / Business Name *</span><input v-model="profileForm.name" placeholder="e.g. AZURA" /></label>
          <label class="is-optional"><span>Subtitle / Tagline <em class="opt-tag">Optional</em></span><input v-model="profileForm.tagline" placeholder="e.g. MAKEUP ARTIST" /></label>
          <label class="is-optional"><span>Phone / WhatsApp <em class="opt-tag">Optional</em></span><input v-model="profileForm.phone" placeholder="08xxxxxxxxxx" /></label>
          <label class="is-optional"><span>Email Address <em class="opt-tag">Optional</em></span><input v-model="profileForm.email" type="email" placeholder="hello@azuramakeup.id" /></label>
          <label class="span-2 is-optional"><span>Studio Address <em class="opt-tag">Optional</em></span><textarea v-model="profileForm.address" rows="2" /></label>
          <label class="span-2 is-optional"><span>Invoice &amp; Receipt Footer Note <em class="opt-tag">Optional</em></span><textarea v-model="profileForm.invoiceNote" rows="2" /></label>
        </div>
      </article>

      <aside class="panel brand-preview">
        <span class="eyebrow">Brand &amp; Document Preview</span>
        <div class="preview-logo" :class="{ 'has-custom-logo': Boolean(profileForm.logoUrl) }">
          <img v-if="profileForm.logoUrl" :src="profileForm.logoUrl" :alt="profileForm.name" />
          <template v-else>{{ (profileForm.name || 'A').slice(0, 1).toUpperCase() }}</template>
        </div>
        <h3>{{ profileForm.name || 'AZURA' }}</h3>
        <small class="brand-preview-tagline">{{ profileForm.tagline || 'MAKEUP ARTIST' }}</small>
        <p>{{ profileForm.address }}</p>
        <span>{{ profileForm.phone }} · {{ profileForm.email }}</span>
      </aside>
    </section>

    <!-- DROPDOWN SETTINGS SECTION (DEDICATED) -->
    <section v-else class="dropdown-settings-grid">
      <p v-if="dropdownFeedback" class="form-error dropdown-feedback-banner" role="alert">{{ dropdownFeedback }}</p>

      <!-- Card 1: Employees -->
      <article class="panel settings-card dropdown-setting-card">
        <header>
          <span class="settings-icon"><Users :size="20" /></span>
          <div>
            <h3>Employee Roster</h3>
            <p>Used in Team Job Assignments and Inventory PIC dropdowns.</p>
          </div>
          <span class="dropdown-count-pill">{{ store.employees.length }}</span>
        </header>

        <form class="dropdown-add-row dropdown-add-employee" @submit.prevent="handleAddEmployee">
          <input v-model="newEmployee.name" placeholder="Employee name *" />
          <input v-model="newEmployee.role" placeholder="Role / position" />
          <button type="submit" class="primary-button"><Plus :size="15" />Add</button>
        </form>

        <ul class="dropdown-option-list is-scrollable">
          <li v-for="emp in sortedEmployees" :key="emp.id" class="dropdown-option-row" :class="{ 'is-inactive': !emp.active }">
            <template v-if="editingEmpId === emp.id">
              <div class="dropdown-edit-inline">
                <input v-model="editEmpDraft.name" placeholder="Employee name" />
                <input v-model="editEmpDraft.role" placeholder="Role" />
              </div>
              <div class="action-row">
                <button type="button" class="icon-button" title="Save" @click="saveEditEmployee(emp)"><Check :size="15" /></button>
                <button type="button" class="icon-button" title="Cancel" @click="editingEmpId = ''"><X :size="15" /></button>
              </div>
            </template>
            <template v-else>
              <div class="dropdown-option-label">
                <strong>{{ emp.name }}</strong>
                <small>{{ emp.role }} · {{ emp.active ? 'Active' : 'Inactive' }}</small>
              </div>
              <div class="action-row">
                <button type="button" class="soft-button" @click="store.toggleEmployeeStatus(emp.id)">
                  {{ emp.active ? 'Deactivate' : 'Activate' }}
                </button>
                <button type="button" class="icon-button" title="Edit employee" @click="startEditEmployee(emp)">
                  <Pencil :size="14" />
                </button>
              </div>
            </template>
          </li>
        </ul>
        <p class="dropdown-settings-note"><span>Sorted A–Z · Showing all {{ sortedEmployees.length }} staff</span><span>Scroll list to view more</span></p>
      </article>

      <!-- Card 2: Payment Methods -->
      <article class="panel settings-card dropdown-setting-card">
        <header>
          <span class="settings-icon"><WalletCards :size="20" /></span>
          <div>
            <h3>Payment Methods</h3>
            <p>Appears in Payments, Customer Refunds, and Expense recording.</p>
          </div>
          <span class="dropdown-count-pill">{{ store.paymentMethods.length }}</span>
        </header>

        <form class="dropdown-add-row" @submit.prevent="handleAddOption('paymentMethods')">
          <input v-model="newOptionInput.paymentMethods" placeholder="Add method, e.g. Bank Transfer / EDC" />
          <button type="submit" class="primary-button"><Plus :size="15" />Add</button>
        </form>

        <ul class="dropdown-option-list is-scrollable">
          <li v-for="item in sortedPaymentMethods" :key="item" class="dropdown-option-row">
            <template v-if="editingOption.group === 'paymentMethods' && editingOption.oldLabel === item">
              <div class="dropdown-edit-inline">
                <input v-model="editingOption.draft" placeholder="Method name" />
              </div>
              <div class="action-row">
                <button type="button" class="icon-button" title="Save" @click="saveEditOption"><Check :size="15" /></button>
                <button type="button" class="icon-button" title="Cancel" @click="editingOption.group = ''"><X :size="15" /></button>
              </div>
            </template>
            <template v-else>
              <div class="dropdown-option-label"><strong>{{ item }}</strong></div>
              <div class="action-row">
                <button type="button" class="icon-button" title="Edit method" @click="startEditOption('paymentMethods', item)"><Pencil :size="14" /></button>
                <button type="button" class="icon-button danger-icon-btn" title="Remove method" @click="handleRemoveOption('paymentMethods', item)"><Trash2 :size="14" /></button>
              </div>
            </template>
          </li>
        </ul>
        <p class="dropdown-settings-note"><span>Sorted A–Z · Showing all {{ sortedPaymentMethods.length }} options</span><span>Scroll list to view more</span></p>
      </article>

      <!-- Card 3: PO Expense Categories -->
      <article class="panel settings-card dropdown-setting-card">
        <header>
          <span class="settings-icon"><Receipt :size="20" /></span>
          <div>
            <h3>PO Expense Categories</h3>
            <p>Selectable when recording expenses linked to a customer PO.</p>
          </div>
          <span class="dropdown-count-pill">{{ store.poExpenseCategories.length }}</span>
        </header>

        <form class="dropdown-add-row" @submit.prevent="handleAddOption('poExpenseCategories')">
          <input v-model="newOptionInput.poExpenseCategories" placeholder="e.g. Freelance Fee / Fresh Jasmine" />
          <button type="submit" class="primary-button"><Plus :size="15" />Add</button>
        </form>

        <ul class="dropdown-option-list is-scrollable">
          <li v-for="item in sortedPoCategories" :key="item" class="dropdown-option-row">
            <template v-if="editingOption.group === 'poExpenseCategories' && editingOption.oldLabel === item">
              <div class="dropdown-edit-inline">
                <input v-model="editingOption.draft" placeholder="PO category name" />
              </div>
              <div class="action-row">
                <button type="button" class="icon-button" title="Save" @click="saveEditOption"><Check :size="15" /></button>
                <button type="button" class="icon-button" title="Cancel" @click="editingOption.group = ''"><X :size="15" /></button>
              </div>
            </template>
            <template v-else>
              <div class="dropdown-option-label"><strong>{{ item }}</strong></div>
              <div class="action-row">
                <button type="button" class="icon-button" title="Edit category" @click="startEditOption('poExpenseCategories', item)"><Pencil :size="14" /></button>
                <button type="button" class="icon-button danger-icon-btn" title="Remove category" @click="handleRemoveOption('poExpenseCategories', item)"><Trash2 :size="14" /></button>
              </div>
            </template>
          </li>
        </ul>
        <p class="dropdown-settings-note"><span>Sorted A–Z · Showing all {{ sortedPoCategories.length }} categories</span><span>Scroll list to view more</span></p>
      </article>

      <!-- Card 4: General Expense Categories -->
      <article class="panel settings-card dropdown-setting-card">
        <header>
          <span class="settings-icon"><Receipt :size="20" /></span>
          <div>
            <h3>General Studio Expense Categories</h3>
            <p>Selectable when logging studio overhead expenses outside a PO.</p>
          </div>
          <span class="dropdown-count-pill">{{ store.generalExpenseCategories.length }}</span>
        </header>

        <form class="dropdown-add-row" @submit.prevent="handleAddOption('generalExpenseCategories')">
          <input v-model="newOptionInput.generalExpenseCategories" placeholder="e.g. Studio Rent / Electricity" />
          <button type="submit" class="primary-button"><Plus :size="15" />Add</button>
        </form>

        <ul class="dropdown-option-list is-scrollable">
          <li v-for="item in sortedGeneralCategories" :key="item" class="dropdown-option-row">
            <template v-if="editingOption.group === 'generalExpenseCategories' && editingOption.oldLabel === item">
              <div class="dropdown-edit-inline">
                <input v-model="editingOption.draft" placeholder="General category name" />
              </div>
              <div class="action-row">
                <button type="button" class="icon-button" title="Save" @click="saveEditOption"><Check :size="15" /></button>
                <button type="button" class="icon-button" title="Cancel" @click="editingOption.group = ''"><X :size="15" /></button>
              </div>
            </template>
            <template v-else>
              <div class="dropdown-option-label"><strong>{{ item }}</strong></div>
              <div class="action-row">
                <button type="button" class="icon-button" title="Edit category" @click="startEditOption('generalExpenseCategories', item)"><Pencil :size="14" /></button>
                <button type="button" class="icon-button danger-icon-btn" title="Remove category" @click="handleRemoveOption('generalExpenseCategories', item)"><Trash2 :size="14" /></button>
              </div>
            </template>
          </li>
        </ul>
        <p class="dropdown-settings-note"><span>Sorted A–Z · Showing all {{ sortedGeneralCategories.length }} categories</span><span>Scroll list to view more</span></p>
      </article>

      <!-- Card 5: Styling Types -->
      <article class="panel settings-card dropdown-setting-card">
        <header>
          <span class="settings-icon"><Sparkles :size="20" /></span>
          <div>
            <h3>Styling Types</h3>
            <p>Appears in Customer Bookings &amp; PO event forms (Hairdo, Hijabdo, Paes).</p>
          </div>
          <span class="dropdown-count-pill">{{ store.stylingTypes.length }}</span>
        </header>

        <form class="dropdown-add-row" @submit.prevent="handleAddOption('stylingTypes')">
          <input v-model="newOptionInput.stylingTypes" placeholder="e.g. Modern Sanggul / Paes Solo" />
          <button type="submit" class="primary-button"><Plus :size="15" />Add</button>
        </form>

        <ul class="dropdown-option-list is-scrollable">
          <li v-for="item in sortedStylingTypes" :key="item" class="dropdown-option-row">
            <template v-if="editingOption.group === 'stylingTypes' && editingOption.oldLabel === item">
              <div class="dropdown-edit-inline">
                <input v-model="editingOption.draft" placeholder="Styling type" />
              </div>
              <div class="action-row">
                <button type="button" class="icon-button" title="Save" @click="saveEditOption"><Check :size="15" /></button>
                <button type="button" class="icon-button" title="Cancel" @click="editingOption.group = ''"><X :size="15" /></button>
              </div>
            </template>
            <template v-else>
              <div class="dropdown-option-label"><strong>{{ item }}</strong></div>
              <div class="action-row">
                <button type="button" class="icon-button" title="Edit styling" @click="startEditOption('stylingTypes', item)"><Pencil :size="14" /></button>
                <button type="button" class="icon-button danger-icon-btn" title="Remove styling" @click="handleRemoveOption('stylingTypes', item)"><Trash2 :size="14" /></button>
              </div>
            </template>
          </li>
        </ul>
        <p class="dropdown-settings-note"><span>Sorted A–Z · Showing all {{ sortedStylingTypes.length }} options</span><span>Scroll list to view more</span></p>
      </article>

      <!-- Card 6: Inventory Categories -->
      <article class="panel settings-card dropdown-setting-card">
        <header>
          <span class="settings-icon"><Boxes :size="20" /></span>
          <div>
            <h3>Inventory Categories</h3>
            <p>Category dropdown options for organizing makeup &amp; studio supply items.</p>
          </div>
          <span class="dropdown-count-pill">{{ store.inventoryCategories.length }}</span>
        </header>

        <form class="dropdown-add-row" @submit.prevent="handleAddOption('inventoryCategories')">
          <input v-model="newOptionInput.inventoryCategories" placeholder="e.g. Brush Set / Adhesives" />
          <button type="submit" class="primary-button"><Plus :size="15" />Add</button>
        </form>

        <ul class="dropdown-option-list is-scrollable">
          <li v-for="item in sortedInventoryCategories" :key="item" class="dropdown-option-row">
            <template v-if="editingOption.group === 'inventoryCategories' && editingOption.oldLabel === item">
              <div class="dropdown-edit-inline">
                <input v-model="editingOption.draft" placeholder="Category name" />
              </div>
              <div class="action-row">
                <button type="button" class="icon-button" title="Save" @click="saveEditOption"><Check :size="15" /></button>
                <button type="button" class="icon-button" title="Cancel" @click="editingOption.group = ''"><X :size="15" /></button>
              </div>
            </template>
            <template v-else>
              <div class="dropdown-option-label"><strong>{{ item }}</strong></div>
              <div class="action-row">
                <button type="button" class="icon-button" title="Edit category" @click="startEditOption('inventoryCategories', item)"><Pencil :size="14" /></button>
                <button type="button" class="icon-button danger-icon-btn" title="Remove category" @click="handleRemoveOption('inventoryCategories', item)"><Trash2 :size="14" /></button>
              </div>
            </template>
          </li>
        </ul>
        <p class="dropdown-settings-note"><span>Sorted A–Z · Showing all {{ sortedInventoryCategories.length }} categories</span><span>Scroll list to view more</span></p>
      </article>

      <!-- Card 7: Measurement Units -->
      <article class="panel settings-card dropdown-setting-card">
        <header>
          <span class="settings-icon"><Ruler :size="20" /></span>
          <div>
            <h3>Units of Measure</h3>
            <p>Shared unit options across Service Catalog and Inventory items.</p>
          </div>
          <span class="dropdown-count-pill">{{ store.units.length }}</span>
        </header>

        <form class="dropdown-add-row" @submit.prevent="handleAddOption('units')">
          <input v-model="newOptionInput.units" placeholder="e.g. box / tube / ml" />
          <button type="submit" class="primary-button"><Plus :size="15" />Add</button>
        </form>

        <ul class="dropdown-option-list is-scrollable">
          <li v-for="item in sortedUnits" :key="item" class="dropdown-option-row">
            <template v-if="editingOption.group === 'units' && editingOption.oldLabel === item">
              <div class="dropdown-edit-inline">
                <input v-model="editingOption.draft" placeholder="Unit label" />
              </div>
              <div class="action-row">
                <button type="button" class="icon-button" title="Save" @click="saveEditOption"><Check :size="15" /></button>
                <button type="button" class="icon-button" title="Cancel" @click="editingOption.group = ''"><X :size="15" /></button>
              </div>
            </template>
            <template v-else>
              <div class="dropdown-option-label"><strong>{{ item }}</strong></div>
              <div class="action-row">
                <button type="button" class="icon-button" title="Edit unit" @click="startEditOption('units', item)"><Pencil :size="14" /></button>
                <button type="button" class="icon-button danger-icon-btn" title="Remove unit" @click="handleRemoveOption('units', item)"><Trash2 :size="14" /></button>
              </div>
            </template>
          </li>
        </ul>
        <p class="dropdown-settings-note"><span>Sorted A–Z · Showing all {{ sortedUnits.length }} units</span><span>Scroll list to view more</span></p>
      </article>

      <!-- Card 8: Inventory Item Names & Product Photos -->
      <article class="panel settings-card dropdown-setting-card">
        <header>
          <span class="settings-icon"><Package :size="20" /></span>
          <div>
            <h3>Inventory Item Names &amp; Photos</h3>
            <p>Upload product images and manage item names synced with Inventory Catalog, Stock Monitor, and Stock PDFs.</p>
          </div>
          <span class="dropdown-count-pill">{{ store.inventory.length }}</span>
        </header>

        <form class="dropdown-add-row dropdown-add-inventory" @submit.prevent="handleAddInvItem">
          <label class="inv-photo-pick-btn" :title="newInvItem.imageUrl ? 'Change product photo' : 'Upload product photo'">
            <img v-if="newInvItem.imageUrl" :src="newInvItem.imageUrl" alt="New item preview" />
            <LoaderCircle v-else-if="uploadingNewInvPhoto" class="spin" :size="16" />
            <UploadCloud v-else :size="16" />
            <input type="file" accept="image/jpeg,image/png,image/webp" @change="handleNewInvPhoto" />
          </label>
          <input v-model="newInvItem.name" placeholder="Item name *" />
          <SearchSelect v-model="newInvItem.category" :options="invCategoryOptions" size="sm" search-placeholder="Category…" />
          <button type="submit" class="primary-button" :disabled="uploadingNewInvPhoto"><Plus :size="15" />Add</button>
        </form>

        <ul class="dropdown-option-list is-scrollable">
          <li v-for="item in sortedInventory" :key="item.id" class="dropdown-option-row">
            <template v-if="editingInvId === item.id">
              <label class="inv-photo-pick-btn" title="Upload product photo">
                <img v-if="editInvDraft.imageUrl" :src="editInvDraft.imageUrl" :alt="item.name" />
                <LoaderCircle v-else-if="uploadingInvId === item.id" class="spin" :size="15" />
                <UploadCloud v-else :size="15" />
                <input type="file" accept="image/jpeg,image/png,image/webp" @change="handleRowInvPhoto(item, $event)" />
              </label>
              <div class="dropdown-edit-inline">
                <input v-model="editInvDraft.name" placeholder="Item name" />
                <SearchSelect v-model="editInvDraft.category" :options="invCategoryOptions" size="sm" search-placeholder="Category…" />
                <SearchSelect v-model="editInvDraft.unit" :options="invUnitOptions" size="sm" search-placeholder="Unit…" />
              </div>
              <div class="action-row">
                <button type="button" class="icon-button" title="Save" @click="saveEditInvItem(item)"><Check :size="15" /></button>
                <button type="button" class="icon-button" title="Cancel" @click="editingInvId = ''"><X :size="15" /></button>
              </div>
            </template>
            <template v-else>
              <div class="inv-setting-item-left">
                <label class="inv-setting-thumb-btn" :title="item.imageUrl ? 'Replace product photo' : 'Upload product photo'">
                  <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name" />
                  <LoaderCircle v-else-if="uploadingInvId === item.id" class="spin" :size="15" />
                  <span v-else>{{ item.name.slice(0, 1).toUpperCase() }}</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" @change="handleRowInvPhoto(item, $event)" />
                </label>
                <div class="dropdown-option-label">
                  <strong>{{ item.name }}</strong>
                  <small>{{ item.code }} · {{ item.category }} · {{ item.unit }}</small>
                </div>
              </div>
              <div class="action-row">
                <label class="icon-button inv-upload-icon-label" title="Upload / change product photo">
                  <UploadCloud :size="14" />
                  <input type="file" accept="image/jpeg,image/png,image/webp" @change="handleRowInvPhoto(item, $event)" />
                </label>
                <button v-if="item.imageUrl" type="button" class="icon-button" title="Remove product photo" @click="clearRowInvPhoto(item)"><X :size="14" /></button>
                <button type="button" class="icon-button" title="Rename item" @click="startEditInvItem(item)"><Pencil :size="14" /></button>
                <button type="button" class="icon-button danger-icon-btn" title="Delete item" @click="handleDeleteInvItem(item)"><Trash2 :size="14" /></button>
              </div>
            </template>
          </li>
        </ul>
        <p class="dropdown-settings-note"><span>Sorted A–Z · Showing all {{ sortedInventory.length }} items</span><span>Scroll list to view more</span></p>
      </article>
    </section>

    <UiModal :open="showSaved" title="Business Profile Saved" description="Identity and logo updates are now applied to the web app, invoices, and receipts." @close="showSaved = false">
      <div class="modal-actions"><button class="primary-button" @click="showSaved = false">Done</button></div>
    </UiModal>
  </div>
</template>
