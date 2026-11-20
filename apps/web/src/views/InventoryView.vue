<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  Plus, Search, ArrowDownToLine, ArrowUpFromLine, Boxes, TriangleAlert, PackageCheck,
  History, ClipboardCheck, Trash2, UploadCloud, LoaderCircle, Eye, Image as ImageIcon, Pencil, Download,
} from '@lucide/vue'
import { useCrmStore, type InventoryItem, type StockMovement, type StockOpnameRecord } from '../stores/crm'
import { displayStockStatus, formatDate } from '../utils/format'
import { uploadImageWithFallback } from '../utils/uploadImage'
import StatusBadge from '../components/StatusBadge.vue'
import UiModal from '../components/UiModal.vue'
import SearchSelect from '../components/SearchSelect.vue'
import DataPagination from '../components/DataPagination.vue'

const store = useCrmStore()
const tab = ref<'master' | 'in' | 'out' | 'opname' | 'monitor'>('master')
const search = ref('')
const monitorStatusFilter = ref<'All' | 'Aman' | 'Menipis' | 'Habis'>('All')
const masterPage = ref(1)
const masterPageSize = ref(10)
const inPage = ref(1)
const inPageSize = ref(10)
const outPage = ref(1)
const outPageSize = ref(10)
const opnamePage = ref(1)
const opnamePageSize = ref(10)
const showMovement = ref(false)
const showItemForm = ref(false)
const showOpnameForm = ref(false)
const showOpnameDetail = ref(false)
const selectedOpname = ref<StockOpnameRecord | null>(null)
const showProofZoom = ref(false)
const zoomedProofUrl = ref('')
const editingItemId = ref('')
const showDeleteItemModal = ref(false)
const deletingItem = ref<InventoryItem | null>(null)
const quickAddFromMovement = ref(false)
const uploadingItemPhoto = ref(false)
const itemPhotoError = ref('')

// Edit / Delete per-row for Stock In & Stock Out
const editingMovementId = ref('')
const showEditMovement = ref(false)
const editMovementError = ref('')
const editMovementUploading = ref(false)
const editMovementForm = reactive<{
  itemId: string
  type: 'Masuk' | 'Keluar'
  quantity: number
  date: string
  pic: string
  notes: string
  proofImageUrl: string
}>({
  itemId: '',
  type: 'Masuk',
  quantity: 1,
  date: '',
  pic: '',
  notes: '',
  proofImageUrl: '',
})
const showDeleteMovementModal = ref(false)
const deletingMovement = ref<StockMovement | null>(null)

// Edit / Delete for Stock Opname
const editingOpnameId = ref('')
const showDeleteOpnameModal = ref(false)
const deletingOpname = ref<StockOpnameRecord | null>(null)

const error = ref('')
const itemError = ref('')
const opnameError = ref('')
const uploadingProof = ref(false)
const proofError = ref('')

interface MovementLine {
  key: string
  itemId: string
  quantity: number
}

const movement = reactive<{
  type: 'Masuk' | 'Keluar'
  date: string
  pic: string
  notes: string
  proofImageUrl: string
  items: MovementLine[]
}>({
  type: 'Masuk',
  date: new Date().toISOString().slice(0, 10),
  pic: '',
  notes: '',
  proofImageUrl: '',
  items: [{ key: crypto.randomUUID(), itemId: '', quantity: 1 }],
})

interface OpnameRow {
  itemId: string
  itemName: string
  itemCode: string
  unit: string
  systemStock: number
  physicalStock: number
  included: boolean
  notes: string
}

const opnameForm = reactive<{
  date: string
  pic: string
  notes: string
  rows: OpnameRow[]
}>({
  date: new Date().toISOString().slice(0, 10),
  pic: '',
  notes: '',
  rows: [],
})

const itemForm = reactive({
  name: '',
  category: '',
  unit: 'pcs',
  initialStock: 0,
  minimumStock: 0,
  location: '',
  imageUrl: '',
})

const items = computed(() =>
  store.inventory.filter((item) => {
    const q = search.value.trim().toLowerCase()
    const matchesSearch = !q || item.name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q)
    if (!matchesSearch) return false
    if (tab.value === 'monitor' && monitorStatusFilter.value !== 'All') {
      return store.stockStatus(item) === monitorStatusFilter.value
    }
    return true
  }),
)

const paginatedItems = computed(() => {
  const start = (masterPage.value - 1) * masterPageSize.value
  return items.value.slice(start, start + masterPageSize.value)
})

const inMovements = computed(() => store.movements.filter((m) => m.type === 'Masuk'))
const outMovements = computed(() => store.movements.filter((m) => m.type === 'Keluar'))

const paginatedMovements = computed(() => {
  const list = tab.value === 'in' ? inMovements.value : outMovements.value
  const page = tab.value === 'in' ? inPage.value : outPage.value
  const size = tab.value === 'in' ? inPageSize.value : outPageSize.value
  const start = (page - 1) * size
  return list.slice(start, start + size)
})

const paginatedOpnames = computed(() => {
  const start = (opnamePage.value - 1) * opnamePageSize.value
  return store.stockOpnames.slice(start, start + opnamePageSize.value)
})

watch([search, monitorStatusFilter, tab], () => {
  masterPage.value = 1
})

const monitorStatusOptions = [
  { value: 'All', label: 'All Stock Statuses' },
  { value: 'Aman', label: 'In Stock (Aman)' },
  { value: 'Menipis', label: 'Low Stock' },
  { value: 'Habis', label: 'Out of Stock' },
]

