<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  Plus, Search, ArrowDownToLine, ArrowUpFromLine, Boxes, TriangleAlert, PackageCheck,
  History, ClipboardCheck, Trash2, UploadCloud, LoaderCircle, Eye, Image as ImageIcon, Pencil, Download,
} from '@lucide/vue'
import { useCrmStore, type InventoryItem, type StockMovement, type StockOpnameRecord } from '../stores/crm'
import { formatDate } from '../utils/format'
import { uploadImageWithFallback } from '../utils/uploadImage'
import { downloadSelectedReportsPdf } from '../utils/reportPdf'
import StatusBadge from '../components/StatusBadge.vue'
import UiModal from '../components/UiModal.vue'

const store = useCrmStore()
const tab = ref<'master' | 'in' | 'out' | 'opname' | 'monitor'>('master')
const search = ref('')
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

// Edit / Delete per-row for Barang Masuk & Barang Keluar
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

// Edit / Delete for Stok Opname
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
  date: '2026-11-17',
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
  date: '2026-11-17',
  pic: '',
  notes: '',
  rows: [],
})

const itemForm = reactive({ name: '', category: '', unit: 'pcs', initialStock: 0, minimumStock: 0, location: '' })

const items = computed(() => store.inventory.filter((item) => item.name.toLowerCase().includes(search.value.toLowerCase()) || item.code.toLowerCase().includes(search.value.toLowerCase())))
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
    proofError.value = err instanceof Error ? err.message : 'Gagal mengunggah bukti foto.'
  } finally {
    uploadingProof.value = false
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
    error.value = err instanceof Error ? err.message : 'Transaksi gagal.'
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
    // System stock before this opname's diff is current stock minus prior diff
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
    editMovementError.value = err instanceof Error ? err.message : 'Gagal mengunggah bukti foto.'
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
    editMovementError.value = err instanceof Error ? err.message : 'Gagal menyimpan perubahan transaksi.'
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
    if (!chosen.length) throw new Error('Pilih minimal satu barang untuk pemeriksaan stok.')
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
    opnameError.value = err instanceof Error ? err.message : 'Pemeriksaan stok gagal disimpan.'
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
  Object.assign(itemForm, { name: '', category: '', unit: 'pcs', initialStock: 0, minimumStock: 0, location: '' })
  itemError.value = ''
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
    location: item.location,
  })
  itemError.value = ''
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
  if (!itemForm.name.trim() || !itemForm.category.trim() || !itemForm.unit.trim() || !itemForm.location.trim()) { itemError.value = 'Nama, kategori, satuan, dan lokasi wajib diisi.'; return }
  if (itemForm.initialStock < 0 || itemForm.minimumStock < 0) { itemError.value = 'Nilai stok tidak boleh negatif.'; return }
  if (editingItemId.value) {
    store.updateInventoryItem(editingItemId.value, { ...itemForm })
  } else {
    const created = store.addInventoryItem({ ...itemForm })
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

const exportInventoryPdf = () => {
  downloadSelectedReportsPdf({
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
}
</script>

<template>
  <div class="page-stack">
    <section class="page-heading">
      <div><span class="eyebrow">Bisnis</span><h2>Inventaris Barang</h2><p>Pantauan stok aktual, multi-input barang masuk/keluar dengan bukti foto, ubah/hapus riwayat, dan pemeriksaan stok.</p></div>
      <div class="heading-actions">
        <button class="secondary-button" @click="exportInventoryPdf"><Download :size="17" />Unduh PDF Stok</button>
        <button class="secondary-button" @click="openOpnameModal"><ClipboardCheck :size="17" />Pemeriksaan Stok</button>
        <button class="secondary-button" @click="openMovement('Keluar')"><ArrowUpFromLine :size="17" />Barang Keluar</button>
        <button class="primary-button" @click="openMovement('Masuk')"><ArrowDownToLine :size="17" />Barang Masuk</button>
      </div>
    </section>

    <section class="inventory-stats">
      <article><span class="tone-sage"><Boxes :size="21" /></span><div><small>Total jenis barang</small><strong>{{ store.inventory.length }}</strong></div></article>
      <article><span class="tone-blue"><PackageCheck :size="21" /></span><div><small>Stok aman</small><strong>{{ safeCount }}</strong></div></article>
      <article><span class="tone-amber"><TriangleAlert :size="21" /></span><div><small>Stok menipis</small><strong>{{ lowCount }}</strong></div></article>
      <article><span class="tone-rose"><TriangleAlert :size="21" /></span><div><small>Stok habis</small><strong>{{ emptyCount }}</strong></div></article>
    </section>

    <section class="panel table-panel">
      <div class="inventory-tabs">
        <button :class="{ active: tab === 'master' }" @click="tab = 'master'">Katalog Barang</button>
        <button :class="{ active: tab === 'in' }" @click="tab = 'in'">Barang Masuk</button>
        <button :class="{ active: tab === 'out' }" @click="tab = 'out'">Barang Keluar</button>
        <button :class="{ active: tab === 'opname' }" @click="tab = 'opname'">Pemeriksaan Stok</button>
        <button :class="{ active: tab === 'monitor' }" @click="tab = 'monitor'">Pantauan Stok</button>
      </div>

      <template v-if="tab === 'master' || tab === 'monitor'">
        <div class="table-toolbar">
          <label class="table-search"><Search :size="17" /><input v-model="search" placeholder="Cari nama atau kode barang" /></label>
          <button v-if="tab === 'master'" class="soft-button" @click="openItemForm(false)"><Plus :size="16" />Tambah Nama Barang</button>
        </div>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Barang</th>
                <th>Kategori</th>
                <th>Lokasi</th>
                <th>Stok awal</th>
                <th>Masuk</th>
                <th>Keluar</th>
                <th>Penyesuaian</th>
                <th>Stok tersedia</th>
                <th>Status</th>
                <th v-if="tab === 'master'">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in items" :key="item.id">
                <td><div class="inventory-name"><span>{{ item.name.slice(0, 1) }}</span><div><strong>{{ item.name }}</strong><small>{{ item.code }} · {{ item.unit }}</small></div></div></td>
                <td>{{ item.category }}</td>
                <td>{{ item.location }}</td>
                <td>{{ item.initialStock }}</td>
                <td class="positive-number">+{{ item.stockIn }}</td>
                <td class="negative-number">−{{ item.stockOut }}</td>
                <td>
                  <strong :class="(item.stockAdjustment ?? 0) > 0 ? 'positive-number' : (item.stockAdjustment ?? 0) < 0 ? 'negative-number' : ''">
                    {{ (item.stockAdjustment ?? 0) > 0 ? `+${item.stockAdjustment}` : (item.stockAdjustment ?? 0) }}
                  </strong>
                </td>
                <td><strong class="stock-number">{{ store.stockAvailable(item) }} <small>{{ item.unit }}</small></strong><span class="subtle-line">Minimum {{ item.minimumStock }}</span></td>
                <td><StatusBadge :label="store.stockStatus(item)" /></td>
                <td v-if="tab === 'master'">
                  <div class="row-actions">
                    <button type="button" class="icon-button" title="Edit nama & detail barang" @click="openEditItemForm(item)"><Pencil :size="15" /></button>
                    <button type="button" class="icon-button danger-icon-button" title="Kurangi / hapus barang dari katalog" @click="openDeleteItemModal(item)"><Trash2 :size="15" /></button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <template v-else-if="tab === 'opname'">
        <div class="movement-head movement-head--between">
          <div>
            <ClipboardCheck :size="20" />
            <div>
              <h3>Riwayat Pemeriksaan Stok (Opname)</h3>
              <p>Penyelarasan stok sistem dengan stok fisik beserta rincian selisih (+) dan (-).</p>
            </div>
          </div>
          <button type="button" class="soft-button" @click="openOpnameModal"><Plus :size="15" />Mulai Pemeriksaan Stok</button>
        </div>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>No. Opname</th>
                <th>Tanggal</th>
                <th>Penanggung Jawab</th>
                <th>Barang Dicek</th>
                <th>Ringkasan Selisih</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="record in store.stockOpnames" :key="record.id">
                <td><strong class="mono-code">{{ record.opnameNumber }}</strong></td>
                <td>{{ formatDate(record.date) }}</td>
                <td><strong>{{ record.pic }}</strong></td>
                <td>{{ record.items.length }} barang</td>
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
                    <StatusBadge v-if="record.items.every((i) => i.diff === 0)" label="Sesuai Semua" />
                  </div>
                </td>
                <td>
                  <div class="row-actions">
                    <button type="button" class="icon-button" title="Lihat rincian pemeriksaan stok" @click="openOpnameDetailModal(record)">
                      <Eye :size="16" />
                    </button>
                    <button type="button" class="icon-button" title="Ubah pemeriksaan stok" @click="openEditOpnameModal(record)">
                      <Pencil :size="15" />
                    </button>
                    <button type="button" class="icon-button danger-icon-button" title="Hapus pemeriksaan stok" @click="openDeleteOpnameModal(record)">
                      <Trash2 :size="15" />
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="!store.stockOpnames.length">
                <td colspan="6">
                  <div class="empty-state">
                    <ClipboardCheck :size="28" />
                    <strong>Belum ada pemeriksaan stok</strong>
                    <span>Klik "Pemeriksaan Stok" untuk mencocokkan stok sistem dengan stok fisik.</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <template v-else>
        <div class="movement-head"><div><History :size="20" /><div><h3>Riwayat barang {{ tab === 'in' ? 'masuk' : 'keluar' }}</h3><p>Transaksi tersimpan dengan penanggung jawab, bukti foto, serta fitur ubah &amp; hapus.</p></div></div></div>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead><tr><th>Tanggal</th><th>Nama Barang</th><th>Jml</th><th>Penanggung Jawab</th><th>Bukti Foto</th><th>Keterangan</th><th>Aksi</th></tr></thead>
            <tbody>
              <tr v-for="row in store.movements.filter((m) => m.type === (tab === 'in' ? 'Masuk' : 'Keluar'))" :key="row.id">
                <td>{{ formatDate(row.date) }}</td>
                <td><strong>{{ store.inventory.find((item) => item.id === row.itemId)?.name }}</strong></td>
                <td><strong :class="row.type === 'Masuk' ? 'positive-number' : 'negative-number'">{{ row.type === 'Masuk' ? '+' : '−' }}{{ row.quantity }}</strong> <small class="unit-tag">{{ store.inventory.find((item) => item.id === row.itemId)?.unit ?? '' }}</small></td>
                <td>{{ row.pic }}</td>
                <td>
                  <button v-if="row.proofImageUrl" type="button" class="proof-thumb-btn" title="Lihat bukti foto" @click="openProofModal(row.proofImageUrl)">
                    <img :src="row.proofImageUrl" alt="Bukti foto" />
                  </button>
                  <span v-else class="subtle-line">—</span>
                </td>
                <td>{{ row.notes || '—' }}</td>
                <td>
                  <div class="row-actions">
                    <button type="button" class="icon-button" title="Ubah transaksi barang" @click="openEditMovementModal(row)"><Pencil :size="15" /></button>
                    <button type="button" class="icon-button danger-icon-button" title="Hapus transaksi barang" @click="openDeleteMovementModal(row)"><Trash2 :size="15" /></button>
                  </div>
                </td>
              </tr>
              <tr v-if="!store.movements.filter((m) => m.type === (tab === 'in' ? 'Masuk' : 'Keluar')).length">
                <td colspan="7">
                  <div class="empty-state">
                    <History :size="26" />
                    <strong>Belum ada riwayat barang {{ tab === 'in' ? 'masuk' : 'keluar' }}</strong>
                    <span>Catat transaksi baru atau perbarui catatan barang yang sudah masuk.</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </section>

    <UiModal :open="showMovement" :title="`Catat Barang ${movement.type}`" :description="`Input beberapa jenis barang ${movement.type.toLowerCase()} sekaligus beserta bukti foto.`" wide @close="showMovement = false">
      <form class="form-grid" @submit.prevent="submitMovement">
        <label><span>Tanggal *</span><input v-model="movement.date" type="date" /></label>
        <label><span>Nama PIC / Penanggung Jawab *</span><input v-model="movement.pic" placeholder="Nama orang yang bertanggung jawab" /></label>

        <div class="order-lines span-2">
          <div class="order-lines-head">
            <div>
              <strong>Daftar Barang {{ movement.type }}</strong>
              <span>Tambahkan satu atau beberapa jenis barang, atau tambah nama barang baru ke katalog.</span>
            </div>
            <div class="add-group-add-trigger">
              <button type="button" class="soft-button" @click="openItemForm(true)"><Plus :size="14" />Barang Baru</button>
              <button type="button" class="soft-button" @click="addMovementLine"><Plus :size="15" />Tambah Baris</button>
            </div>
          </div>

          <div v-for="(line, idx) in movement.items" :key="line.key" class="stock-batch-row">
            <label>
              <span>Nama Barang {{ idx + 1 }} *</span>
              <select v-model="line.itemId">
                <option value="">Pilih barang</option>
                <option v-for="item in store.inventory" :key="item.id" :value="item.id">
                  {{ item.name }} (Stok: {{ store.stockAvailable(item) }} {{ item.unit }})
                </option>
              </select>
            </label>
            <label>
              <span>Qty & Satuan *</span>
              <div class="qty-unit-input">
                <input
                  v-model.number="line.quantity"
                  type="number"
                  min="1"
                  :max="movement.type === 'Keluar' && line.itemId ? store.stockAvailable(store.inventory.find((i) => i.id === line.itemId)!) : undefined"
                />
                <span class="qty-unit-suffix">{{ store.inventory.find((i) => i.id === line.itemId)?.unit || 'satuan' }}</span>
              </div>
            </label>
            <button
              type="button"
              class="icon-button order-line-remove"
              :disabled="movement.items.length === 1"
              title="Hapus baris"
              @click="movement.items.splice(idx, 1)"
            >
              <Trash2 :size="16" />
            </button>
          </div>
        </div>

        <label class="span-2"><span>Keterangan</span><textarea v-model="movement.notes" rows="2" placeholder="Supplier, keperluan acara, atau catatan tambahan" /></label>

        <div class="span-2 attire-upload-block">
          <span class="upload-field-label">Upload Bukti Foto</span>
          <label class="upload-zone">
            <img v-if="movement.proofImageUrl" :src="movement.proofImageUrl" alt="Bukti foto transaksi" />
            <div v-else><UploadCloud :size="24" /><strong>Unggah bukti foto JPG, PNG, atau WebP</strong><span>Maksimal 5 MB</span></div>
            <input type="file" accept="image/jpeg,image/png,image/webp" @change="handleMovementProof" />
          </label>
          <button v-if="movement.proofImageUrl" type="button" class="soft-button remove-photo-btn" @click="movement.proofImageUrl = ''">
            Hapus bukti foto
          </button>
          <p v-if="uploadingProof" class="upload-state"><LoaderCircle class="spin" :size="15" />Memproses foto…</p>
          <p v-if="proofError" class="form-error">{{ proofError }}</p>
        </div>

        <p v-if="error" class="form-error span-2">{{ error }}</p>
        <div class="modal-actions span-2">
          <button type="button" class="secondary-button" @click="showMovement = false">Batal</button>
          <button class="primary-button" :disabled="uploadingProof">Simpan Transaksi ({{ movement.items.length }} Item)</button>
        </div>
      </form>
    </UiModal>

    <UiModal :open="showOpnameForm" :title="editingOpnameId ? 'Ubah Pemeriksaan Stok (Opname)' : 'Pemeriksaan Stok (Opname)'" description="Masukkan jumlah stok fisik untuk menyelaraskan stok sistem dan melihat selisih (+) atau (-)." wide @close="showOpnameForm = false">
      <form class="form-grid" @submit.prevent="submitOpname">
        <label><span>Tanggal Pemeriksaan *</span><input v-model="opnameForm.date" type="date" /></label>
        <label><span>Penanggung Jawab *</span><input v-model="opnameForm.pic" placeholder="Nama penanggung jawab pemeriksaan" /></label>

        <div class="span-2 opname-sheet-wrap">
          <table class="opname-sheet-table">
            <thead>
              <tr>
                <th>Cek</th>
                <th>Barang</th>
                <th>Sistem</th>
                <th>Fisik</th>
                <th>Selisih</th>
                <th>Catatan</th>
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
                <td><input v-model="row.notes" placeholder="Alasan selisih" :disabled="!row.included" /></td>
              </tr>
            </tbody>
          </table>
        </div>

        <label class="span-2"><span>Catatan Umum</span><input v-model="opnameForm.notes" placeholder="Contoh: Stok opname bulanan November" /></label>
        <p v-if="opnameError" class="form-error span-2">{{ opnameError }}</p>
        <div class="modal-actions span-2">
          <button type="button" class="secondary-button" @click="showOpnameForm = false">Batal</button>
          <button class="primary-button">Simpan & Selaraskan Stok</button>
        </div>
      </form>
    </UiModal>

    <UiModal :open="showOpnameDetail" :title="selectedOpname ? `Detail ${selectedOpname.opnameNumber}` : 'Detail Stok Opname'" description="Perbandingan stok sistem vs stok fisik dan selisih yang diselaraskan." wide @close="showOpnameDetail = false">
      <div v-if="selectedOpname" class="opname-detail-body">
        <div class="opname-detail-meta">
          <span>Tanggal: <strong>{{ formatDate(selectedOpname.date) }}</strong></span>
          <span>PIC: <strong>{{ selectedOpname.pic }}</strong></span>
          <span v-if="selectedOpname.notes">Catatan: <strong>{{ selectedOpname.notes }}</strong></span>
        </div>
        <div class="opname-sheet-wrap">
          <table class="opname-sheet-table">
            <thead>
              <tr>
                <th>Barang</th>
                <th>Stok Sistem</th>
                <th>Stok Fisik</th>
                <th>Selisih (+/-)</th>
                <th>Catatan</th>
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
      <div class="modal-actions"><button class="primary-button" @click="showOpnameDetail = false">Tutup</button></div>
    </UiModal>

    <UiModal :open="showProofZoom" title="Bukti Foto Transaksi" @close="showProofZoom = false">
      <div class="attire-zoom">
        <div>
          <img v-if="zoomedProofUrl" :src="zoomedProofUrl" alt="Bukti foto transaksi" />
          <ImageIcon v-else :size="48" />
        </div>
      </div>
    </UiModal>

    <UiModal :open="showItemForm" :title="editingItemId ? 'Edit Nama & Detail Barang' : 'Tambah Barang ke Katalog'" :description="editingItemId ? 'Perbarui nama, satuan, kategori, atau batas minimum stok barang.' : 'Kode barang dibuat otomatis dan langsung tersedia saat memilih barang.'" wide @close="showItemForm = false">
      <form class="form-grid" @submit.prevent="submitItem">
        <label><span>Nama barang *</span><input v-model="itemForm.name" placeholder="Contoh: Lip Tint" /></label>
        <label><span>Kategori *</span><input v-model="itemForm.category" placeholder="Contoh: Lips" /></label>
        <label><span>Satuan *</span><input v-model="itemForm.unit" placeholder="pcs / botol / box" /></label>
        <label><span>Lokasi penyimpanan *</span><input v-model="itemForm.location" placeholder="Contoh: Drawer A4" /></label>
        <label><span>Stok awal</span><input v-model.number="itemForm.initialStock" type="number" min="0" /></label>
        <label><span>Minimum stok</span><input v-model.number="itemForm.minimumStock" type="number" min="0" /></label>
        <p v-if="itemError" class="form-error span-2">{{ itemError }}</p>
        <div class="modal-actions span-2"><button type="button" class="secondary-button" @click="showItemForm = false">Batal</button><button class="primary-button">{{ editingItemId ? 'Simpan Perubahan' : 'Simpan ke Katalog' }}</button></div>
      </form>
    </UiModal>

    <UiModal :open="showDeleteItemModal" title="Hapus Barang dari Katalog?" description="Barang yang dihapus tidak akan muncul lagi pada pilihan nama barang." @close="showDeleteItemModal = false">
      <div v-if="deletingItem" class="cancel-impact-box">
        <strong>{{ deletingItem.name }} ({{ deletingItem.code }})</strong>
        <ul>
          <li>Kategori: {{ deletingItem.category }} · Satuan: {{ deletingItem.unit }}</li>
          <li>Sisa stok saat ini: {{ store.stockAvailable(deletingItem) }} {{ deletingItem.unit }}</li>
        </ul>
      </div>
      <div class="modal-actions" style="margin-top: 16px;">
        <button type="button" class="secondary-button" @click="showDeleteItemModal = false">Batal</button>
        <button type="button" class="danger-button" @click="confirmDeleteItem">Ya, Hapus Barang</button>
      </div>
    </UiModal>

    <UiModal :open="showEditMovement" :title="`Ubah Barang ${editMovementForm.type}`" description="Perbaiki barang, jumlah, tanggal, penanggung jawab, atau bukti foto." wide @close="showEditMovement = false">
      <form class="form-grid" @submit.prevent="submitEditMovement">
        <label><span>Tanggal *</span><input v-model="editMovementForm.date" type="date" /></label>
        <label><span>Penanggung Jawab *</span><input v-model="editMovementForm.pic" /></label>
        <label>
          <span>Nama Barang *</span>
          <select v-model="editMovementForm.itemId">
            <option v-for="item in store.inventory" :key="item.id" :value="item.id">
              {{ item.name }} (Stok: {{ store.stockAvailable(item) }} {{ item.unit }})
            </option>
          </select>
        </label>
        <label>
          <span>Jumlah &amp; Satuan *</span>
          <div class="qty-unit-input">
            <input v-model.number="editMovementForm.quantity" type="number" min="1" />
            <span class="qty-unit-suffix">{{ store.inventory.find((i) => i.id === editMovementForm.itemId)?.unit || 'satuan' }}</span>
          </div>
        </label>
        <label class="span-2"><span>Keterangan</span><textarea v-model="editMovementForm.notes" rows="2" /></label>
        <div class="span-2 attire-upload-block">
          <span class="upload-field-label">Bukti Foto (Opsional)</span>
          <label class="upload-zone">
            <img v-if="editMovementForm.proofImageUrl" :src="editMovementForm.proofImageUrl" alt="Bukti foto transaksi" />
            <div v-else><UploadCloud :size="24" /><strong>Unggah bukti foto JPG, PNG, atau WebP</strong><span>Maksimal 5 MB</span></div>
            <input type="file" accept="image/jpeg,image/png,image/webp" @change="handleEditMovementProof" />
          </label>
          <button v-if="editMovementForm.proofImageUrl" type="button" class="soft-button remove-photo-btn" @click="editMovementForm.proofImageUrl = ''">Hapus bukti foto</button>
          <p v-if="editMovementUploading" class="upload-state"><LoaderCircle class="spin" :size="15" />Memproses foto…</p>
        </div>
        <p v-if="editMovementError" class="form-error span-2">{{ editMovementError }}</p>
        <div class="modal-actions span-2">
          <button type="button" class="secondary-button" @click="showEditMovement = false">Batal</button>
          <button class="primary-button" :disabled="editMovementUploading">Simpan Perubahan</button>
        </div>
      </form>
    </UiModal>

    <UiModal :open="showDeleteMovementModal && Boolean(deletingMovement)" title="Hapus Riwayat Transaksi Barang?" description="Stok barang di inventaris akan disesuaikan kembali secara otomatis." @close="showDeleteMovementModal = false">
      <div v-if="deletingMovement" class="cancel-impact-box">
        <strong>Barang {{ deletingMovement.type }} — {{ store.inventory.find((i) => i.id === deletingMovement?.itemId)?.name }}</strong>
        <ul>
          <li>Tanggal: {{ formatDate(deletingMovement.date) }} · Jumlah: {{ deletingMovement.quantity }}</li>
          <li>Penanggung Jawab: {{ deletingMovement.pic }}</li>
        </ul>
      </div>
      <div class="modal-actions" style="margin-top: 16px;">
        <button type="button" class="secondary-button" @click="showDeleteMovementModal = false">Batal</button>
        <button type="button" class="danger-button" @click="confirmDeleteMovement">Ya, Hapus Transaksi</button>
      </div>
    </UiModal>

    <UiModal :open="showDeleteOpnameModal && Boolean(deletingOpname)" title="Hapus Riwayat Pemeriksaan Stok?" description="Penyesuaian stok dari pemeriksaan ini akan dikembalikan seperti semula." @close="showDeleteOpnameModal = false">
      <div v-if="deletingOpname" class="cancel-impact-box">
        <strong>{{ deletingOpname.opnameNumber }} — {{ formatDate(deletingOpname.date) }}</strong>
        <ul>
          <li>Penanggung Jawab: {{ deletingOpname.pic }} · {{ deletingOpname.items.length }} barang dicek</li>
        </ul>
      </div>
      <div class="modal-actions" style="margin-top: 16px;">
        <button type="button" class="secondary-button" @click="showDeleteOpnameModal = false">Batal</button>
        <button type="button" class="danger-button" @click="confirmDeleteOpname">Ya, Hapus Pemeriksaan Stok</button>
      </div>
    </UiModal>
  </div>
</template>
