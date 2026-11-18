<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import {
  Building2,
  ListChecks,
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
  Database,
  RefreshCw,
} from '@lucide/vue'
import { useCrmStore, type DropdownOptionGroup, type EmployeeRecord } from '../stores/crm'
import { uploadImageWithFallback } from '../utils/uploadImage'
import UiModal from '../components/UiModal.vue'

defineProps<{ section?: 'profile' | 'system' | 'users' }>()
const store = useCrmStore()

const activeTab = ref<'profile' | 'dropdown'>('profile')

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
    uploadError.value = err instanceof Error ? err.message : 'Gagal mengunggah gambar logo.'
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

// Karyawan
const newEmployee = reactive({ name: '', role: 'MUA / Tim', phone: '' })
const editingEmpId = ref('')
const editEmpDraft = reactive({ name: '', role: '', phone: '' })

const handleAddEmployee = () => {
  dropdownFeedback.value = ''
  try {
    store.addEmployee({
      name: newEmployee.name,
      role: newEmployee.role,
      phone: newEmployee.phone,
      active: true,
    })
    newEmployee.name = ''
    newEmployee.role = 'MUA / Tim'
    newEmployee.phone = ''
  } catch (err) {
    dropdownFeedback.value = err instanceof Error ? err.message : 'Gagal menambah karyawan.'
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
    dropdownFeedback.value = 'Nama karyawan tidak boleh kosong.'
    return
  }
  store.updateEmployee(emp.id, {
    name: editEmpDraft.name,
    role: editEmpDraft.role || 'MUA / Tim',
    phone: editEmpDraft.phone,
  })
  editingEmpId.value = ''
}

// Generic dropdown groups
const newOptionInput = reactive<Record<DropdownOptionGroup, string>>({
  paymentMethods: '',
  poExpenseCategories: '',
  generalExpenseCategories: '',
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
    dropdownFeedback.value = err instanceof Error ? err.message : 'Gagal menambah opsi.'
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
    dropdownFeedback.value = err instanceof Error ? err.message : 'Gagal mengubah opsi.'
  }
}

const handleRemoveOption = (group: DropdownOptionGroup, label: string) => {
  dropdownFeedback.value = ''
  try {
    store.removeDropdownOption(group, label)
  } catch (err) {
    dropdownFeedback.value = err instanceof Error ? err.message : 'Gagal menghapus opsi.'
  }
}

const syncFeedback = ref('')

const handlePullFromDb = async () => {
  syncFeedback.value = ''
  const pulled = await store.refreshFromDatabase()
  syncFeedback.value = store.dbSyncState.lastError
    ? `Gagal: ${store.dbSyncState.lastError}`
    : (pulled
        ? 'Seluruh data terbaru berhasil ditarik langsung dari Supabase.'
        : 'Terhubung ke Supabase. Saat ini seluruh tabel di database masih kosong (0 baris).')
}

const handlePushToDb = async () => {
  syncFeedback.value = ''
  try {
    await store.syncLocalDataToDatabase()
    syncFeedback.value = 'Seluruh data saat ini berhasil disimpan ke database Supabase.'
  } catch (err) {
    syncFeedback.value = err instanceof Error ? err.message : 'Gagal mengirim data ke Supabase.'
  }
}
</script>