const staffPicOptions = computed(() => {
  const opts = store.activeEmployees.map((emp) => ({
    value: emp.name,
    label: emp.name,
    sublabel: emp.role,
  }))
  const extraPic = movement.pic || opnameForm.pic || editMovementForm.pic
  if (extraPic && !opts.some((o) => o.value === extraPic)) {
    opts.push({ value: extraPic, label: extraPic, sublabel: 'Staff' })
  }
  return opts
})

const inventoryItemOptions = computed(() =>
  store.inventory.map((item) => ({
    value: item.id,
    label: item.name,
    sublabel: `Avail: ${store.stockAvailable(item)} ${item.unit}`,
  })),
)

const invCategorySelectOptions = computed(() => {
  const list = store.inventoryCategories.map((c) => ({ value: c, label: c }))
  if (itemForm.category && !store.inventoryCategories.includes(itemForm.category)) {
    list.push({ value: itemForm.category, label: itemForm.category })
  }
  return list
})

const invUnitSelectOptions = computed(() => {
  const list = store.units.map((u) => ({ value: u, label: u }))
  if (itemForm.unit && !store.units.includes(itemForm.unit)) {
    list.push({ value: itemForm.unit, label: itemForm.unit })
  }
  return list
})

const safeCount = computed(() => store.inventory.filter((item) => store.stockStatus(item) === 'Aman').length)
const lowCount = computed(() => store.inventory.filter((item) => store.stockStatus(item) === 'Menipis').length)
const emptyCount = computed(() => store.inventory.filter((item) => store.stockStatus(item) === 'Habis').length)

const openMovement = (type: 'Masuk' | 'Keluar') => {
  movement.type = type
  movement.date = new Date().toISOString().slice(0, 10)
  movement.pic = ''
  movement.notes = ''
  movement.proofImageUrl = ''
  movement.items = [{ key: crypto.randomUUID(), itemId: '', quantity: 1 }]
  error.value = ''
  proofError.value = ''
  showMovement.value = true
}

const addMovementLine = () => {
  movement.items.push({ key: crypto.randomUUID(), itemId: '', quantity: 1 })
}

const handleMovementProof = async (event: Event) => {
  const inputEl = event.target as HTMLInputElement
  const file = inputEl.files?.[0]
  if (!file) return
  proofError.value = ''
  uploadingProof.value = true
  try {
    const result = await uploadImageWithFallback(file, 'inventory')
    movement.proofImageUrl = result.url
  } catch (err) {
    proofError.value = err instanceof Error ? err.message : 'Failed to upload photo proof.'
  } finally {
    uploadingProof.value = false
    inputEl.value = ''
  }
}

const handleItemPhotoUpload = async (event: Event) => {
  const inputEl = event.target as HTMLInputElement
  const file = inputEl.files?.[0]
  if (!file) return
  itemPhotoError.value = ''
  uploadingItemPhoto.value = true
  try {
    const result = await uploadImageWithFallback(file, 'inventory')
    itemForm.imageUrl = result.url
  } catch (err) {
    itemPhotoError.value = err instanceof Error ? err.message : 'Failed to upload item image.'
  } finally {
    uploadingItemPhoto.value = false
    inputEl.value = ''
  }
}

const submitMovement = () => {
  try {
    error.value = ''
    store.submitBatchStockMovement({
      type: movement.type,
      date: movement.date,
      pic: movement.pic,
      notes: movement.notes,
      proofImageUrl: movement.proofImageUrl || undefined,
      items: movement.items.map((row) => ({ itemId: row.itemId, quantity: row.quantity })),
    })
    showMovement.value = false
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to save transaction.'
  }
}

const openOpnameModal = () => {
  editingOpnameId.value = ''
  opnameForm.date = new Date().toISOString().slice(0, 10)
  opnameForm.pic = ''
  opnameForm.notes = ''
  opnameForm.rows = store.inventory.map((item) => {
    const sys = store.stockAvailable(item)
    return {
      itemId: item.id,
      itemName: item.name,
      itemCode: item.code,
      unit: item.unit,
      systemStock: sys,
      physicalStock: sys,
      included: true,
      notes: '',
    }
  })
  opnameError.value = ''
  showOpnameForm.value = true
}

const openEditOpnameModal = (record: StockOpnameRecord) => {
  editingOpnameId.value = record.id
  opnameForm.date = record.date
  opnameForm.pic = record.pic
  opnameForm.notes = record.notes ?? ''
  opnameForm.rows = store.inventory.map((item) => {
    const existingLine = record.items.find((l) => l.itemId === item.id)
    const priorDiff = existingLine?.diff ?? 0
    const sysBefore = store.stockAvailable(item) - priorDiff
    return {
      itemId: item.id,
      itemName: item.name,
      itemCode: item.code,
      unit: item.unit,
      systemStock: sysBefore,
      physicalStock: existingLine ? existingLine.physicalStock : sysBefore,
      included: Boolean(existingLine),
      notes: existingLine?.notes ?? '',
    }
  })
  opnameError.value = ''
  showOpnameForm.value = true
}

const openDeleteOpnameModal = (record: StockOpnameRecord) => {
  deletingOpname.value = record
  showDeleteOpnameModal.value = true
}

const confirmDeleteOpname = () => {
  if (!deletingOpname.value) return
  store.deleteStockOpname(deletingOpname.value.id)
  deletingOpname.value = null
  showDeleteOpnameModal.value = false
}

