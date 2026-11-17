<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { Building2, Settings, UsersRound, Save, ShieldCheck, Mail, MoreVertical, RotateCcw } from '@lucide/vue'
import { useCrmStore } from '../stores/crm'
import StatusBadge from '../components/StatusBadge.vue'
import UiModal from '../components/UiModal.vue'

const props = defineProps<{ section: 'profile' | 'system' | 'users' }>()
const store = useCrmStore()
const business = reactive({ name: 'Azura Makeup Studio', phone: '0812 9000 2026', email: 'hello@azuramakeup.id', address: 'Jakarta Selatan, DKI Jakarta', tax: '', invoiceNote: 'Terima kasih telah mempercayakan momen spesial Anda kepada Azura Makeup Studio.' })
const system = reactive({ poPrefix: 'PO', invoicePrefix: 'INV', receiptPrefix: 'KWT', currency: 'IDR — Rupiah', timezone: 'Asia/Bangkok (UTC+7)', language: 'Bahasa Indonesia' })
const showSaved = ref(false)
const showUserForm = ref(false)
const showUserAction = ref(false)
const showReset = ref(false)
const userError = ref('')
type UserRow = { name: string; email: string; role: string; status: 'Aktif' | 'Nonaktif'; last: string }
const selectedUser = ref<UserRow | null>(null)
const userForm = reactive({ name: '', email: '', role: 'Viewer' })
const meta = computed(() => ({
  profile: { title: 'Profil Bisnis', description: 'Identitas yang tampil pada invoice dan kwitansi.', icon: Building2 },
  system: { title: 'Pengaturan Sistem', description: 'Atur nomor dokumen, locale, dan perilaku aplikasi.', icon: Settings },
  users: { title: 'Pengguna & Hak Akses', description: 'Kelola admin dan kewenangan setiap peran.', icon: UsersRound },
})[props.section])

const users = reactive<UserRow[]>([
  { name: 'Aura Rahma', email: 'aura@azuramakeup.id', role: 'Owner', status: 'Aktif', last: 'Hari ini, 14:22' },
  { name: 'Nisa Amalia', email: 'nisa@azuramakeup.id', role: 'Finance', status: 'Aktif', last: 'Kemarin, 18:04' },
  { name: 'Rani Putri', email: 'rani@azuramakeup.id', role: 'Inventory', status: 'Aktif', last: '13 Nov 2026' },
])

const saveSettings = () => { showSaved.value = true }
const openUserForm = () => { Object.assign(userForm, { name: '', email: '', role: 'Viewer' }); userError.value = ''; showUserForm.value = true }
const submitUser = () => {
  userError.value = ''
  if (!userForm.name.trim() || !userForm.email.trim()) { userError.value = 'Nama dan email pengguna wajib diisi.'; return }
  if (users.some((user) => user.email.toLowerCase() === userForm.email.toLowerCase())) { userError.value = 'Email tersebut sudah terdaftar.'; return }
  users.push({ ...userForm, status: 'Aktif', last: 'Belum pernah login' })
  showUserForm.value = false
}
const openUserAction = (user: UserRow) => { selectedUser.value = user; showUserAction.value = true }
const toggleUser = () => {
  if (!selectedUser.value) return
  selectedUser.value.status = selectedUser.value.status === 'Aktif' ? 'Nonaktif' : 'Aktif'
  showUserAction.value = false
}
const confirmReset = () => { store.resetDemo(); showReset.value = false; showSaved.value = true }
</script>

