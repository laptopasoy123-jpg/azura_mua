<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  Plus, Search, Shirt, ZoomIn, UploadCloud, LoaderCircle, Save, CalendarHeart,
  Ruler, UsersRound, Store, CheckCircle2, Image as ImageIcon,
} from '@lucide/vue'
import UiModal from '../components/UiModal.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { useCrmStore, type AttireCategory, type AttireStatus, type WeddingAttire, type WeddingFittingForm } from '../stores/crm'
import { formatDate, uid } from '../utils/format'

const store = useCrmStore()
const search = ref('')
const category = ref<'Semua' | AttireCategory>('Semua')
const status = ref<'Semua' | AttireStatus>('Semua')
const showAttireForm = ref(false)
const showZoom = ref(false)
const zoomedAttire = ref<WeddingAttire | null>(null)
const uploading = ref(false)
const uploadError = ref('')
const imagePreview = ref('')
const saveMessage = ref('')
const formError = ref('')

const measurementGroups = [
  { key: 'bride', label: 'Bride', fields: ['LD', 'LPinggang', 'LPanggul', 'LLenganA', 'LLenganB', 'PLengan', 'Others adj', 'Shoes'] },
  { key: 'groom', label: 'Groom', fields: ['LD', 'LLengan', 'LPerut', 'PLengan', 'PCelana', 'LKepala', 'Others adj', 'Shoes'] },
  { key: 'ibu', label: 'Ibu', fields: ['LD', 'LLengan', 'PLengan'] },
  { key: 'ayah', label: 'Ayah', fields: ['LD', 'PLengan', 'PCelana', 'LKepala', 'Slop'], required: ['LKepala', 'Slop'] },
  { key: 'kembarMayangCe', label: 'Kembar Mayang Ce', fields: ['LD', 'Slop'] },
  { key: 'kembarMayangCo', label: 'Kembar Mayang Co', fields: ['LD', 'Slop'] },
  { key: 'terimaTamu', label: 'Terima Tamu', fields: ['List LD'] },
]

const uniformFields = [
  ['domas', 'Domas'], ['manggolo', 'Manggolo'], ['ibuBesan', 'Ibu & Besan'], ['bapakBesan', 'Bapak & Besan'],
  ['terimaTamu', 'Terima Tamu'], ['softlens', 'Softlens'], ['melati', 'Melati'], ['henna', 'Henna'], ['tambahan', 'Tambahan Lain'],
] as const
const vendorFields = [
  ['deco', 'Deco'], ['doc', 'Doc'], ['wcc', 'WCC'], ['mc', 'MC'], ['tenda', 'Tenda'], ['seserahan', 'Seserahan'], ['wo', 'WO'],
] as const

const blankMeasurements = () => Object.fromEntries(measurementGroups.map((group) => [group.key, Object.fromEntries(group.fields.map((field) => [field, '']))]))
const blankForm = (bookingId = ''): WeddingFittingForm => ({
  id: uid(),
  bookingId,
  measurements: blankMeasurements(),
  events: ([1, 2, 3] as const).map((number) => ({
    number,
    name: '',
    readyTime: '',
    bride: { look: '', accessories: '', shoes: '', attireId: '' },
    groom: { look: '', accessories: '', shoes: '', attireId: '' },
  })),
  uniforms: Object.fromEntries(uniformFields.map(([key]) => [key, ''])),
  vendors: Object.fromEntries(vendorFields.map(([key]) => [key, ''])),
  updatedAt: '',
})

const fittingForm = reactive<WeddingFittingForm>(blankForm())
const attireForm = reactive({ name: '', category: 'Bride' as AttireCategory, size: '', status: 'Tersedia' as AttireStatus, notes: '', imageUrl: '' })

