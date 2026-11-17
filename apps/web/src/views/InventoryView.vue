<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { Plus, Search, ArrowDownToLine, ArrowUpFromLine, Boxes, TriangleAlert, PackageCheck, History } from '@lucide/vue'
import { useCrmStore, type StockMovement } from '../stores/crm'
import { formatDate } from '../utils/format'
import StatusBadge from '../components/StatusBadge.vue'
import UiModal from '../components/UiModal.vue'

const store = useCrmStore()
const tab = ref<'master' | 'in' | 'out' | 'monitor'>('master')
const search = ref('')
const showMovement = ref(false)
const showItemForm = ref(false)
const error = ref('')
const itemError = ref('')
const movement = reactive({ itemId: '', type: 'Masuk' as StockMovement['type'], quantity: 1, date: '2026-11-17', pic: '', notes: '' })
const itemForm = reactive({ name: '', category: '', unit: 'pcs', initialStock: 0, minimumStock: 0, location: '' })

const items = computed(() => store.inventory.filter((item) => item.name.toLowerCase().includes(search.value.toLowerCase()) || item.code.toLowerCase().includes(search.value.toLowerCase())))
const safeCount = computed(() => store.inventory.filter((item) => store.stockStatus(item) === 'Aman').length)
const lowCount = computed(() => store.inventory.filter((item) => store.stockStatus(item) === 'Menipis').length)
const emptyCount = computed(() => store.inventory.filter((item) => store.stockStatus(item) === 'Habis').length)
const selectedItem = computed(() => store.inventory.find((item) => item.id === movement.itemId))

const openMovement = (type: StockMovement['type']) => { movement.type = type; movement.itemId = ''; movement.quantity = 1; movement.pic = ''; movement.notes = ''; error.value = ''; showMovement.value = true }
const submitMovement = () => {
  try { error.value = ''; store.moveStock(movement); showMovement.value = false }
  catch (err) { error.value = err instanceof Error ? err.message : 'Transaksi gagal.' }
}
const openItemForm = () => { Object.assign(itemForm, { name: '', category: '', unit: 'pcs', initialStock: 0, minimumStock: 0, location: '' }); itemError.value = ''; showItemForm.value = true }
const submitItem = () => {
  itemError.value = ''
  if (!itemForm.name.trim() || !itemForm.category.trim() || !itemForm.unit.trim() || !itemForm.location.trim()) { itemError.value = 'Nama, kategori, satuan, dan lokasi wajib diisi.'; return }
  if (itemForm.initialStock < 0 || itemForm.minimumStock < 0) { itemError.value = 'Nilai stok tidak boleh negatif.'; return }
  store.addInventoryItem({ ...itemForm })
  showItemForm.value = false
}
</script>

