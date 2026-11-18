<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { Plus, Search, Image as ImageIcon, Pencil, Check, UploadCloud, LoaderCircle } from '@lucide/vue'
import { useRouter } from 'vue-router'
import { useCrmStore, type CatalogItem, type CatalogType } from '../stores/crm'
import { formatCurrency } from '../utils/format'
import { uploadImageWithFallback } from '../utils/uploadImage'
import StatusBadge from '../components/StatusBadge.vue'
import UiModal from '../components/UiModal.vue'
import CurrencyInput from '../components/CurrencyInput.vue'

const store = useCrmStore()
const router = useRouter()
const activeTab = ref<'Semua' | CatalogType>('Semua')
const search = ref('')
const showForm = ref(false)
const showChoice = ref(false)
const editingId = ref('')
const selectedItem = ref<CatalogItem | null>(null)
const uploading = ref(false)
const uploadError = ref('')
const imagePreview = ref('')
const form = reactive({ name: '', type: 'Inti' as CatalogType, description: '', price: 0, unit: 'orang', imageUrl: '' })

const items = computed(() => store.catalog.filter((item) => {
  const matchesTab = activeTab.value === 'Semua' || item.type === activeTab.value
  return matchesTab && item.name.toLowerCase().includes(search.value.toLowerCase())
}))

const resetForm = () => {
  Object.assign(form, { name: '', type: 'Inti', description: '', price: 0, unit: 'orang', imageUrl: '' })
  imagePreview.value = ''
  uploadError.value = ''
}
const openCreate = () => { editingId.value = ''; resetForm(); showForm.value = true }
const openEdit = (item: CatalogItem) => {
  editingId.value = item.id
  Object.assign(form, { name: item.name, type: item.type, description: item.description, price: item.price, unit: item.unit, imageUrl: item.imageUrl ?? '' })
  imagePreview.value = item.imageUrl ?? ''
  uploadError.value = ''
  showForm.value = true
}
const chooseItem = (item: CatalogItem) => { selectedItem.value = item; showChoice.value = true }
const continueToOrder = () => {
  if (!selectedItem.value) return
  const path = selectedItem.value.type === 'Additional' ? '/additional' : '/orders'
  showChoice.value = false
  router.push({ path, query: { catalog: selectedItem.value.id } })
}

const handleFile = async (event: Event) => {
  const inputEl = event.target as HTMLInputElement
  const file = inputEl.files?.[0]
  if (!file) return
  uploadError.value = ''
  uploading.value = true
  try {
    const result = await uploadImageWithFallback(file, 'catalog')
    form.imageUrl = result.url
    imagePreview.value = result.url
  } catch (error) {
    uploadError.value = error instanceof Error ? error.message : 'Upload gagal.'
  } finally {
    uploading.value = false
    inputEl.value = ''
  }
}

const submit = () => {
  uploadError.value = ''
  if (!form.name.trim() || !form.description.trim() || form.price <= 0) { uploadError.value = 'Nama, deskripsi, dan harga layanan wajib diisi.'; return }
  const payload = { ...form, active: true }
  if (editingId.value) store.updateCatalogItem(editingId.value, payload)
  else store.addCatalogItem(payload)
  resetForm()
  showForm.value = false
}
</script>

<template>
  <div class="page-stack">
    <section class="page-heading">
      <div><span class="eyebrow">Ruang Kerja</span><h2>Katalog Jasa</h2><p>Harga acuan layanan inti dan layanan tambahan. Harga transaksi tetap dapat disesuaikan.</p></div>
      <button class="primary-button" @click="openCreate"><Plus :size="18" />Tambah Layanan</button>
    </section>
    <section class="catalog-toolbar">
      <div class="segmented-tabs"><button v-for="tab in ['Semua', 'Inti', 'Additional'] as const" :key="tab" :class="{ active: activeTab === tab }" @click="activeTab = tab">{{ tab === 'Semua' ? 'Semua Layanan' : tab === 'Inti' ? 'Layanan Inti' : 'Layanan Tambahan' }}</button></div>
      <label class="table-search"><Search :size="17" /><input v-model="search" placeholder="Cari layanan" /></label>
    </section>
    <section class="catalog-grid">
      <article v-for="item in items" :key="item.id" class="service-card">
        <div class="service-image" :class="`service-${item.type.toLowerCase()}`">
          <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name" loading="lazy" decoding="async" />
          <div v-else><ImageIcon :size="27" /><span>{{ item.type }}</span></div>
          <StatusBadge :label="item.active ? 'Aktif' : 'Nonaktif'" />
        </div>
        <div class="service-body"><div class="service-title"><div><span>{{ item.code }} · {{ item.type }}</span><h3>{{ item.name }}</h3></div><button class="icon-button" title="Edit layanan" @click="openEdit(item)"><Pencil :size="16" /></button></div><p>{{ item.description }}</p><div class="service-price"><div><span>Harga katalog</span><strong>{{ formatCurrency(item.price) }}</strong></div><span>/ {{ item.unit }}</span></div><button class="outline-button" @click="chooseItem(item)"><Check :size="16" />Pilih Layanan</button></div>
      </article>
    </section>

    <UiModal :open="showForm" :title="editingId ? 'Edit Layanan' : 'Tambah Layanan'" description="Informasi ini menjadi referensi saat membuat pesanan." wide @close="showForm = false">
      <form class="form-grid" @submit.prevent="submit">
        <label><span>Nama layanan *</span><input v-model="form.name" placeholder="Contoh: Makeup Bridesmaid" required /></label>
        <label><span>Jenis katalog *</span><select v-model="form.type"><option>Inti</option><option>Additional</option></select></label>
        <label class="span-2"><span>Deskripsi *</span><textarea v-model="form.description" rows="3" required /></label>
        <label><span>Harga katalog *</span><CurrencyInput v-model="form.price" placeholder="250.000" aria-label="Harga katalog" /></label>
        <label><span>Satuan *</span><input v-model="form.unit" placeholder="orang / sesi" /></label>
        <label class="span-2"><span>Gambar layanan</span><div class="upload-zone"><img v-if="imagePreview" :src="imagePreview" alt="Preview" /><div v-else><UploadCloud :size="25" /><strong>Unggah JPG, PNG, atau WebP</strong><span>Maksimal 5 MB · disimpan di R2 lokal</span></div><input type="file" accept="image/jpeg,image/png,image/webp" @change="handleFile" /></div></label>
        <p v-if="uploading" class="upload-state span-2"><LoaderCircle class="spin" :size="16" />Mengunggah ke R2 lokal…</p>
        <p v-if="uploadError" class="form-error span-2">{{ uploadError }}</p>
        <div class="modal-actions span-2"><button type="button" class="secondary-button" @click="showForm = false">Batal</button><button class="primary-button" :disabled="uploading">{{ editingId ? 'Simpan Perubahan' : 'Simpan Layanan' }}</button></div>
      </form>
    </UiModal>

    <UiModal :open="showChoice" title="Gunakan Layanan" description="Lanjutkan layanan terpilih ke pesanan customer." @close="showChoice = false">
      <div v-if="selectedItem" class="selection-summary"><span>{{ selectedItem.code }} · {{ selectedItem.type }}</span><strong>{{ selectedItem.name }}</strong><p>{{ selectedItem.description }}</p><b>{{ formatCurrency(selectedItem.price) }} / {{ selectedItem.unit }}</b></div>
      <div class="modal-actions"><button class="secondary-button" @click="showChoice = false">Batal</button><button class="primary-button" @click="continueToOrder">Lanjut ke Pesanan</button></div>
    </UiModal>
  </div>
</template>