<template>
  <div class="page-stack">
    <section class="page-heading">
      <div>
        <span class="eyebrow">Pengaturan</span>
        <h2>{{ activeTab === 'profile' ? 'Profil Bisnis' : 'Pengaturan Dropdown & Tim' }}</h2>
        <p>Kelola identitas usaha, logo dokumen, daftar karyawan, metode pembayaran, dan kategori pengeluaran.</p>
      </div>
      <div class="heading-actions">
        <div class="segmented-tabs">
          <button type="button" :class="{ active: activeTab === 'profile' }" @click="activeTab = 'profile'">
            <Building2 :size="15" />Profil Bisnis
          </button>
          <button type="button" :class="{ active: activeTab === 'dropdown' }" @click="activeTab = 'dropdown'">
            <ListChecks :size="15" />Pengaturan Dropdown
          </button>
        </div>
        <button v-if="activeTab === 'profile'" type="button" class="primary-button" :disabled="uploadingLogo" @click="saveProfile">
          <Save :size="17" />Simpan Perubahan
        </button>
      </div>
    </section>

    <section v-if="activeTab === 'profile'" class="settings-layout">
      <article class="panel settings-card">
        <header>
          <span class="settings-icon"><Building2 :size="21" /></span>
          <div>
            <h3>Identitas &amp; Logo Bisnis</h3>
            <p>Digunakan pada header aplikasi web, dokumen invoice, serta bukti kwitansi pembayaran.</p>
          </div>
        </header>

        <div class="form-grid">
          <div class="span-2 attire-upload-block">
            <span class="upload-field-label">Upload Logo Bisnis (Tampil di Web, Invoice &amp; Kwitansi)</span>
            <label class="upload-zone logo-upload-zone">
              <img v-if="profileForm.logoUrl" :src="profileForm.logoUrl" alt="Logo bisnis" class="uploaded-logo-preview" />
              <div v-else>
                <UploadCloud :size="24" />
                <strong>Unggah logo JPG, PNG (transparan), atau WebP</strong>
                <span>Disarankan rasio persegi · Maksimal 5 MB</span>
              </div>
              <input type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" @change="handleLogoUpload" />
            </label>
            <div v-if="profileForm.logoUrl" class="logo-upload-actions">
              <button type="button" class="soft-button remove-photo-btn" @click="removeLogo">
                <Trash2 :size="14" />Hapus Logo &amp; Gunakan Monogram Default
              </button>
            </div>
            <p v-if="uploadingLogo" class="upload-state"><LoaderCircle class="spin" :size="15" />Memproses logo…</p>
            <p v-if="uploadError" class="form-error">{{ uploadError }}</p>
          </div>

          <label><span>Nama brand / bisnis *</span><input v-model="profileForm.name" placeholder="Contoh: AZURA" /></label>
          <label><span>Subjudul / Tagline</span><input v-model="profileForm.tagline" placeholder="Contoh: MAKEUP ARTIST" /></label>
          <label><span>Telepon / WhatsApp</span><input v-model="profileForm.phone" placeholder="08xxxxxxxxxx" /></label>
          <label><span>Email</span><input v-model="profileForm.email" type="email" placeholder="hello@azuramakeup.id" /></label>
          <label class="span-2"><span>Alamat studio</span><textarea v-model="profileForm.address" rows="2" /></label>
          <label class="span-2"><span>Catatan kaki invoice &amp; kwitansi</span><textarea v-model="profileForm.invoiceNote" rows="2" /></label>
        </div>
      </article>

      <aside class="panel brand-preview">
        <span class="eyebrow">Preview Identitas Web &amp; Dokumen</span>
        <div class="preview-logo" :class="{ 'has-custom-logo': Boolean(profileForm.logoUrl) }">
          <img v-if="profileForm.logoUrl" :src="profileForm.logoUrl" :alt="profileForm.name" />
          <template v-else>{{ (profileForm.name || 'A').slice(0, 1).toUpperCase() }}</template>
        </div>
        <h3>{{ profileForm.name || 'AZURA' }}</h3>
        <small class="brand-preview-tagline">{{ profileForm.tagline || 'MAKEUP ARTIST' }}</small>
        <p>{{ profileForm.address }}</p>
        <span>{{ profileForm.phone }} · {{ profileForm.email }}</span>

        <div class="db-sync-box">
          <div class="db-sync-head">
            <Database :size="15" />
            <strong>Database Supabase</strong>
            <span class="db-sync-pill" :class="store.dbSyncState.connected ? 'is-online' : 'is-offline'">
              {{ store.dbSyncState.syncing ? 'Sinkronisasi…' : (store.dbSyncState.connected ? 'Terhubung' : 'Lokal') }}
            </span>
          </div>
          <small v-if="store.dbSyncState.lastSyncedAt" class="db-sync-time">
            Sinkron terakhir: {{ new Date(store.dbSyncState.lastSyncedAt).toLocaleTimeString('id-ID') }}
          </small>
          <p v-if="syncFeedback || store.dbSyncState.lastError" class="db-sync-msg">
            {{ syncFeedback || store.dbSyncState.lastError }}
          </p>
          <div class="db-sync-actions">
            <button type="button" class="primary-button" :disabled="store.dbSyncState.syncing" @click="handlePullFromDb">
              <RefreshCw :size="14" :class="{ spin: store.dbSyncState.syncing }" />Tarik Ulang dari Supabase
            </button>
          </div>
        </div>
      </aside>
    </section>

    <section v-else class="dropdown-settings-grid">
      <p v-if="dropdownFeedback" class="form-error dropdown-feedback-banner" role="alert">{{ dropdownFeedback }}</p>

      <!-- Card 1: Nama Karyawan -->
      <article class="panel settings-card dropdown-setting-card">
        <header>
          <span class="settings-icon"><Users :size="20" /></span>
          <div>
            <h3>Daftar Nama Karyawan</h3>
            <p>Muncul pada dropdown &amp; pilihan Penugasan Job Karyawan.</p>
          </div>
        </header>

        <form class="dropdown-add-row dropdown-add-employee" @submit.prevent="handleAddEmployee">
          <input v-model="newEmployee.name" placeholder="Nama karyawan *" />
          <input v-model="newEmployee.role" placeholder="Jabatan / peran" />
          <button type="submit" class="primary-button"><Plus :size="15" />Tambah</button>
        </form>

        <ul class="dropdown-option-list">
          <li v-for="emp in store.employees" :key="emp.id" class="dropdown-option-row" :class="{ 'is-inactive': !emp.active }">
            <template v-if="editingEmpId === emp.id">
              <div class="dropdown-edit-inline">
                <input v-model="editEmpDraft.name" placeholder="Nama karyawan" />
                <input v-model="editEmpDraft.role" placeholder="Jabatan" />
              </div>
              <div class="action-row">
                <button type="button" class="icon-button" title="Simpan" @click="saveEditEmployee(emp)"><Check :size="15" /></button>
                <button type="button" class="icon-button" title="Batal" @click="editingEmpId = ''"><X :size="15" /></button>
              </div>
            </template>
            <template v-else>
              <div class="dropdown-option-label">
                <strong>{{ emp.name }}</strong>
                <small>{{ emp.role }} · {{ emp.active ? 'Aktif' : 'Nonaktif' }}</small>
              </div>
              <div class="action-row">
                <button type="button" class="soft-button" @click="store.toggleEmployeeStatus(emp.id)">
                  {{ emp.active ? 'Nonaktifkan' : 'Aktifkan' }}
                </button>
                <button type="button" class="icon-button" title="Ubah nama karyawan" @click="startEditEmployee(emp)">
                  <Pencil :size="14" />
                </button>
              </div>
            </template>
          </li>
        </ul>
      </article>

      <!-- Card 2: Metode Pembayaran -->
      <article class="panel settings-card dropdown-setting-card">
        <header>
          <span class="settings-icon"><WalletCards :size="20" /></span>
          <div>
            <h3>Metode Pembayaran</h3>
            <p>Digunakan pada Pembayaran, Refund Pelanggan, dan Pengeluaran.</p>
          </div>
        </header>

        <form class="dropdown-add-row" @submit.prevent="handleAddOption('paymentMethods')">
          <input v-model="newOptionInput.paymentMethods" placeholder="Tambah metode, mis. Debit BCA / EDC" />
          <button type="submit" class="primary-button"><Plus :size="15" />Tambah</button>
        </form>

        <ul class="dropdown-option-list">
          <li v-for="item in store.paymentMethods" :key="item" class="dropdown-option-row">
            <template v-if="editingOption.group === 'paymentMethods' && editingOption.oldLabel === item">
              <div class="dropdown-edit-inline">
                <input v-model="editingOption.draft" placeholder="Nama metode" />
              </div>
              <div class="action-row">
                <button type="button" class="icon-button" title="Simpan" @click="saveEditOption"><Check :size="15" /></button>
                <button type="button" class="icon-button" title="Batal" @click="editingOption.group = ''"><X :size="15" /></button>
              </div>
            </template>
            <template v-else>
              <div class="dropdown-option-label"><strong>{{ item }}</strong></div>
              <div class="action-row">
                <button type="button" class="icon-button" title="Ubah metode" @click="startEditOption('paymentMethods', item)"><Pencil :size="14" /></button>
                <button type="button" class="icon-button danger-icon-btn" title="Hapus metode" @click="handleRemoveOption('paymentMethods', item)"><Trash2 :size="14" /></button>
              </div>
            </template>
          </li>
        </ul>
      </article>

      <!-- Card 3: Kategori Pengeluaran Berdasarkan PO -->
      <article class="panel settings-card dropdown-setting-card">
        <header>
          <span class="settings-icon"><Receipt :size="20" /></span>
          <div>
            <h3>Kategori Pengeluaran (Berdasarkan PO)</h3>
            <p>Muncul saat mencatat pengeluaran yang terhubung ke Nomor PO.</p>
          </div>
        </header>

        <form class="dropdown-add-row" @submit.prevent="handleAddOption('poExpenseCategories')">
          <input v-model="newOptionInput.poExpenseCategories" placeholder="Mis. Fee Freelancer / Bunga Segar" />
          <button type="submit" class="primary-button"><Plus :size="15" />Tambah</button>
        </form>

        <ul class="dropdown-option-list">
          <li v-for="item in store.poExpenseCategories" :key="item" class="dropdown-option-row">
            <template v-if="editingOption.group === 'poExpenseCategories' && editingOption.oldLabel === item">
              <div class="dropdown-edit-inline">
                <input v-model="editingOption.draft" placeholder="Nama kategori PO" />
              </div>
              <div class="action-row">
                <button type="button" class="icon-button" title="Simpan" @click="saveEditOption"><Check :size="15" /></button>
                <button type="button" class="icon-button" title="Batal" @click="editingOption.group = ''"><X :size="15" /></button>
              </div>
            </template>
            <template v-else>
              <div class="dropdown-option-label"><strong>{{ item }}</strong></div>
              <div class="action-row">
                <button type="button" class="icon-button" title="Ubah kategori" @click="startEditOption('poExpenseCategories', item)"><Pencil :size="14" /></button>
                <button type="button" class="icon-button danger-icon-btn" title="Hapus kategori" @click="handleRemoveOption('poExpenseCategories', item)"><Trash2 :size="14" /></button>
              </div>
            </template>
          </li>
        </ul>
      </article>

      <!-- Card 4: Kategori Pengeluaran Umum (Di Luar PO) -->
      <article class="panel settings-card dropdown-setting-card">
        <header>
          <span class="settings-icon"><Receipt :size="20" /></span>
          <div>
            <h3>Kategori Pengeluaran Umum (Di Luar PO)</h3>
            <p>Muncul saat mencatat pengeluaran operasional studio di luar PO.</p>
          </div>
        </header>

        <form class="dropdown-add-row" @submit.prevent="handleAddOption('generalExpenseCategories')">
          <input v-model="newOptionInput.generalExpenseCategories" placeholder="Mis. Sewa Studio / Listrik &amp; Air" />
          <button type="submit" class="primary-button"><Plus :size="15" />Tambah</button>
        </form>

        <ul class="dropdown-option-list">
          <li v-for="item in store.generalExpenseCategories" :key="item" class="dropdown-option-row">
            <template v-if="editingOption.group === 'generalExpenseCategories' && editingOption.oldLabel === item">
              <div class="dropdown-edit-inline">
                <input v-model="editingOption.draft" placeholder="Nama kategori umum" />
              </div>
              <div class="action-row">
                <button type="button" class="icon-button" title="Simpan" @click="saveEditOption"><Check :size="15" /></button>
                <button type="button" class="icon-button" title="Batal" @click="editingOption.group = ''"><X :size="15" /></button>
              </div>
            </template>
            <template v-else>
              <div class="dropdown-option-label"><strong>{{ item }}</strong></div>
              <div class="action-row">
                <button type="button" class="icon-button" title="Ubah kategori" @click="startEditOption('generalExpenseCategories', item)"><Pencil :size="14" /></button>
                <button type="button" class="icon-button danger-icon-btn" title="Hapus kategori" @click="handleRemoveOption('generalExpenseCategories', item)"><Trash2 :size="14" /></button>
              </div>
            </template>
          </li>
        </ul>
      </article>
    </section>

    <UiModal :open="showSaved" title="Profil Bisnis Tersimpan" description="Identitas dan logo berhasil diterapkan ke tampilan web, invoice, serta kwitansi." @close="showSaved = false">
      <div class="modal-actions"><button class="primary-button" @click="showSaved = false">Selesai</button></div>
    </UiModal>
  </div>
</template>