const filteredAttire = computed(() => store.weddingAttire.filter((item) => {
  const query = search.value.toLowerCase()
  return (!query || item.name.toLowerCase().includes(query) || item.code.toLowerCase().includes(query) || item.size.toLowerCase().includes(query))
    && (category.value === 'Semua' || item.category === category.value)
    && (status.value === 'Semua' || item.status === status.value)
}))
const availableBride = computed(() => store.weddingAttire.filter((item) => item.category === 'Bride' && item.status === 'Tersedia'))
const availableGroom = computed(() => store.weddingAttire.filter((item) => item.category === 'Groom' && item.status === 'Tersedia'))
const selectedBooking = computed(() => store.bookingFor(fittingForm.bookingId))
const selectedAttire = (id: string) => store.weddingAttire.find((item) => item.id === id)

watch(() => fittingForm.bookingId, (bookingId) => {
  saveMessage.value = ''
  formError.value = ''
  const existing = store.weddingForms.find((item) => item.bookingId === bookingId)
  const next = existing ? JSON.parse(JSON.stringify(existing)) as WeddingFittingForm : blankForm(bookingId)
  Object.assign(fittingForm, next)
})

const openZoom = (item: WeddingAttire) => {
  zoomedAttire.value = item
  showZoom.value = true
}

