<script setup lang="ts">
import { ref } from 'vue'
import { useDrivesStore } from '../stores/drives'
import DriveForm from '../components/DriveForm.vue'
import type { Drive } from '../api/client'
import { HugeiconsIcon } from '@hugeicons/vue'
import {
  PlusSignIcon,
  HardDriveIcon,
  Delete01Icon,
  PencilEdit01Icon,
  FolderOpenIcon,
} from '@hugeicons/core-free-icons'
import ProviderIcon from '../components/ProviderIcon.vue'

const store = useDrivesStore()
const showForm = ref(false)
const editingDrive = ref<Drive | null>(null)

function openCreate() {
  editingDrive.value = null
  showForm.value = true
}

function openEdit(drive: Drive) {
  editingDrive.value = drive
  showForm.value = true
}

async function handleDelete(id: string) {
  if (confirm('Are you sure you want to delete this drive?')) {
    await store.removeDrive(id)
  }
}

function handleSaved() {
  showForm.value = false
  editingDrive.value = null
  store.fetchDrives()
}

const typeLabels: Record<string, string> = {
  local: 'Local Filesystem',
  s3: 'Amazon S3',
  gcs: 'Google Cloud Storage',
  azure: 'Azure Blob Storage',
}

const typeColors: Record<string, string> = {
  local: 'bg-blue-50 text-blue-700',
  s3: 'bg-orange-50 text-orange-700',
  gcs: 'bg-green-50 text-green-700',
  azure: 'bg-sky-50 text-sky-700',
}

function getDriveIconBg(type: string) {
  switch (type) {
    case 'local': return 'bg-blue-100'
    case 's3': return 'bg-orange-100'
    case 'gcs': return 'bg-blue-50'
    case 'azure': return 'bg-sky-100'
    default: return 'bg-gray-100'
  }
}
</script>

<template>
  <div class="p-4 md:p-8 max-w-4xl">
    <div class="flex items-center justify-between mb-6 md:mb-8">
      <div>
        <h1 class="text-xl md:text-2xl font-semibold text-gray-900">Drive Configuration</h1>
        <p class="text-sm text-gray-500 mt-1">Manage your storage providers</p>
      </div>
      <button
        @click="openCreate"
        class="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
      >
        <HugeiconsIcon :icon="PlusSignIcon" :size="16" class="text-white" />
        Add Drive
      </button>
    </div>

    <div v-if="store.loading" class="text-center text-gray-400 py-16">Loading...</div>

    <div v-else-if="store.drives.length === 0" class="text-center py-20">
      <HugeiconsIcon :icon="HardDriveIcon" :size="56" class="text-gray-300 mx-auto mb-4" />
      <p class="text-gray-500 mb-4">No drives configured yet</p>
      <button
        @click="openCreate"
        class="text-blue-600 hover:text-blue-700 text-sm font-medium"
      >
        Add your first drive
      </button>
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="drive in store.drives"
        :key="drive.id"
        class="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors group"
      >
        <div class="w-10 h-10 rounded-lg flex items-center justify-center" :class="getDriveIconBg(drive.type)">
          <ProviderIcon :type="drive.type" :size="22" />
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <h3 class="text-sm font-medium text-gray-900 truncate">{{ drive.name }}</h3>
            <span v-if="drive.isDefault" class="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-medium rounded uppercase">Default</span>
          </div>
          <span class="text-xs px-2 py-0.5 rounded-full mt-1 inline-block" :class="typeColors[drive.type]">
            {{ typeLabels[drive.type] || drive.type }}
          </span>
        </div>

        <div class="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <router-link
            :to="`/files/${drive.id}`"
            class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Browse"
          >
            <HugeiconsIcon :icon="FolderOpenIcon" :size="16" />
          </router-link>
          <button
            @click="openEdit(drive)"
            class="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Edit"
          >
            <HugeiconsIcon :icon="PencilEdit01Icon" :size="16" />
          </button>
          <button
            @click="handleDelete(drive.id)"
            class="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
          >
            <HugeiconsIcon :icon="Delete01Icon" :size="16" />
          </button>
        </div>
      </div>
    </div>

    <DriveForm
      v-if="showForm"
      :drive="editingDrive"
      @saved="handleSaved"
      @cancel="showForm = false"
    />
  </div>
</template>
