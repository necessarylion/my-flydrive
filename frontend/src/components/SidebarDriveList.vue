<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useFilesStore } from '../stores/files'
import type { Drive } from '../api/client'
import { HugeiconsIcon } from '@hugeicons/vue'
import {
  PlusSignIcon,
  FolderAddIcon,
  CloudUploadIcon,
  HardDriveIcon,
  Settings01Icon,
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
const menuRef = ref<HTMLElement>()

function handleNewClick() {
  showMenu.value = !showMenu.value
}

function handleClickOutside(e: MouseEvent) {
  if (showMenu.value && menuRef.value && !menuRef.value.contains(e.target as Node)) {
    showMenu.value = false
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))

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
  <div class="flex flex-col h-full">
    <!-- New button -->
    <div class="relative mb-4" ref="menuRef">
      <button
        @click="handleNewClick"
        class="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-white hover:bg-gray-50 transition-all text-sm font-medium text-gray-700 active:scale-[0.98]"
      >
        <HugeiconsIcon :icon="PlusSignIcon" :size="22" class="text-gray-600" />
        New
      </button>

      <!-- Dropdown -->
      <Transition
        enter-active-class="transition duration-100 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-75 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-if="showMenu"
          class="absolute top-14 left-0 z-50 w-56 bg-white rounded-2xl py-1.5 origin-top-left"
        >
          <button
            @click="handleNewFolder"
            class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700 transition-colors"
          >
            <HugeiconsIcon :icon="FolderAddIcon" :size="20" class="text-gray-500" />
            New folder
          </button>
          <div class="border-t border-gray-100 mx-3 my-1"></div>
          <button
            @click="handleUpload"
            class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700 transition-colors"
          >
            <HugeiconsIcon :icon="CloudUploadIcon" :size="20" class="text-gray-500" />
            File upload
          </button>
        </div>
      </Transition>
    </div>

    <!-- Drive list -->
    <div class="flex-1 overflow-y-auto">
      <div class="flex items-center gap-2 px-3 mb-1.5">
        <HugeiconsIcon :icon="HardDriveIcon" :size="14" class="text-gray-400" />
        <span class="text-xs font-medium text-gray-400 uppercase tracking-wider">Drives</span>
      </div>
      <nav class="flex flex-col gap-0.5">
        <button
          v-for="drive in drives"
          :key="drive.id"
          @click="emit('select', drive.id)"
          class="group flex items-center gap-3 px-3 py-2 rounded-full text-sm transition-all text-left"
          :class="activeDriveId === drive.id
            ? 'bg-[#c2e7ff] text-[#001d35] font-medium'
            : 'text-gray-700 hover:bg-black/4'"
        >
          <ProviderIcon :type="drive.type" :size="20" />
          <span class="truncate flex-1">{{ drive.name }}</span>
          <span
            v-if="drive.isDefault"
            class="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wider"
            :class="activeDriveId === drive.id ? 'bg-[#001d35]/10 text-[#001d35]/60' : 'bg-gray-100 text-gray-400'"
          >
            default
          </span>
        </button>
      </nav>
    </div>

    <!-- Bottom section -->
    <div class="pt-2 mt-auto border-t border-gray-200/60">
      <router-link
        to="/drives"
        class="flex items-center gap-3 px-3 py-2 rounded-full text-sm text-gray-500 hover:bg-black/4 hover:text-gray-700 transition-colors"
      >
        <HugeiconsIcon :icon="Settings01Icon" :size="18" class="text-gray-400" />
        Manage drives
      </router-link>
    </div>
  </div>
</template>