<template>
  <div class="page-stack">
    <section class="page-heading"><div><span class="eyebrow">Bisnis</span><h2>Inventory</h2><p>Monitoring stok aktual berdasarkan ledger transaksi barang masuk dan keluar.</p></div><div class="heading-actions"><button class="secondary-button" @click="openMovement('Keluar')"><ArrowUpFromLine :size="17" />Barang Keluar</button><button class="primary-button" @click="openMovement('Masuk')"><ArrowDownToLine :size="17" />Barang Masuk</button></div></section>
    <section class="inventory-stats"><article><span class="tone-sage"><Boxes :size="21" /></span><div><small>Total jenis barang</small><strong>{{ store.inventory.length }}</strong></div></article><article><span class="tone-blue"><PackageCheck :size="21" /></span><div><small>Stok aman</small><strong>{{ safeCount }}</strong></div></article><article><span class="tone-amber"><TriangleAlert :size="21" /></span><div><small>Stok menipis</small><strong>{{ lowCount }}</strong></div></article><article><span class="tone-rose"><TriangleAlert :size="21" /></span><div><small>Stok habis</small><strong>{{ emptyCount }}</strong></div></article></section>
    <section class="panel table-panel">
      <div class="inventory-tabs"><button :class="{ active: tab === 'master' }" @click="tab = 'master'">Master Barang</button><button :class="{ active: tab === 'in' }" @click="tab = 'in'">Barang Masuk</button><button :class="{ active: tab === 'out' }" @click="tab = 'out'">Barang Keluar</button><button :class="{ active: tab === 'monitor' }" @click="tab = 'monitor'">Monitoring</button></div>
      <template v-if="tab === 'master' || tab === 'monitor'">
        <div class="table-toolbar"><label class="table-search"><Search :size="17" /><input v-model="search" placeholder="Cari nama atau kode barang" /></label><button v-if="tab === 'master'" class="soft-button" @click="openItemForm"><Plus :size="16" />Tambah Barang</button></div>
        <div class="data-table-wrap"><table class="data-table"><thead><tr><th>Barang</th><th>Kategori</th><th>Lokasi</th><th>Stok awal</th><th>Masuk</th><th>Keluar</th><th>Stok tersedia</th><th>Status</th></tr></thead><tbody><tr v-for="item in items" :key="item.id"><td><div class="inventory-name"><span>{{ item.name.slice(0, 1) }}</span><div><strong>{{ item.name }}</strong><small>{{ item.code }} · {{ item.unit }}</small></div></div></td><td>{{ item.category }}</td><td>{{ item.location }}</td><td>{{ item.initialStock }}</td><td class="positive-number">+{{ item.stockIn }}</td><td class="negative-number">−{{ item.stockOut }}</td><td><strong class="stock-number">{{ store.stockAvailable(item) }} <small>{{ item.unit }}</small></strong><span class="subtle-line">Minimum {{ item.minimumStock }}</span></td><td><StatusBadge :label="store.stockStatus(item)" /></td></tr></tbody></table></div>
      </template>
      <template v-else>
        <div class="movement-head"><div><History :size="20" /><div><h3>Riwayat barang {{ tab === 'in' ? 'masuk' : 'keluar' }}</h3><p>Transaksi tersimpan dengan PIC dan waktu pencatatan.</p></div></div></div>
        <div class="data-table-wrap"><table class="data-table"><thead><tr><th>Tanggal</th><th>Nama Barang</th><th>Qty</th><th>PIC</th><th>Keterangan</th></tr></thead><tbody><tr v-for="row in store.movements.filter((m) => m.type === (tab === 'in' ? 'Masuk' : 'Keluar'))" :key="row.id"><td>{{ formatDate(row.date) }}</td><td><strong>{{ store.inventory.find((item) => item.id === row.itemId)?.name }}</strong></td><td><strong :class="row.type === 'Masuk' ? 'positive-number' : 'negative-number'">{{ row.type === 'Masuk' ? '+' : '−' }}{{ row.quantity }}</strong></td><td>{{ row.pic }}</td><td>{{ row.notes || '—' }}</td></tr></tbody></table></div>
      </template>
    </section>

    <UiModal :open="showMovement" :title="`Catat Barang ${movement.type}`" :description="`Transaksi ${movement.type.toLowerCase()} tidak menggunakan Nomor PO.`" wide @close="showMovement = false">
      <form class="form-grid" @submit.prevent="submitMovement">
        <label class="span-2"><span>Nama Barang *</span><select v-model="movement.itemId"><option value="">Pilih barang</option><option v-for="item in store.inventory" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
        <div v-if="selectedItem && movement.type === 'Keluar'" class="stock-available span-2"><span>Stok tersedia sebelum transaksi</span><strong>{{ store.stockAvailable(selectedItem) }} {{ selectedItem.unit }}</strong></div>
        <label><span>Qty {{ movement.type }} *</span><input v-model.number="movement.quantity" type="number" min="1" :max="movement.type === 'Keluar' && selectedItem ? store.stockAvailable(selectedItem) : undefined" /></label><label><span>Tanggal *</span><input v-model="movement.date" type="date" /></label>
        <label class="span-2"><span>Nama PIC / Penanggung Jawab *</span><input v-model="movement.pic" placeholder="Nama orang yang bertanggung jawab" /></label><label class="span-2"><span>Keterangan</span><textarea v-model="movement.notes" rows="2" /></label>
        <p v-if="error" class="form-error span-2">{{ error }}</p><div class="modal-actions span-2"><button type="button" class="secondary-button" @click="showMovement = false">Batal</button><button class="primary-button">Simpan Transaksi</button></div>
      </form>
    </UiModal>

    <UiModal :open="showItemForm" title="Tambah Master Barang" description="Kode barang dibuat otomatis setelah data disimpan." wide @close="showItemForm = false">
      <form class="form-grid" @submit.prevent="submitItem">
        <label><span>Nama barang *</span><input v-model="itemForm.name" placeholder="Contoh: Lip Tint" /></label>
        <label><span>Kategori *</span><input v-model="itemForm.category" placeholder="Contoh: Lips" /></label>
        <label><span>Satuan *</span><input v-model="itemForm.unit" placeholder="pcs / botol / box" /></label>
        <label><span>Lokasi penyimpanan *</span><input v-model="itemForm.location" placeholder="Contoh: Drawer A4" /></label>
        <label><span>Stok awal</span><input v-model.number="itemForm.initialStock" type="number" min="0" /></label>
        <label><span>Minimum stok</span><input v-model.number="itemForm.minimumStock" type="number" min="0" /></label>
        <p v-if="itemError" class="form-error span-2">{{ itemError }}</p>
        <div class="modal-actions span-2"><button type="button" class="secondary-button" @click="showItemForm = false">Batal</button><button class="primary-button">Simpan Barang</button></div>
      </form>
    </UiModal>
  </div>
</template>
