<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useFilesStore } from '../stores/files'
import { useDrivesStore } from '../stores/drives'
import FilePreview from '../components/FilePreview.vue'
import { HugeiconsIcon } from '@hugeicons/vue'
import {
  Folder01Icon,
  File01Icon,
  FileAudioIcon,
  FileVideoIcon,
  Image01Icon,
  Pdf01Icon,
  Download01Icon,
  Delete01Icon,
  ArrowTurnBackwardIcon,
  ArrowRight01Icon,
} from '@hugeicons/core-free-icons'

const route = useRoute()
const filesStore = useFilesStore()
const drivesStore = useDrivesStore()
const fileInput = ref<HTMLInputElement>()
const showNewFolder = ref(false)
const newFolderName = ref('')
const previewFile = ref<{ path: string; name: string } | null>(null)

const driveId = computed(() => route.params.driveId as string)
const driveName = computed(() => {
  const d = drivesStore.drives.find((d) => d.id === driveId.value)
  return d?.name || 'Drive'
})

const breadcrumbs = computed(() => {
  const parts = filesStore.currentPath.split('/').filter(Boolean)
  const crumbs = [{ name: driveName.value, path: '' }]
  let accumulated = ''
  for (const part of parts) {
    accumulated = accumulated ? `${accumulated}/${part}` : part
    crumbs.push({ name: part, path: accumulated })
  }
  return crumbs
})

onMounted(async () => {
  if (!drivesStore.drives.length) await drivesStore.fetchDrives()
  filesStore.fetchFiles(driveId.value)
})

watch(driveId, (newId) => {
  filesStore.fetchFiles(newId)
})

async function handleUpload(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  await filesStore.upload(file)
  target.value = ''
}

async function handleCreateFolder() {
  if (!newFolderName.value.trim()) return
  await filesStore.addFolder(newFolderName.value.trim())
  newFolderName.value = ''
  showNewFolder.value = false
}

function handleClick(item: any) {
  if (item.isDirectory) {
    filesStore.navigateTo(item.path)
  } else if (isPreviewable(item.name)) {
    previewFile.value = { path: item.path, name: item.name }
  }
}

const MAX_PREVIEW_SIZE = 200 * 1024 * 1024 // 200MB

function isPreviewable(name: string, size?: number): boolean {
  if (size != null && size > MAX_PREVIEW_SIZE) return false
  const ext = name.split('.').pop()?.toLowerCase() || ''
  return [
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico',
    'pdf',
    'mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a',
    'mp4', 'webm', 'ogv', 'mov',
    'txt', 'json', 'xml', 'csv', 'md', 'log',
  ].includes(ext)
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) return Image01Icon
  if (['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'].includes(ext)) return FileAudioIcon
  if (['mp4', 'webm', 'ogv', 'mov', 'avi', 'mkv'].includes(ext)) return FileVideoIcon
  if (ext === 'pdf') return Pdf01Icon
  return File01Icon
}

function getFileIconColor(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) return 'text-red-500'
  if (['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'].includes(ext)) return 'text-purple-500'
  if (['mp4', 'webm', 'ogv', 'mov', 'avi', 'mkv'].includes(ext)) return 'text-orange-500'
  if (ext === 'pdf') return 'text-red-600'
  return 'text-blue-500'
}

function formatSize(bytes?: number) {
  if (bytes == null) return '\u2014'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
}
</script>

