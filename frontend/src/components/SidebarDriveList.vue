<script setup lang="ts">
import { ref } from 'vue'
import { useFilesStore } from '../stores/files'
import type { Drive } from '../api/client'
import { HugeiconsIcon } from '@hugeicons/vue'
import {
  PlusSignIcon,
  FolderAddIcon,
  CloudUploadIcon,
} from '@hugeicons/core-free-icons'
import ProviderIcon from './ProviderIcon.vue'

defineProps<{
  drives: Drive[]
  activeDriveId: string
}>()

const emit = defineEmits<{
  select: [id: string]
}>()

const filesStore = useFilesStore()
const showMenu = ref(false)

function handleNewClick() {
  showMenu.value = !showMenu.value
}

function handleNewFolder() {
  showMenu.value = false
  const name = prompt('Folder name:')
  if (name && filesStore.currentDriveId) {
    filesStore.addFolder(name)
  }
}

function handleUpload() {
  showMenu.value = false
  const input = document.createElement('input')
  input.type = 'file'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (file && filesStore.currentDriveId) {
      await filesStore.upload(file)
    }
  }
  input.click()
}

</script>

<template>
  <div class="flex flex-col gap-1">
    <!-- New button -->
    <div class="relative mb-3">
      <button
        @click="handleNewClick"
        class="flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-md bg-white hover:shadow-lg transition-shadow text-sm font-medium text-gray-700 border border-gray-100"
      >
        <HugeiconsIcon :icon="PlusSignIcon" :size="24" class="text-gray-700" />
        New
      </button>

      <!-- Dropdown -->
      <div
        v-if="showMenu"
        class="absolute top-14 left-0 z-50 w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-2"
      >
        <button
          @click="handleNewFolder"
          class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-100 text-sm text-gray-700"
        >
          <HugeiconsIcon :icon="FolderAddIcon" :size="20" class="text-gray-500" />
          New folder
        </button>
        <div class="border-t border-gray-100 my-1"></div>
        <button
          @click="handleUpload"
          class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-100 text-sm text-gray-700"
        >
          <HugeiconsIcon :icon="CloudUploadIcon" :size="20" class="text-gray-500" />
          File upload
        </button>
      </div>
    </div>

    <!-- Drive list -->
    <nav class="flex flex-col gap-0.5">
      <button
        v-for="drive in drives"
        :key="drive.id"
        @click="emit('select', drive.id)"
        class="flex items-center gap-3 px-3 py-1.5 rounded-full text-sm transition-colors text-left"
        :class="activeDriveId === drive.id
          ? 'bg-[#c2e7ff] text-[#001d35] font-medium'
          : 'text-gray-700 hover:bg-gray-100'"
      >
        <ProviderIcon :type="drive.type" :size="20" />
        <span class="truncate">{{ drive.name }}</span>
        <span v-if="drive.isDefault" class="ml-auto text-[10px] text-gray-400 uppercase tracking-wider">default</span>
      </button>
    </nav>
  </div>
</template>