const openEditMovementModal = (row: StockMovement) => {
  editingMovementId.value = row.id
  editMovementError.value = ''
  Object.assign(editMovementForm, {
    itemId: row.itemId,
    type: row.type === 'Keluar' ? 'Keluar' : 'Masuk',
    quantity: row.quantity,
    date: row.date,
    pic: row.pic,
    notes: row.notes ?? '',
    proofImageUrl: row.proofImageUrl ?? '',
  })
  showEditMovement.value = true
}

const handleEditMovementProof = async (event: Event) => {
  const inputEl = event.target as HTMLInputElement
  const file = inputEl.files?.[0]
  if (!file) return
  editMovementError.value = ''
  editMovementUploading.value = true
  try {
    const res = await uploadImageWithFallback(file, 'inventory')
    editMovementForm.proofImageUrl = res.url
  } catch (err) {
    editMovementError.value = err instanceof Error ? err.message : 'Failed to upload photo proof.'
  } finally {
    editMovementUploading.value = false
    inputEl.value = ''
  }
}

const submitEditMovement = () => {
  try {
    editMovementError.value = ''
    store.updateStockMovement(editingMovementId.value, { ...editMovementForm })
    editingMovementId.value = ''
    showEditMovement.value = false
  } catch (err) {
    editMovementError.value = err instanceof Error ? err.message : 'Failed to update transaction.'
  }
}

const openDeleteMovementModal = (row: StockMovement) => {
  deletingMovement.value = row
  showDeleteMovementModal.value = true
}

const confirmDeleteMovement = () => {
  if (!deletingMovement.value) return
  store.deleteStockMovement(deletingMovement.value.id)
  deletingMovement.value = null
  showDeleteMovementModal.value = false
}

const submitOpname = () => {
  try {
    opnameError.value = ''
    const chosen = opnameForm.rows.filter((r) => r.included)
    if (!chosen.length) throw new Error('Select at least one item for stock opname.')
    const payload = {
      date: opnameForm.date,
      pic: opnameForm.pic,
      notes: opnameForm.notes,
      items: chosen.map((r) => ({
        itemId: r.itemId,
        physicalStock: Number(r.physicalStock),
        notes: r.notes,
      })),
    }
    if (editingOpnameId.value) {
      store.updateStockOpname(editingOpnameId.value, payload)
      editingOpnameId.value = ''
    } else {
      store.submitStockOpname(payload)
    }
    showOpnameForm.value = false
    tab.value = 'opname'
  } catch (err) {
    opnameError.value = err instanceof Error ? err.message : 'Failed to save stock opname.'
  }
}

const openOpnameDetailModal = (record: StockOpnameRecord) => {
  selectedOpname.value = record
  showOpnameDetail.value = true
}

const openProofModal = (url: string) => {
  zoomedProofUrl.value = url
  showProofZoom.value = true
}

const openItemForm = (fromMovement = false) => {
  editingItemId.value = ''
  quickAddFromMovement.value = fromMovement
  Object.assign(itemForm, {
    name: '',
    category: store.inventoryCategories[0] ?? '',
    unit: store.units[0] ?? 'pcs',
    initialStock: 0,
    minimumStock: 0,
    location: '-',
    imageUrl: '',
  })
  itemError.value = ''
  itemPhotoError.value = ''
  showItemForm.value = true
}

const openEditItemForm = (item: InventoryItem) => {
  editingItemId.value = item.id
  quickAddFromMovement.value = false
  Object.assign(itemForm, {
    name: item.name,
    category: item.category,
    unit: item.unit,
    initialStock: item.initialStock,
    minimumStock: item.minimumStock,
    location: item.location || '-',
    imageUrl: item.imageUrl ?? '',
  })
  itemError.value = ''
  itemPhotoError.value = ''
  showItemForm.value = true
}

const openDeleteItemModal = (item: InventoryItem) => {
  deletingItem.value = item
  showDeleteItemModal.value = true
}

const confirmDeleteItem = () => {
  if (!deletingItem.value) return
  store.deleteInventoryItem(deletingItem.value.id)
  deletingItem.value = null
  showDeleteItemModal.value = false
}

const submitItem = () => {
  itemError.value = ''
  if (!itemForm.name.trim() || !itemForm.category.trim() || !itemForm.unit.trim()) {
    itemError.value = 'Item name, category, and unit are required.'
    return
  }
  if (itemForm.initialStock < 0 || itemForm.minimumStock < 0) {
    itemError.value = 'Stock quantities cannot be negative.'
    return
  }
  if (editingItemId.value) {
    store.updateInventoryItem(editingItemId.value, {
      name: itemForm.name,
      category: itemForm.category,
      unit: itemForm.unit,
      location: itemForm.location.trim() || '-',
      initialStock: itemForm.initialStock,
      minimumStock: itemForm.minimumStock,
      imageUrl: itemForm.imageUrl,
    })
  } else {
    const created = store.addInventoryItem({
      name: itemForm.name,
      category: itemForm.category,
      unit: itemForm.unit,
      location: itemForm.location.trim() || '-',
      initialStock: itemForm.initialStock,
      minimumStock: itemForm.minimumStock,
      imageUrl: itemForm.imageUrl || undefined,
    })
    if (quickAddFromMovement.value && showMovement.value) {
      const emptyLine = movement.items.find((l) => !l.itemId)
      if (emptyLine) emptyLine.itemId = created.id
      else movement.items.push({ key: crypto.randomUUID(), itemId: created.id, quantity: 1 })
    }
  }
  editingItemId.value = ''
  quickAddFromMovement.value = false
  showItemForm.value = false
}

const formatDiff = (diff: number) => (diff > 0 ? `+${diff}` : String(diff))