<template>
  <div class="flex flex-col h-full font-sans">
    <!-- Breadcrumbs -->
    <div class="flex items-center justify-between px-6 h-12 border-b border-gray-100">
      <div class="flex items-center text-sm">
        <template v-for="(crumb, i) in breadcrumbs" :key="crumb.path">
          <HugeiconsIcon v-if="i > 0" :icon="ArrowRight01Icon" :size="14" class="text-gray-400 mx-1" />
          <button
            @click="filesStore.navigateTo(crumb.path)"
            class="px-1.5 py-0.5 rounded hover:bg-gray-100 transition-colors"
            :class="i === breadcrumbs.length - 1 ? 'font-medium text-gray-900' : 'text-gray-500'"
          >
            {{ crumb.name }}
          </button>
        </template>
      </div>
    </div>

    <!-- New folder inline input -->
    <div v-if="showNewFolder" class="flex items-center gap-2 px-6 py-2 bg-blue-50 border-b border-blue-100">
      <HugeiconsIcon :icon="Folder01Icon" :size="20" class="text-blue-500" />
      <input
        v-model="newFolderName"
        placeholder="Folder name"
        class="bg-white border border-blue-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-400 w-64"
        @keyup.enter="handleCreateFolder"
        @keyup.escape="showNewFolder = false"
        autofocus
      />
      <button @click="handleCreateFolder" class="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700">Create</button>
      <button @click="showNewFolder = false" class="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
    </div>

    <!-- Loading -->
    <div v-if="filesStore.loading" class="flex-1 flex items-center justify-center text-gray-400">
      Loading...
    </div>

    <!-- File table -->
    <div v-else class="flex-1 overflow-y-auto">
      <div class="px-6 pt-5 pb-2">
        <h2 class="text-sm font-medium text-gray-900">Files</h2>
      </div>

      <table class="w-full">
        <thead>
          <tr class="text-xs text-gray-500 font-medium">
            <th class="text-left pl-6 pr-4 py-2">Name</th>
            <th class="text-left px-4 py-2 w-40">Last modified</th>
            <th class="text-left px-4 py-2 w-28">File size</th>
            <th class="w-20 pr-6"></th>
          </tr>
        </thead>
        <tbody>
          <!-- Go up -->
          <tr
            v-if="filesStore.currentPath"
            class="hover:bg-[#f8fafd] cursor-pointer border-b border-gray-50"
            @click="filesStore.navigateUp()"
          >
            <td class="pl-6 pr-4 py-2">
              <div class="flex items-center gap-3">
                <HugeiconsIcon :icon="ArrowTurnBackwardIcon" :size="18" class="text-gray-400" />
                <span class="text-sm text-gray-500">..</span>
              </div>
            </td>
            <td></td>
            <td></td>
            <td></td>
          </tr>

          <tr
            v-for="item in filesStore.files"
            :key="item.path"
            class="hover:bg-[#f8fafd] border-b border-gray-50 group"
            :class="item.isDirectory || isPreviewable(item.name, item.size) ? 'cursor-pointer' : ''"
            @click="handleClick(item)"
          >
            <td class="pl-6 pr-4 py-2">
              <div class="flex items-center gap-3">
                <HugeiconsIcon
                  v-if="item.isDirectory"
                  :icon="Folder01Icon"
                  :size="20"
                  class="text-gray-500"
                />
                <HugeiconsIcon
                  v-else
                  :icon="getFileIcon(item.name)"
                  :size="20"
                  :class="getFileIconColor(item.name)"
                />
                <span class="text-sm text-gray-800">{{ item.name }}</span>
              </div>
            </td>
            <td class="px-4 py-2 text-xs text-gray-500">{{ item.lastModified || '\u2014' }}</td>
            <td class="px-4 py-2 text-xs text-gray-500">{{ item.isDirectory ? '\u2014' : formatSize(item.size) }}</td>
            <td class="pr-6 py-2" @click.stop>
              <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  v-if="!item.isDirectory"
                  @click="filesStore.download(item.path)"
                  class="p-1.5 rounded-full hover:bg-gray-200 transition-colors"
                  title="Download"
                >
                  <HugeiconsIcon :icon="Download01Icon" :size="16" class="text-gray-600" />
                </button>
                <button
                  @click="filesStore.remove(item.path)"
                  class="p-1.5 rounded-full hover:bg-red-100 transition-colors"
                  title="Delete"
                >
                  <HugeiconsIcon :icon="Delete01Icon" :size="16" class="text-gray-600 hover:text-red-600" />
                </button>
              </div>
            </td>
          </tr>

          <tr v-if="filesStore.files.length === 0 && !filesStore.currentPath">
            <td colspan="4" class="text-center py-20">
              <HugeiconsIcon :icon="File01Icon" :size="56" class="text-gray-200 mx-auto mb-4" />
              <p class="text-gray-400 text-sm">Drop files here or use the "New" button to upload</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <input ref="fileInput" type="file" class="hidden" @change="handleUpload" />

    <!-- File Preview Modal -->
    <FilePreview
      v-if="previewFile"
      :driveId="driveId"
      :filePath="previewFile.path"
      :fileName="previewFile.name"
      @close="previewFile = null"
    />
  </div>
</template>