<template>
  <div class="page-stack">
    <section class="page-heading"><div><span class="eyebrow">Pengaturan</span><h2>{{ meta.title }}</h2><p>{{ meta.description }}</p></div><button v-if="section !== 'users'" class="primary-button" @click="saveSettings"><Save :size="17" />Simpan Perubahan</button><button v-else class="primary-button" @click="openUserForm"><UsersRound :size="17" />Tambah Pengguna</button></section>
    <template v-if="section === 'profile'">
      <section class="settings-layout"><article class="panel settings-card"><header><span class="settings-icon"><Building2 :size="21" /></span><div><h3>Identitas bisnis</h3><p>Digunakan pada dokumen customer.</p></div></header><div class="form-grid"><label class="span-2"><span>Nama bisnis</span><input v-model="business.name" /></label><label><span>Telepon</span><input v-model="business.phone" /></label><label><span>Email</span><input v-model="business.email" /></label><label class="span-2"><span>Alamat</span><textarea v-model="business.address" rows="3" /></label><label class="span-2"><span>Catatan invoice</span><textarea v-model="business.invoiceNote" rows="3" /></label></div></article><aside class="panel brand-preview"><span class="eyebrow">Preview identitas</span><div class="preview-logo">A</div><h3>{{ business.name }}</h3><p>{{ business.address }}</p><span>{{ business.phone }} · {{ business.email }}</span></aside></section>
    </template>
    <template v-else-if="section === 'system'">
      <section class="settings-layout"><article class="panel settings-card"><header><span class="settings-icon"><Settings :size="21" /></span><div><h3>Nomor dan regional</h3><p>Format kode bisnis dan tampilan nilai.</p></div></header><div class="form-grid"><label><span>Prefix Nomor PO</span><input v-model="system.poPrefix" /></label><label><span>Prefix Invoice</span><input v-model="system.invoicePrefix" /></label><label><span>Prefix Kwitansi</span><input v-model="system.receiptPrefix" /></label><label><span>Mata uang</span><select v-model="system.currency"><option>IDR — Rupiah</option></select></label><label><span>Zona waktu</span><select v-model="system.timezone"><option>Asia/Bangkok (UTC+7)</option></select></label><label><span>Bahasa</span><select v-model="system.language"><option>Bahasa Indonesia</option></select></label></div></article><aside class="panel danger-card"><RotateCcw :size="23" /><h3>Reset data demo</h3><p>Mengembalikan seluruh data simulasi ke kondisi awal. Tidak memengaruhi Supabase atau R2 production.</p><button class="danger-button" @click="showReset = true">Reset Data Demo</button></aside></section>
    </template>
    <template v-else>
      <section class="permission-note"><ShieldCheck :size="20" /><div><strong>Role-based access control</strong><p>Owner mempunyai seluruh akses. Finance, Inventory, dan Viewer dibatasi sesuai modul.</p></div></section>
      <section class="panel table-panel"><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Pengguna</th><th>Peran</th><th>Status</th><th>Login terakhir</th><th>Aksi</th></tr></thead><tbody><tr v-for="user in users" :key="user.email"><td><div class="customer-cell"><div class="avatar">{{ user.name.slice(0, 2).toUpperCase() }}</div><div><strong>{{ user.name }}</strong><span><Mail :size="12" />{{ user.email }}</span></div></div></td><td><span class="role-chip">{{ user.role }}</span></td><td><StatusBadge :label="user.status" /></td><td>{{ user.last }}</td><td><button class="icon-button" title="Kelola pengguna" @click="openUserAction(user)"><MoreVertical :size="17" /></button></td></tr></tbody></table></div></section>
    </template>

    <UiModal :open="showSaved" title="Perubahan Tersimpan" description="Data pengaturan berhasil diperbarui." @close="showSaved = false">
      <div class="modal-actions"><button class="primary-button" @click="showSaved = false">Selesai</button></div>
    </UiModal>

    <UiModal :open="showUserForm" title="Tambah Pengguna" description="Buat akses baru dan tentukan perannya." @close="showUserForm = false">
      <form class="form-grid" @submit.prevent="submitUser">
        <label class="span-2"><span>Nama lengkap *</span><input v-model="userForm.name" /></label>
        <label class="span-2"><span>Email *</span><input v-model="userForm.email" type="email" /></label>
        <label class="span-2"><span>Peran</span><select v-model="userForm.role"><option>Owner</option><option>Finance</option><option>Inventory</option><option>Viewer</option></select></label>
        <p v-if="userError" class="form-error span-2">{{ userError }}</p>
        <div class="modal-actions span-2"><button type="button" class="secondary-button" @click="showUserForm = false">Batal</button><button class="primary-button">Tambah Pengguna</button></div>
      </form>
    </UiModal>

    <UiModal :open="showUserAction" title="Kelola Pengguna" description="Ubah peran atau status akses pengguna." @close="showUserAction = false">
      <div v-if="selectedUser" class="form-grid">
        <label class="span-2"><span>Nama</span><input :value="selectedUser.name" readonly /></label>
        <label class="span-2"><span>Peran</span><select v-model="selectedUser.role"><option>Owner</option><option>Finance</option><option>Inventory</option><option>Viewer</option></select></label>
      </div>
      <div class="modal-actions"><button class="secondary-button" @click="showUserAction = false">Tutup</button><button class="danger-button" @click="toggleUser">{{ selectedUser?.status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan' }} Pengguna</button></div>
    </UiModal>

    <UiModal :open="showReset" title="Reset Data Demo?" description="Seluruh perubahan data lokal akan dikembalikan ke kondisi awal." @close="showReset = false">
      <div class="modal-actions"><button class="secondary-button" @click="showReset = false">Batal</button><button class="danger-button" @click="confirmReset">Ya, Reset Data</button></div>
    </UiModal>
  </div>
</template>
