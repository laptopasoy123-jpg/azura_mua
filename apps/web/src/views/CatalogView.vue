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
const activeTab = ref<'All' | CatalogType>('All')
const search = ref('')
const showForm = ref(false)
const showChoice = ref(false)
const editingId = ref('')
const selectedItem = ref<CatalogItem | null>(null)
const uploading = ref(false)
const uploadError = ref('')
const imagePreview = ref('')
const form = reactive({ name: '', type: 'Inti' as CatalogType, description: '', price: 0, unit: 'paket', imageUrl: '' })

const items = computed(() => store.catalog.filter((item) => {
  const matchesTab = activeTab.value === 'All' || item.type === activeTab.value
  return matchesTab && item.name.toLowerCase().includes(search.value.toLowerCase())
}))

const resetForm = () => {
  Object.assign(form, { name: '', type: 'Inti', description: '', price: 0, unit: store.units[0] ?? 'paket', imageUrl: '' })
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
    uploadError.value = error instanceof Error ? error.message : 'Upload failed.'
  } finally {
    uploading.value = false
    inputEl.value = ''
  }
}

const submit = () => {
  uploadError.value = ''
  if (!form.name.trim() || !form.description.trim() || form.price <= 0) {
    uploadError.value = 'Service name, description, and catalog price are required.'
    return
  }
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
      <div><span class="eyebrow">Workspace</span><h2>Service Catalog</h2><p>Reference pricing for core packages and add-on services. Order line prices can still be customized per booking.</p></div>
      <button class="primary-button" @click="openCreate"><Plus :size="18" />Add Service</button>
    </section>
    <section class="catalog-toolbar">
      <div class="segmented-tabs">
        <button v-for="tab in ['All', 'Inti', 'Additional'] as const" :key="tab" :class="{ active: activeTab === tab }" @click="activeTab = tab">
          {{ tab === 'All' ? 'All Services' : tab === 'Inti' ? 'Core Services' : 'Add-on Services' }}
        </button>
      </div>
      <label class="table-search"><Search :size="17" /><input v-model="search" placeholder="Search services" /></label>
    </section>
    <section class="catalog-grid">
      <article v-for="item in items" :key="item.id" class="service-card">
        <div class="service-image" :class="`service-${item.type.toLowerCase()}`">
          <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name" loading="lazy" decoding="async" />
          <div v-else><ImageIcon :size="27" /><span>{{ item.type === 'Inti' ? 'Core' : 'Add-on' }}</span></div>
          <StatusBadge :label="item.active ? 'Active' : 'Inactive'" />
        </div>
        <div class="service-body">
          <div class="service-title">
            <div><span>{{ item.code }} · {{ item.type === 'Inti' ? 'Core Service' : 'Add-on' }}</span><h3>{{ item.name }}</h3></div>
            <button class="icon-button" title="Edit service" @click="openEdit(item)"><Pencil :size="16" /></button>
          </div>
          <p>{{ item.description }}</p>
          <div class="service-price"><div><span>Catalog Price</span><strong>{{ formatCurrency(item.price) }}</strong></div><span>/ {{ item.unit }}</span></div>
          <button class="outline-button" @click="chooseItem(item)"><Check :size="16" />Select Service</button>
        </div>
      </article>
    </section>

    <UiModal :open="showForm" :title="editingId ? 'Edit Service' : 'Add Service'" description="Catalog details act as quick presets when building customer orders." wide @close="showForm = false">
      <form class="form-grid" @submit.prevent="submit">
        <label><span>Service Name *</span><input v-model="form.name" placeholder="e.g. Bridesmaid Makeup" required /></label>
        <label><span>Catalog Type *</span><select v-model="form.type"><option value="Inti">Core Service</option><option value="Additional">Add-on Service</option></select></label>
        <label class="span-2"><span>Description *</span><textarea v-model="form.description" rows="3" required /></label>
        <label><span>Catalog Price *</span><CurrencyInput v-model="form.price" placeholder="250.000" aria-label="Catalog price" /></label>
        <label>
          <span>Unit *</span>
          <select v-model="form.unit">
            <option v-for="u in store.units" :key="u" :value="u">{{ u }}</option>
            <option v-if="form.unit && !store.units.includes(form.unit)" :value="form.unit">{{ form.unit }}</option>
          </select>
        </label>
        <label class="span-2"><span>Service Image</span><div class="upload-zone"><img v-if="imagePreview" :src="imagePreview" alt="Preview" /><div v-else><UploadCloud :size="25" /><strong>Upload JPG, PNG, or WebP</strong><span>Max 5 MB</span></div><input type="file" accept="image/jpeg,image/png,image/webp" @change="handleFile" /></div></label>
        <p v-if="uploading" class="upload-state span-2"><LoaderCircle class="spin" :size="16" />Uploading image…</p>
        <p v-if="uploadError" class="form-error span-2">{{ uploadError }}</p>
        <div class="modal-actions span-2"><button type="button" class="secondary-button" @click="showForm = false">Cancel</button><button class="primary-button" :disabled="uploading">{{ editingId ? 'Save Changes' : 'Save Service' }}</button></div>
      </form>
    </UiModal>

    <UiModal :open="showChoice" title="Use Service" description="Continue with the selected service into a customer PO order." @close="showChoice = false">
      <div v-if="selectedItem" class="selection-summary"><span>{{ selectedItem.code }} · {{ selectedItem.type === 'Inti' ? 'Core Service' : 'Add-on' }}</span><strong>{{ selectedItem.name }}</strong><p>{{ selectedItem.description }}</p><b>{{ formatCurrency(selectedItem.price) }} / {{ selectedItem.unit }}</b></div>
      <div class="modal-actions"><button class="secondary-button" @click="showChoice = false">Cancel</button><button class="primary-button" @click="continueToOrder">Continue to Orders</button></div>
    </UiModal>
  </div>
</template>