const exportInventoryPdf = async () => {
  await store.runWithPdfLoader(
    'Inventory Stock Report',
    `${store.inventory.length} SKU Items`,
    async () => {
      const { downloadSelectedReportsPdf } = await import('../utils/reportPdf')
      await downloadSelectedReportsPdf({
        selectedKeys: ['inventory'],
        data: {
          customers: store.customers,
          bookings: store.bookings,
          invoices: store.invoices,
          payments: store.payments,
          refunds: store.refunds,
          expenses: store.expenses,
          inventory: store.inventory,
          movements: store.movements,
          stockOpnames: store.stockOpnames,
          businessProfile: store.businessProfile,
          sortedOrderGroups: store.sortedOrderGroups,
          groupTotal: store.groupTotal,
          invoiceTotal: store.invoiceTotal,
          bookingTotal: store.bookingTotal,
          bookingPaid: store.bookingPaid,
          bookingBalance: store.bookingBalance,
          stockAvailable: store.stockAvailable,
          stockStatus: store.stockStatus,
        },
      })
    },
  )
}
</script>

<template>
  <div class="page-stack">
    <section class="page-heading">
      <div><span class="eyebrow">Business</span><h2>Inventory Management</h2><p>Track real-time stock balances, upload item images, record batch stock-in/out with proofs, and run physical opname audits.</p></div>
      <div class="heading-actions inv-heading-actions">
        <button class="secondary-button inv-action-btn" @click="exportInventoryPdf"><Download :size="16" /><span>Download Stock PDF</span></button>
        <button class="secondary-button inv-action-btn" @click="openOpnameModal"><ClipboardCheck :size="16" /><span>Stock Opname</span></button>
        <button class="secondary-button inv-action-btn is-out" @click="openMovement('Keluar')"><ArrowUpFromLine :size="16" /><span>Stock Out</span></button>
        <button class="primary-button inv-action-btn is-in" @click="openMovement('Masuk')"><ArrowDownToLine :size="16" /><span>Stock In</span></button>
      </div>
    </section>

    <section class="inventory-stats">
      <article><span class="tone-sage"><Boxes :size="21" /></span><div><small>Total SKU Items</small><strong>{{ store.inventory.length }}</strong></div></article>
      <article><span class="tone-blue"><PackageCheck :size="21" /></span><div><small>In Stock</small><strong>{{ safeCount }}</strong></div></article>
      <article><span class="tone-amber"><TriangleAlert :size="21" /></span><div><small>Low Stock</small><strong>{{ lowCount }}</strong></div></article>
      <article><span class="tone-rose"><TriangleAlert :size="21" /></span><div><small>Out of Stock</small><strong>{{ emptyCount }}</strong></div></article>
    </section>

    <section class="panel table-panel">
      <div class="inventory-tabs">
        <button :class="{ active: tab === 'master' }" @click="tab = 'master'">Item Catalog</button>
        <button :class="{ active: tab === 'in' }" @click="tab = 'in'">Stock In</button>
        <button :class="{ active: tab === 'out' }" @click="tab = 'out'">Stock Out</button>
        <button :class="{ active: tab === 'opname' }" @click="tab = 'opname'">Stock Opname</button>
        <button :class="{ active: tab === 'monitor' }" @click="tab = 'monitor'">Stock Monitor</button>
      </div>

      <template v-if="tab === 'master' || tab === 'monitor'">
        <div class="table-toolbar">
          <label class="table-search"><Search :size="17" /><input v-model="search" placeholder="Search item name or code" /></label>
          <div class="filter-row">
            <SearchSelect
              v-if="tab === 'monitor'"
              v-model="monitorStatusFilter"
              :options="monitorStatusOptions"
              search-placeholder="Filter status…"
              aria-label="Filter monitor stock status"
            />
            <button v-if="tab === 'master'" class="soft-button" @click="openItemForm(false)"><Plus :size="16" />Add Inventory Item</button>
          </div>
        </div>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Item &amp; Photo</th>
                <th>Category</th>
                <th>Initial</th>
                <th>In</th>
                <th>Out</th>
                <th>Adj.</th>
                <th>Available Stock</th>
                <th>Status</th>
                <th v-if="tab === 'master'">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in paginatedItems" :key="item.id">
                <td>
                  <div class="inventory-name">
                    <button v-if="item.imageUrl" type="button" class="proof-thumb-btn" style="width: 38px; height: 38px; padding: 0; border-radius: 9px;" title="Zoom product photo" @click="openProofModal(item.imageUrl)">
                      <img :src="item.imageUrl" :alt="item.name" class="item-thumb-img" style="border: 0;" />
                    </button>
                    <span v-else>{{ item.name.slice(0, 1) }}</span>
                    <div><strong>{{ item.name }}</strong><small>{{ item.code }} · {{ item.unit }}</small></div>
                  </div>
                </td>
                <td>{{ item.category }}</td>
                <td>{{ item.initialStock }}</td>
                <td class="positive-number">+{{ item.stockIn }}</td>
                <td class="negative-number">−{{ item.stockOut }}</td>
                <td>
                  <strong :class="(item.stockAdjustment ?? 0) > 0 ? 'positive-number' : (item.stockAdjustment ?? 0) < 0 ? 'negative-number' : ''">
                    {{ (item.stockAdjustment ?? 0) > 0 ? `+${item.stockAdjustment}` : (item.stockAdjustment ?? 0) }}
                  </strong>
                </td>
                <td><strong class="stock-number">{{ store.stockAvailable(item) }} <small>{{ item.unit }}</small></strong><span class="subtle-line">Minimum {{ item.minimumStock }}</span></td>
                <td><StatusBadge :label="displayStockStatus(store.stockStatus(item))" /></td>
                <td v-if="tab === 'master'">
                  <div class="row-actions">
                    <button type="button" class="icon-button" title="Edit item details & photo" @click="openEditItemForm(item)"><Pencil :size="15" /></button>
                    <button type="button" class="icon-button danger-icon-button" title="Delete item from catalog" @click="openDeleteItemModal(item)"><Trash2 :size="15" /></button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <DataPagination v-model:current-page="masterPage" v-model:page-size="masterPageSize" :total-items="items.length" />
      </template>

      <template v-else-if="tab === 'opname'">
        <div class="movement-head movement-head--between">
          <div class="movement-head-left">
            <span class="movement-head-icon"><ClipboardCheck :size="20" /></span>
            <div>
              <h3>Stock Opname History</h3>
              <p>Physical stock reconciliation audits showing system vs physical variances (+) and (-).</p>
            </div>
          </div>
          <button type="button" class="soft-button" @click="openOpnameModal"><Plus :size="15" />Start Stock Opname</button>
        </div>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Opname No.</th>
                <th>Date</th>
                <th>PIC</th>
                <th>Items Checked</th>
                <th>Variance Summary</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="record in paginatedOpnames" :key="record.id">
                <td><strong class="mono-code">{{ record.opnameNumber }}</strong></td>
                <td>{{ formatDate(record.date) }}</td>
                <td><strong>{{ record.pic }}</strong></td>
                <td>{{ record.items.length }} items</td>
                <td>
                  <div class="opname-diff-pills">
                    <span
                      v-for="line in record.items.filter((i) => i.diff !== 0)"
                      :key="line.itemId"
                      class="opname-diff-pill"
                      :class="line.diff > 0 ? 'is-plus' : 'is-minus'"
                    >
                      {{ line.itemName }}: {{ formatDiff(line.diff) }} {{ line.unit }}
                    </span>
                    <StatusBadge v-if="record.items.every((i) => i.diff === 0)" label="Matched" />
                  </div>
                </td>
                <td>
                  <div class="row-actions">
                    <button type="button" class="icon-button" title="View opname breakdown" @click="openOpnameDetailModal(record)">
                      <Eye :size="16" />
                    </button>
                    <button type="button" class="icon-button" title="Edit stock opname" @click="openEditOpnameModal(record)">
                      <Pencil :size="15" />
                    </button>
                    <button type="button" class="icon-button danger-icon-button" title="Delete stock opname" @click="openDeleteOpnameModal(record)">
                      <Trash2 :size="15" />
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="!store.stockOpnames.length">
                <td colspan="6">
                  <div class="empty-state">
                    <ClipboardCheck :size="28" />
                    <strong>No stock opname history yet</strong>
                    <span>Click "Stock Opname" to audit physical counts against system stock.</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <DataPagination v-model:current-page="opnamePage" v-model:page-size="opnamePageSize" :total-items="store.stockOpnames.length" />
      </template>

      <template v-else>
        <div class="movement-head movement-head--between">
          <div class="movement-head-left">
            <span class="movement-head-icon"><History :size="20" /></span>
            <div>
              <h3>{{ tab === 'in' ? 'Stock In' : 'Stock Out' }} History</h3>
              <p>Transactions saved with staff PIC, uploaded photo proof, and full edit/delete support.</p>
            </div>
          </div>
          <button type="button" class="soft-button" @click="openMovement(tab === 'in' ? 'Masuk' : 'Keluar')">
            <Plus :size="15" />Record Stock {{ tab === 'in' ? 'In' : 'Out' }}
          </button>
        </div>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead><tr><th>Date</th><th>Item Name</th><th>Qty</th><th>PIC</th><th>Photo Proof</th><th>Notes</th><th>Actions</th></tr></thead>
            <tbody>
              <tr v-for="row in paginatedMovements" :key="row.id">
                <td>{{ formatDate(row.date) }}</td>
                <td><strong>{{ store.inventory.find((item) => item.id === row.itemId)?.name }}</strong></td>
                <td><strong :class="row.type === 'Masuk' ? 'positive-number' : 'negative-number'">{{ row.type === 'Masuk' ? '+' : '−' }}{{ row.quantity }}</strong> <small class="unit-tag">{{ store.inventory.find((item) => item.id === row.itemId)?.unit ?? '' }}</small></td>
                <td>{{ row.pic }}</td>
                <td>
                  <button v-if="row.proofImageUrl" type="button" class="proof-thumb-btn" title="View photo proof" @click="openProofModal(row.proofImageUrl)">
                    <img :src="row.proofImageUrl" alt="Proof photo" />
                  </button>
                  <span v-else class="subtle-line">—</span>
                </td>
                <td>{{ row.notes || '—' }}</td>
                <td>
                  <div class="row-actions">
                    <button type="button" class="icon-button" title="Edit transaction" @click="openEditMovementModal(row)"><Pencil :size="15" /></button>
                    <button type="button" class="icon-button danger-icon-button" title="Delete transaction" @click="openDeleteMovementModal(row)"><Trash2 :size="15" /></button>
                  </div>
                </td>
              </tr>
              <tr v-if="!store.movements.filter((m) => m.type === (tab === 'in' ? 'Masuk' : 'Keluar')).length">
                <td colspan="7">
                  <div class="empty-state">
                    <History :size="26" />
                    <strong>No {{ tab === 'in' ? 'stock-in' : 'stock-out' }} records yet</strong>
                    <span>Record a new stock movement using the buttons above.</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <DataPagination
          v-if="tab === 'in'"
          v-model:current-page="inPage"
          v-model:page-size="inPageSize"
          :total-items="inMovements.length"
        />
        <DataPagination
          v-else
          v-model:current-page="outPage"
          v-model:page-size="outPageSize"
          :total-items="outMovements.length"
        />
      </template>
    </section>

    <UiModal :open="showMovement" :title="`Record Stock ${movement.type === 'Masuk' ? 'In' : 'Out'}`" :description="`Log multiple inventory ${movement.type === 'Masuk' ? 'restock' : 'usage'} lines with photo proof.`" wide @close="showMovement = false">
      <form class="form-grid" @submit.prevent="submitMovement">
        <label class="is-required"><span>Date *</span><input v-model="movement.date" type="date" /></label>
        <label class="is-required">
          <span>PIC / Staff Member *</span>
          <SearchSelect v-model="movement.pic" :options="staffPicOptions" required placeholder="Select staff PIC" search-placeholder="Search staff…" />
        </label>

        <div class="order-lines span-2">
          <div class="order-lines-head">
            <div>
              <strong>{{ movement.type === 'Masuk' ? 'Incoming' : 'Outgoing' }} Item List</strong>
              <span>Add one or more SKU lines, or register a new inventory item name on the fly.</span>
            </div>
            <div class="add-group-add-trigger">
              <button type="button" class="soft-button" @click="openItemForm(true)"><Plus :size="14" />New Item</button>
              <button type="button" class="soft-button" @click="addMovementLine"><Plus :size="15" />Add Line</button>
            </div>
          </div>

          <div v-for="(line, idx) in movement.items" :key="line.key" class="stock-batch-row">
            <label class="is-required">
              <span>Item {{ idx + 1 }} *</span>
              <SearchSelect v-model="line.itemId" :options="inventoryItemOptions" required placeholder="Select inventory item" search-placeholder="Search item…" />
            </label>
            <label>
              <span>Qty &amp; Unit *</span>
              <div class="qty-unit-input">
                <input
                  v-model.number="line.quantity"
                  type="number"
                  min="1"
                  :max="movement.type === 'Keluar' && line.itemId ? store.stockAvailable(store.inventory.find((i) => i.id === line.itemId)!) : undefined"
                />
                <span class="qty-unit-suffix">{{ store.inventory.find((i) => i.id === line.itemId)?.unit || 'unit' }}</span>
              </div>
            </label>
            <button
              type="button"
              class="icon-button order-line-remove"
              :disabled="movement.items.length === 1"
              title="Remove line"
              @click="movement.items.splice(idx, 1)"
            >
              <Trash2 :size="16" />
            </button>
          </div>
        </div>

        <label class="span-2"><span>Notes</span><textarea v-model="movement.notes" rows="2" placeholder="Supplier name, event purpose, or notes" /></label>

        <div class="span-2 attire-upload-block">
          <span class="upload-field-label">Upload Photo Proof</span>
          <label class="upload-zone">
            <img v-if="movement.proofImageUrl" :src="movement.proofImageUrl" alt="Transaction photo proof" />
            <div v-else><UploadCloud :size="24" /><strong>Upload JPG, PNG, or WebP proof photo</strong><span>Max 5 MB</span></div>
            <input type="file" accept="image/jpeg,image/png,image/webp" @change="handleMovementProof" />
          </label>
          <button v-if="movement.proofImageUrl" type="button" class="soft-button remove-photo-btn" @click="movement.proofImageUrl = ''">
            Remove photo proof
          </button>
          <p v-if="uploadingProof" class="upload-state"><LoaderCircle class="spin" :size="15" />Processing photo…</p>
          <p v-if="proofError" class="form-error">{{ proofError }}</p>
        </div>

        <p v-if="error" class="form-error span-2">{{ error }}</p>
        <div class="modal-actions span-2">
          <button type="button" class="secondary-button" @click="showMovement = false">Cancel</button>
          <button class="primary-button" :disabled="uploadingProof">Save Transaction ({{ movement.items.length }} Items)</button>
        </div>
      </form>
    </UiModal>

    <UiModal :open="showOpnameForm" :title="editingOpnameId ? 'Edit Stock Opname Audit' : 'Stock Opname Audit'" description="Enter physical counts to reconcile against system stock and preview variances." wide @close="showOpnameForm = false">
      <form class="form-grid" @submit.prevent="submitOpname">
        <label class="is-required"><span>Audit Date *</span><input v-model="opnameForm.date" type="date" /></label>
        <label class="is-required">
          <span>PIC / Auditor *</span>
          <SearchSelect v-model="opnameForm.pic" :options="staffPicOptions" required placeholder="Select staff PIC" search-placeholder="Search staff…" />
        </label>

        <div class="span-2 opname-sheet-wrap">
          <table class="opname-sheet-table">
            <thead>
              <tr>
                <th>Check</th>
                <th>Item</th>
                <th>System</th>
                <th>Physical</th>
                <th>Diff</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in opnameForm.rows" :key="row.itemId" :class="{ 'is-unchecked': !row.included }">
                <td><input v-model="row.included" type="checkbox" /></td>
                <td>
                  <strong>{{ row.itemName }}</strong>
                  <small>{{ row.itemCode }} · {{ row.unit }}</small>
                </td>
                <td class="col-center"><strong>{{ row.systemStock }}</strong> <small>{{ row.unit }}</small></td>
                <td>
                  <div class="qty-unit-input qty-unit-input--compact">
                    <input v-model.number="row.physicalStock" type="number" min="0" :disabled="!row.included" />
                    <span class="qty-unit-suffix">{{ row.unit }}</span>
                  </div>
                </td>
                <td class="col-center">
                  <span
                    class="opname-diff-pill"
                    :class="(row.physicalStock - row.systemStock) > 0 ? 'is-plus' : (row.physicalStock - row.systemStock) < 0 ? 'is-minus' : 'is-zero'"
                  >
                    {{ formatDiff(row.physicalStock - row.systemStock) }} {{ row.unit }}
                  </span>
                </td>
                <td><input v-model="row.notes" placeholder="Variance reason" :disabled="!row.included" /></td>
              </tr>
            </tbody>
          </table>
        </div>

        <label class="span-2"><span>Audit Notes</span><input v-model="opnameForm.notes" placeholder="e.g. Monthly November studio stock audit" /></label>
        <p v-if="opnameError" class="form-error span-2">{{ opnameError }}</p>
        <div class="modal-actions span-2">
          <button type="button" class="secondary-button" @click="showOpnameForm = false">Cancel</button>
          <button class="primary-button">Save &amp; Reconcile Stock</button>
        </div>
      </form>
    </UiModal>

    <UiModal :open="showOpnameDetail" :title="selectedOpname ? `Opname Details — ${selectedOpname.opnameNumber}` : 'Opname Details'" description="System vs physical count comparison and reconciled adjustments." wide @close="showOpnameDetail = false">
      <div v-if="selectedOpname" class="opname-detail-body">
        <div class="opname-detail-meta">
          <span>Date: <strong>{{ formatDate(selectedOpname.date) }}</strong></span>
          <span>PIC: <strong>{{ selectedOpname.pic }}</strong></span>
          <span v-if="selectedOpname.notes">Notes: <strong>{{ selectedOpname.notes }}</strong></span>
        </div>
        <div class="opname-sheet-wrap">
          <table class="opname-sheet-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>System Stock</th>
                <th>Physical Stock</th>
                <th>Variance (+/-)</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="line in selectedOpname.items" :key="line.itemId">
                <td><strong>{{ line.itemName }}</strong><small>{{ line.itemCode }} · {{ line.unit }}</small></td>
                <td class="col-center">{{ line.systemStock }}</td>
                <td class="col-center"><strong>{{ line.physicalStock }}</strong></td>
                <td class="col-center">
                  <span class="opname-diff-pill" :class="line.diff > 0 ? 'is-plus' : line.diff < 0 ? 'is-minus' : 'is-zero'">
                    {{ formatDiff(line.diff) }} {{ line.unit }}
                  </span>
                </td>
                <td>{{ line.notes || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="modal-actions"><button class="primary-button" @click="showOpnameDetail = false">Close</button></div>
    </UiModal>

    <UiModal :open="showProofZoom" title="Transaction Photo Proof" @close="showProofZoom = false">
      <div class="attire-zoom">
        <div>
          <img v-if="zoomedProofUrl" :src="zoomedProofUrl" alt="Transaction proof" />
          <ImageIcon v-else :size="48" />
        </div>
      </div>
    </UiModal>

    <!-- Add / Edit Inventory Item WITH Photo Upload & Dropdown Settings synced Category/Unit -->
    <UiModal :open="showItemForm" :title="editingItemId ? 'Edit Inventory Item' : 'Add Inventory Item'" :description="editingItemId ? 'Update item name, photo, category, unit, or minimum threshold.' : 'Item code is generated automatically and synced with Dropdown Settings.'" wide @close="showItemForm = false">
      <form class="form-grid" @submit.prevent="submitItem">
        <label class="span-2 is-required"><span>Item Name *</span><input v-model="itemForm.name" placeholder="e.g. Lip Tint Velvet" /></label>
        <label class="is-required">
          <span>Category *</span>
          <SearchSelect v-model="itemForm.category" :options="invCategorySelectOptions" required search-placeholder="Search category…" />
        </label>
        <label class="is-required">
          <span>Unit *</span>
          <SearchSelect v-model="itemForm.unit" :options="invUnitSelectOptions" required search-placeholder="Search unit…" />
        </label>
        <label class="is-optional"><span>Initial Stock <em class="opt-tag">Optional</em></span><input v-model.number="itemForm.initialStock" type="number" min="0" /></label>
        <label class="is-optional"><span>Minimum Stock Alert <em class="opt-tag">Optional</em></span><input v-model.number="itemForm.minimumStock" type="number" min="0" /></label>
        <div class="span-2 attire-upload-block">
          <span class="upload-field-label">Upload Product Image (Displayed in Catalog &amp; Stock PDF)</span>
          <label class="upload-zone">
            <img v-if="itemForm.imageUrl" :src="itemForm.imageUrl" alt="Inventory item image" />
            <div v-else><UploadCloud :size="24" /><strong>Upload JPG, PNG, or WebP product photo</strong><span>Max 5 MB</span></div>
            <input type="file" accept="image/jpeg,image/png,image/webp" @change="handleItemPhotoUpload" />
          </label>
          <button v-if="itemForm.imageUrl" type="button" class="soft-button remove-photo-btn" @click="itemForm.imageUrl = ''">Remove item photo</button>
          <p v-if="uploadingItemPhoto" class="upload-state"><LoaderCircle class="spin" :size="15" />Processing photo…</p>
          <p v-if="itemPhotoError" class="form-error">{{ itemPhotoError }}</p>
        </div>
        <p v-if="itemError" class="form-error span-2">{{ itemError }}</p>
        <div class="modal-actions span-2"><button type="button" class="secondary-button" @click="showItemForm = false">Cancel</button><button class="primary-button" :disabled="uploadingItemPhoto">{{ editingItemId ? 'Save Changes' : 'Save to Catalog' }}</button></div>
      </form>
    </UiModal>

    <UiModal :open="showDeleteItemModal" title="Delete Inventory Item?" description="Removed items will no longer appear in item dropdown selectors." @close="showDeleteItemModal = false">
      <div v-if="deletingItem" class="cancel-impact-box">
        <strong>{{ deletingItem.name }} ({{ deletingItem.code }})</strong>
        <ul>
          <li>Category: {{ deletingItem.category }} · Unit: {{ deletingItem.unit }}</li>
          <li>Current available stock: {{ store.stockAvailable(deletingItem) }} {{ deletingItem.unit }}</li>
        </ul>
      </div>
      <div class="modal-actions" style="margin-top: 16px;">
        <button type="button" class="secondary-button" @click="showDeleteItemModal = false">Cancel</button>
        <button type="button" class="danger-button" @click="confirmDeleteItem">Yes, Delete Item</button>
      </div>
    </UiModal>

    <UiModal :open="showEditMovement" :title="`Edit Stock ${editMovementForm.type === 'Masuk' ? 'In' : 'Out'}`" description="Update item, quantity, date, staff PIC, or photo proof." wide @close="showEditMovement = false">
      <form class="form-grid" @submit.prevent="submitEditMovement">
        <label class="is-required"><span>Date *</span><input v-model="editMovementForm.date" type="date" /></label>
        <label class="is-required">
          <span>PIC / Staff *</span>
          <SearchSelect v-model="editMovementForm.pic" :options="staffPicOptions" required placeholder="Select staff PIC" search-placeholder="Search staff…" />
        </label>
        <label class="is-required">
          <span>Item Name *</span>
          <SearchSelect v-model="editMovementForm.itemId" :options="inventoryItemOptions" required search-placeholder="Search item…" />
        </label>
        <label class="is-required">
          <span>Quantity &amp; Unit *</span>
          <div class="qty-unit-input">
            <input v-model.number="editMovementForm.quantity" type="number" min="1" />
            <span class="qty-unit-suffix">{{ store.inventory.find((i) => i.id === editMovementForm.itemId)?.unit || 'unit' }}</span>
          </div>
        </label>
        <label class="span-2 is-optional"><span>Notes <em class="opt-tag">Optional</em></span><textarea v-model="editMovementForm.notes" rows="2" /></label>
        <div class="span-2 attire-upload-block">
          <span class="upload-field-label">Photo Proof (Optional)</span>
          <label class="upload-zone">
            <img v-if="editMovementForm.proofImageUrl" :src="editMovementForm.proofImageUrl" alt="Transaction proof" />
            <div v-else><UploadCloud :size="24" /><strong>Upload JPG, PNG, or WebP proof</strong><span>Max 5 MB</span></div>
            <input type="file" accept="image/jpeg,image/png,image/webp" @change="handleEditMovementProof" />
          </label>
          <button v-if="editMovementForm.proofImageUrl" type="button" class="soft-button remove-photo-btn" @click="editMovementForm.proofImageUrl = ''">Remove photo proof</button>
          <p v-if="editMovementUploading" class="upload-state"><LoaderCircle class="spin" :size="15" />Processing photo…</p>
        </div>
        <p v-if="editMovementError" class="form-error span-2">{{ editMovementError }}</p>
        <div class="modal-actions span-2">
          <button type="button" class="secondary-button" @click="showEditMovement = false">Cancel</button>
          <button class="primary-button" :disabled="editMovementUploading">Save Changes</button>
        </div>
      </form>
    </UiModal>

    <UiModal :open="showDeleteMovementModal && Boolean(deletingMovement)" title="Delete Stock Movement Record?" description="Inventory stock counts will be recalculated automatically." @close="showDeleteMovementModal = false">
      <div v-if="deletingMovement" class="cancel-impact-box">
        <strong>Stock {{ deletingMovement.type === 'Masuk' ? 'In' : 'Out' }} — {{ store.inventory.find((i) => i.id === deletingMovement?.itemId)?.name }}</strong>
        <ul>
          <li>Date: {{ formatDate(deletingMovement.date) }} · Qty: {{ deletingMovement.quantity }}</li>
          <li>PIC: {{ deletingMovement.pic }}</li>
        </ul>
      </div>
      <div class="modal-actions" style="margin-top: 16px;">
        <button type="button" class="secondary-button" @click="showDeleteMovementModal = false">Cancel</button>
        <button type="button" class="danger-button" @click="confirmDeleteMovement">Yes, Delete Record</button>
      </div>
    </UiModal>

    <UiModal :open="showDeleteOpnameModal && Boolean(deletingOpname)" title="Delete Stock Opname Audit?" description="Stock adjustments applied by this audit will be reverted automatically." @close="showDeleteOpnameModal = false">
      <div v-if="deletingOpname" class="cancel-impact-box">
        <strong>{{ deletingOpname.opnameNumber }} — {{ formatDate(deletingOpname.date) }}</strong>
        <ul>
          <li>PIC: {{ deletingOpname.pic }} · {{ deletingOpname.items.length }} items audited</li>
        </ul>
      </div>
      <div class="modal-actions" style="margin-top: 16px;">
        <button type="button" class="secondary-button" @click="showDeleteOpnameModal = false">Cancel</button>
        <button type="button" class="danger-button" @click="confirmDeleteOpname">Yes, Delete Audit</button>
      </div>
    </UiModal>
  </div>
</template>