const handleAttirePhoto = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploadError.value = ''
  if (file.size > 5 * 1024 * 1024) { uploadError.value = 'Ukuran gambar maksimal 5 MB.'; return }
  imagePreview.value = URL.createObjectURL(file)
  const body = new FormData()
  body.append('file', file)
  body.append('purpose', 'wedding-attire')
  body.append('visibility', 'public')
  uploading.value = true
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/files`, { method: 'POST', body })
    const payload = await response.json() as { ok: boolean; data?: { url: string }; error?: { message: string } }
    if (!response.ok || !payload.ok || !payload.data) throw new Error(payload.error?.message ?? 'Upload gagal.')
    attireForm.imageUrl = payload.data.url
  } catch (error) {
    uploadError.value = error instanceof Error ? error.message : 'Upload gagal.'
  } finally { uploading.value = false }
}

const submitAttire = () => {
  if (!attireForm.name.trim() || !attireForm.size.trim()) { uploadError.value = 'Nama dan ukuran busana wajib diisi.'; return }
  store.addWeddingAttire({ ...attireForm, name: attireForm.name.trim(), size: attireForm.size.trim() })
  Object.assign(attireForm, { name: '', category: 'Bride', size: '', status: 'Tersedia', notes: '', imageUrl: '' })
  imagePreview.value = ''
  showAttireForm.value = false
}

const saveForm = () => {
  formError.value = ''
  saveMessage.value = ''
  if (!fittingForm.bookingId) { formError.value = 'Pilih Nomor PO sebelum menyimpan form fitting.'; return }
  for (const group of measurementGroups) {
    for (const required of group.required ?? []) {
      if (!fittingForm.measurements[group.key]?.[required]?.trim()) {
        formError.value = `${required} pada bagian ${group.label} wajib diisi.`
        document.getElementById('size-chart')?.scrollIntoView({ behavior: 'smooth' })
        return
      }
    }
  }
  store.saveWeddingForm(JSON.parse(JSON.stringify(fittingForm)) as WeddingFittingForm)
  saveMessage.value = 'Form fitting dan rincian busana berhasil disimpan.'
}
</script>

<template>
  <div class="page-stack wedding-page">
    <section class="page-heading">
      <div><span class="eyebrow">Workspace</span><h2>Wedding Portal</h2><p>Katalog busana, fitting, detail look, seragam keluarga, dan vendor dalam satu form.</p></div>
      <button class="primary-button" @click="showAttireForm = true"><Plus :size="18" />Tambah Busana</button>
    </section>

    <section class="panel attire-catalog-panel">
      <header class="wedding-section-head">
        <div><span class="section-number">01</span><div><span class="eyebrow">Inventory & katalog</span><h3>Busana Bride & Groom</h3><p>Pilih foto untuk memperbesar. Status menunjukkan kesiapan busana saat ini.</p></div></div>
        <div class="attire-summary"><span><i class="dot-available" />{{ store.weddingAttire.filter((item) => item.status === 'Tersedia').length }} Tersedia</span><span><i class="dot-booked" />{{ store.weddingAttire.filter((item) => item.status === 'Booked').length }} Booked</span><span><i class="dot-laundry" />{{ store.weddingAttire.filter((item) => item.status === 'Laundry').length }} Laundry</span></div>
      </header>
      <div class="attire-toolbar">
        <label class="table-search"><Search :size="17" /><input v-model="search" placeholder="Cari nama, kode, atau ukuran" /></label>
        <div class="filter-row"><select v-model="category"><option>Semua</option><option>Bride</option><option>Groom</option></select><select v-model="status"><option>Semua</option><option>Tersedia</option><option>Booked</option><option>Laundry</option></select></div>
      </div>
      <div class="attire-grid">
        <article v-for="item in filteredAttire" :key="item.id" class="attire-card">
          <button class="attire-photo" :class="`attire-${item.category.toLowerCase()}`" @click="openZoom(item)">
            <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name" loading="lazy" decoding="async" />
            <span v-else><Shirt :size="34" /><small>{{ item.category }}</small></span>
            <i><ZoomIn :size="15" />Zoom</i>
          </button>
          <div class="attire-card-body"><div><span>{{ item.code }}</span><StatusBadge :label="item.status" /></div><h4>{{ item.name }}</h4><p>{{ item.category }} · Size <strong>{{ item.size }}</strong></p><select :value="item.status" @change="store.updateWeddingAttireStatus(item.id, ($event.target as HTMLSelectElement).value as AttireStatus)"><option>Tersedia</option><option>Booked</option><option>Laundry</option></select></div>
        </article>
        <button class="attire-add-card" @click="showAttireForm = true"><Plus :size="25" /><strong>Tambah busana baru</strong><span>Upload foto dan data ukuran</span></button>
      </div>
    </section>

    <section class="booking-context panel">
      <div class="booking-context-icon"><CalendarHeart :size="23" /></div>
      <div><span class="eyebrow">Form fitting customer</span><h3>Pilih booking yang akan dilengkapi</h3><p>Semua pilihan busana dan ukuran tersimpan berdasarkan Nomor PO.</p></div>
      <label><span>Nomor PO / Customer</span><select v-model="fittingForm.bookingId"><option value="">Pilih booking</option><option v-for="booking in store.bookings" :key="booking.id" :value="booking.id">{{ booking.poNumber }} — {{ store.customerFor(booking.customerId)?.name }} — {{ formatDate(booking.eventDate) }}</option></select></label>
    </section>

    <section class="panel event-slots-panel">
      <header class="wedding-section-head"><div><span class="section-number">02</span><div><span class="eyebrow">Pilihan utama</span><h3>Baju 1, 2, dan 3</h3><p>Pilihan di sini otomatis terhubung ke rincian masing-masing acara.</p></div></div></header>
      <div class="event-slot-grid">
        <article v-for="event in fittingForm.events" :key="event.number" class="event-slot-card">
          <header><span>0{{ event.number }}</span><div><strong>Baju {{ event.number }}</strong><small>Acara {{ event.number }}</small></div><CheckCircle2 v-if="event.bride.attireId || event.groom.attireId" :size="19" /></header>
          <div class="slot-outfits">
            <label><span>Busana Bride</span><select v-model="event.bride.attireId"><option value="">Pilih dari katalog</option><option v-for="item in availableBride" :key="item.id" :value="item.id">{{ item.name }} · {{ item.size }}</option></select></label>
            <div class="selected-outfit" :class="{ empty: !event.bride.attireId }"><img v-if="selectedAttire(event.bride.attireId)?.imageUrl" :src="selectedAttire(event.bride.attireId)?.imageUrl" alt="Busana bride" loading="lazy" decoding="async" /><span v-else><Shirt :size="20" /></span><div><strong>{{ selectedAttire(event.bride.attireId)?.name ?? 'Belum dipilih' }}</strong><small>{{ selectedAttire(event.bride.attireId) ? `Size ${selectedAttire(event.bride.attireId)?.size}` : 'Foto dan ukuran otomatis tampil' }}</small></div></div>
            <label><span>Busana Groom</span><select v-model="event.groom.attireId"><option value="">Pilih dari katalog</option><option v-for="item in availableGroom" :key="item.id" :value="item.id">{{ item.name }} · {{ item.size }}</option></select></label>
            <div class="selected-outfit" :class="{ empty: !event.groom.attireId }"><img v-if="selectedAttire(event.groom.attireId)?.imageUrl" :src="selectedAttire(event.groom.attireId)?.imageUrl" alt="Busana groom" loading="lazy" decoding="async" /><span v-else><Shirt :size="20" /></span><div><strong>{{ selectedAttire(event.groom.attireId)?.name ?? 'Belum dipilih' }}</strong><small>{{ selectedAttire(event.groom.attireId) ? `Size ${selectedAttire(event.groom.attireId)?.size}` : 'Foto dan ukuran otomatis tampil' }}</small></div></div>
          </div>
        </article>
      </div>
    </section>

    <section id="size-chart" class="panel fitting-panel">
      <header class="wedding-section-head"><div><span class="section-number">03</span><div><span class="eyebrow">Blank form</span><h3>Size Chart <small>cm</small></h3><p>Isi hasil pengukuran saat fitting. Kolom bertanda * wajib.</p></div></div><Ruler :size="23" /></header>
      <div class="measurement-grid">
        <article v-for="group in measurementGroups" :key="group.key" class="measurement-card">
          <h4>{{ group.label }}</h4>
          <div><label v-for="field in group.fields" :key="field"><span>{{ field }}<b v-if="group.required?.includes(field)">*</b></span><input v-model="fittingForm.measurements[group.key]![field]" :placeholder="field === 'Shoes' || field === 'Slop' ? 'Ukuran' : '0'" /></label></div>
        </article>
      </div>
    </section>

    <section class="panel event-details-panel">
      <header class="wedding-section-head"><div><span class="section-number">04</span><div><span class="eyebrow">Detail busana per acara</span><h3>Rincian Acara 1–3</h3><p>Busana mengikuti pilihan Baju 1, 2, dan 3 di atas.</p></div></div></header>
      <div class="event-detail-list">
        <article v-for="event in fittingForm.events" :key="event.number" class="event-detail-card">
          <header><span>Acara {{ event.number }}</span><strong>{{ event.name || 'Belum diberi nama' }}</strong></header>
          <div class="event-basic-fields"><label><span>Nama Acara</span><input v-model="event.name" placeholder="Akad / Resepsi / Ngunduh Mantu" /></label><label><span>Pukul / Ready</span><input v-model="event.readyTime" type="time" /></label></div>
          <div class="couple-detail-grid">
            <section><h4>Bride</h4><label><span>Busana</span><input :value="selectedAttire(event.bride.attireId)?.name ?? ''" placeholder="Terisi dari Baju pilihan" readonly /></label><label><span>Look</span><input v-model="event.bride.look" placeholder="Detail look" /></label><label><span>Acc</span><input v-model="event.bride.accessories" placeholder="Aksesori" /></label><label><span>Shoes</span><input v-model="event.bride.shoes" placeholder="Sepatu" /></label></section>
            <section><h4>Groom</h4><label><span>Busana</span><input :value="selectedAttire(event.groom.attireId)?.name ?? ''" placeholder="Terisi dari Baju pilihan" readonly /></label><label><span>Look</span><input v-model="event.groom.look" placeholder="Detail look" /></label><label><span>Acc</span><input v-model="event.groom.accessories" placeholder="Aksesori" /></label><label><span>Shoes</span><input v-model="event.groom.shoes" placeholder="Sepatu" /></label></section>
          </div>
        </article>
      </div>
    </section>

    <div class="wedding-bottom-grid">
      <section class="panel wedding-mini-form"><header class="wedding-section-head"><div><span class="section-number">05</span><div><span class="eyebrow">Keluarga & tambahan</span><h3>Seragam dan Detail</h3></div></div><UsersRound :size="21" /></header><div class="mini-field-grid"><label v-for="([key, label]) in uniformFields" :key="key"><span>{{ label }}</span><input v-model="fittingForm.uniforms[key]" :placeholder="['domas','ibuBesan','terimaTamu'].includes(key) ? 'Warna / model / opsi hijab' : 'Detail'" /></label></div></section>
      <section class="panel wedding-mini-form"><header class="wedding-section-head"><div><span class="section-number">06</span><div><span class="eyebrow">List vendor</span><h3>Vendor Pernikahan</h3></div></div><Store :size="21" /></header><div class="mini-field-grid"><label v-for="([key, label]) in vendorFields" :key="key"><span>{{ label }}</span><input v-model="fittingForm.vendors[key]" placeholder="Nama vendor / kontak / catatan" /></label></div></section>
    </div>

    <section class="wedding-save-bar"><div><strong>{{ selectedBooking ? `${selectedBooking.poNumber} · ${store.customerFor(selectedBooking.customerId)?.name}` : 'Belum ada booking dipilih' }}</strong><span v-if="saveMessage" class="save-success">{{ saveMessage }}</span><span v-else>Simpan seluruh size chart, busana, acara, dan vendor.</span></div><p v-if="formError" class="form-error">{{ formError }}</p><button class="primary-button" @click="saveForm"><Save :size="17" />Simpan Form Fitting</button></section>

    <UiModal :open="showAttireForm" title="Tambah Busana" description="Foto disimpan melalui Cloudflare R2." wide @close="showAttireForm = false">
      <form class="form-grid" @submit.prevent="submitAttire">
        <label><span>Nama busana *</span><input v-model="attireForm.name" placeholder="Contoh: Kebaya Sekar Arum" /></label><label><span>Kategori *</span><select v-model="attireForm.category"><option>Bride</option><option>Groom</option></select></label>
        <label><span>Ukuran *</span><input v-model="attireForm.size" placeholder="S / M / L / Custom" /></label><label><span>Status *</span><select v-model="attireForm.status"><option>Tersedia</option><option>Booked</option><option>Laundry</option></select></label>
        <label class="span-2"><span>Catatan</span><textarea v-model="attireForm.notes" rows="2" placeholder="Warna, bahan, detail set, atau kondisi busana" /></label>
        <label class="span-2"><span>Foto busana</span><div class="upload-zone"><img v-if="imagePreview" :src="imagePreview" alt="Preview busana" /><div v-else><UploadCloud :size="25" /><strong>Unggah foto JPG, PNG, atau WebP</strong><span>Maksimal 5 MB</span></div><input type="file" accept="image/jpeg,image/png,image/webp" @change="handleAttirePhoto" /></div></label>
        <p v-if="uploading" class="upload-state span-2"><LoaderCircle class="spin" :size="16" />Mengunggah foto…</p><p v-if="uploadError" class="form-error span-2">{{ uploadError }}</p>
        <div class="modal-actions span-2"><button type="button" class="secondary-button" @click="showAttireForm = false">Batal</button><button class="primary-button" :disabled="uploading">Simpan Busana</button></div>
      </form>
    </UiModal>

    <UiModal :open="showZoom" title="Detail Busana" @close="showZoom = false">
      <div v-if="zoomedAttire" class="attire-zoom"><div :class="`attire-${zoomedAttire.category.toLowerCase()}`"><img v-if="zoomedAttire.imageUrl" :src="zoomedAttire.imageUrl" :alt="zoomedAttire.name" /><ImageIcon v-else :size="48" /></div><h3>{{ zoomedAttire.name }}</h3><p>{{ zoomedAttire.code }} · {{ zoomedAttire.category }} · Size {{ zoomedAttire.size }}</p><StatusBadge :label="zoomedAttire.status" /><span>{{ zoomedAttire.notes || 'Belum ada catatan busana.' }}</span></div>
    </UiModal>
  </div>
</template>
