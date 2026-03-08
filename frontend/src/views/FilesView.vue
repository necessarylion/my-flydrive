<script setup lang="ts">
import { onMounted, ref, computed, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFilesStore } from '../stores/files'
import { useDrivesStore } from '../stores/drives'
import FilePreview from '../components/FilePreview.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import ContextMenu from '../components/ContextMenu.vue'
import type { MenuItem } from '../components/ContextMenu.vue'
import { middleTruncate } from '../utils/truncate'
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
  FolderZipIcon,
  PencilEdit01Icon,
  GridViewIcon,
  ListViewIcon,
} from '@hugeicons/core-free-icons'

const route = useRoute()
const router = useRouter()
const filesStore = useFilesStore()
const drivesStore = useDrivesStore()
const fileInput = ref<HTMLInputElement>()
const showNewFolder = ref(false)
const newFolderName = ref('')
const previewFile = ref<{ path: string; name: string } | null>(null)
const deleteTarget = ref<{ path: string; name: string; isDirectory: boolean } | null>(null)
const contextMenu = ref<{ x: number; y: number; items: MenuItem[] } | null>(null)
const downloadTarget = ref<{ path: string; name: string } | null>(null)
const downloadFolderTarget = ref<{ path: string; name: string } | null>(null)
const renameTarget = ref<{ path: string; name: string; isDirectory: boolean } | null>(null)
const renameInput = ref('')
const viewMode = ref<'list' | 'grid'>('list')

function startRename(item: { path: string; name: string; isDirectory: boolean }) {
  renameTarget.value = item
  renameInput.value = item.name
  nextTick(() => {
    const input = document.querySelector<HTMLInputElement>('.rename-input')
    if (input) {
      input.focus()
      const dotIndex = item.name.lastIndexOf('.')
      input.setSelectionRange(0, dotIndex > 0 && !item.isDirectory ? dotIndex : item.name.length)
    }
  })
}

async function handleRename() {
  if (!renameTarget.value || !renameInput.value.trim()) return
  const newName = renameInput.value.trim()
  if (newName !== renameTarget.value.name) {
    await filesStore.rename(renameTarget.value.path, newName, renameTarget.value.isDirectory)
  }
  renameTarget.value = null
}

function handleContextMenu(e: MouseEvent, item: any) {
  e.preventDefault()
  const items: MenuItem[] = []

  items.push({
    label: 'Rename',
    icon: PencilEdit01Icon,
    action: () => startRename({ path: item.path, name: item.name, isDirectory: item.isDirectory }),
  })

  if (item.isDirectory) {
    items.push({
      label: 'Download as ZIP',
      icon: FolderZipIcon,
      action: () => { downloadFolderTarget.value = { path: item.path, name: item.name } },
    })
  } else {
    items.push({
      label: 'Download',
      icon: Download01Icon,
      action: () => { downloadTarget.value = { path: item.path, name: item.name } },
    })
  }

  items.push({
    label: 'Delete',
    icon: Delete01Icon,
    danger: true,
    action: () => { deleteTarget.value = { path: item.path, name: item.name, isDirectory: item.isDirectory } },
  })

  contextMenu.value = { x: e.clientX, y: e.clientY, items }
}

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
  const encoded = (route.query.path as string) || ''
  const initialPath = encoded ? atob(encoded) : ''
  filesStore.fetchFiles(driveId.value, initialPath)
})

watch(driveId, (newId) => {
  router.replace({ query: {} })
  filesStore.fetchFiles(newId)
})

watch(() => filesStore.currentPath, (path) => {
  const query = path ? { path: btoa(path) } : {}
  router.replace({ query })
})

async function handleUpload(e: Event) {
  const target = e.target as HTMLInputElement
  const files = target.files
  if (!files?.length) return
  await filesStore.uploadMultiple(Array.from(files))
  target.value = ''
}

const isDragging = ref(false)
let dragCounter = 0

function handleDragEnter(e: DragEvent) {
  e.preventDefault()
  dragCounter++
  if (e.dataTransfer?.types.includes('Files')) {
    isDragging.value = true
  }
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault()
  dragCounter--
  if (dragCounter === 0) {
    isDragging.value = false
  }
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
}

async function handleDrop(e: DragEvent) {
  e.preventDefault()
  dragCounter = 0
  isDragging.value = false
  const files = e.dataTransfer?.files
  if (!files?.length) return
  await filesStore.uploadMultiple(Array.from(files))
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
    'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
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

function formatDate(iso?: string) {
  if (!iso) return '\u2014'
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
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
  <div
    class="flex flex-col h-full font-sans relative"
    @dragenter="handleDragEnter"
    @dragleave="handleDragLeave"
    @dragover="handleDragOver"
    @drop="handleDrop"
  >
    <!-- Breadcrumbs -->
    <div class="flex items-center justify-between px-3 md:px-6 h-12 border-b border-divider-light gap-2">
      <div class="flex items-center text-sm min-w-0 overflow-x-auto">
        <template v-if="filesStore.isSearching">
          <span class="text-subtle">Search results for "</span>
          <span class="font-medium text-heading">{{ filesStore.searchQuery }}</span>
          <span class="text-subtle">"</span>
          <span class="text-muted ml-1">({{ filesStore.files.length }} found)</span>
        </template>
        <template v-else v-for="(crumb, i) in breadcrumbs" :key="crumb.path">
          <HugeiconsIcon v-if="i > 0" :icon="ArrowRight01Icon" :size="14" class="text-muted mx-1" />
          <button
            @click="filesStore.navigateTo(crumb.path)"
            class="px-1.5 py-0.5 rounded hover:bg-panel-alt transition-colors"
            :class="i === breadcrumbs.length - 1 ? 'font-medium text-heading' : 'text-subtle'"
          >
            {{ crumb.name }}
          </button>
        </template>
      </div>
      <div class="flex items-center gap-0.5 bg-panel-alt rounded-lg p-0.5 shrink-0">
          <button
            @click="viewMode = 'list'"
            class="p-1.5 rounded-md transition-colors"
            :class="viewMode === 'list' ? 'bg-panel shadow-sm text-heading' : 'text-muted hover:text-subtle'"
            title="List view"
          >
            <HugeiconsIcon :icon="ListViewIcon" :size="16" />
          </button>
          <button
            @click="viewMode = 'grid'"
            class="p-1.5 rounded-md transition-colors"
            :class="viewMode === 'grid' ? 'bg-panel shadow-sm text-heading' : 'text-muted hover:text-subtle'"
            title="Grid view"
          >
            <HugeiconsIcon :icon="GridViewIcon" :size="16" />
          </button>
      </div>
    </div>

    <!-- New folder inline input -->
    <div v-if="showNewFolder" class="flex flex-wrap items-center gap-2 px-3 md:px-6 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800">
      <HugeiconsIcon :icon="Folder01Icon" :size="20" class="text-blue-500 dark:text-blue-400" />
      <input
        v-model="newFolderName"
        placeholder="Folder name"
        class="bg-input-bg border border-blue-200 dark:border-blue-700 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-400 dark:focus:border-blue-500 w-64"
        @keyup.enter="handleCreateFolder"
        @keyup.escape="showNewFolder = false"
        autofocus
      />
      <button @click="handleCreateFolder" class="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700">Create</button>
      <button @click="showNewFolder = false" class="px-3 py-1.5 text-xs text-subtle hover:text-body">Cancel</button>
    </div>

    <!-- Loading -->
    <div v-if="filesStore.loading" class="flex-1 flex items-center justify-center text-muted">
      Loading...
    </div>

    <!-- List view -->
    <div v-else-if="viewMode === 'list'" class="flex-1 overflow-y-auto">
      <table class="w-full mt-2">
        <thead>
          <tr class="text-xs text-subtle">
            <th class="text-left pl-3 md:pl-6 pr-4 py-2">Name</th>
            <th class="text-left px-4 py-2 w-45 hidden md:table-cell">Last modified</th>
            <th class="text-left px-4 py-2 w-28 hidden sm:table-cell">Size</th>
            <th class="w-12 md:w-20 pr-2 md:pr-6"></th>
          </tr>
        </thead>
        <tbody>
          <!-- Go up -->
          <tr
            v-if="filesStore.currentPath"
            class="hover:bg-panel-hover cursor-pointer border-b border-divider-light"
            @click="filesStore.navigateUp()"
          >
            <td class="pl-3 md:pl-6 pr-4 py-2">
              <div class="flex items-center gap-3">
                <HugeiconsIcon :icon="ArrowTurnBackwardIcon" :size="18" class="text-muted" />
                <span class="text-sm text-subtle">..</span>
              </div>
            </td>
            <td class="hidden md:table-cell"></td>
            <td class="hidden sm:table-cell"></td>
            <td></td>
          </tr>

          <tr
            v-for="item in filesStore.files"
            :key="item.path"
            class="hover:bg-panel-hover border-b border-divider-light group"
            :class="item.isDirectory || isPreviewable(item.name, item.size) ? 'cursor-pointer' : ''"
            @click="handleClick(item)"
            @contextmenu="handleContextMenu($event, item)"
          >
            <td class="pl-3 md:pl-6 pr-4 py-2">
              <div class="flex items-center gap-3">
                <HugeiconsIcon
                  v-if="item.isDirectory"
                  :icon="Folder01Icon"
                  :size="20"
                  class="text-subtle shrink-0"
                />
                <HugeiconsIcon
                  v-else
                  :icon="getFileIcon(item.name)"
                  :size="20"
                  :class="[getFileIconColor(item.name), 'shrink-0']"
                />
                <input
                  v-if="renameTarget?.path === item.path"
                  v-model="renameInput"
                  class="rename-input text-sm text-heading bg-input-bg border border-blue-400 dark:border-blue-500 rounded px-1.5 py-0.5 outline-none w-64"
                  @click.stop
                  @keyup.enter="handleRename"
                  @keyup.escape="renameTarget = null"
                  @blur="handleRename"
                />
                <span v-else class="text-sm text-heading break-all line-clamp-2" :title="item.name">{{ item.name }}</span>
              </div>
            </td>
            <td class="px-4 py-2 text-xs text-subtle hidden md:table-cell">{{ formatDate(item.lastModified) }}</td>
            <td class="px-4 py-2 text-xs text-subtle hidden sm:table-cell">{{ item.isDirectory ? '\u2014' : formatSize(item.size) }}</td>
            <td class="pr-2 md:pr-6 py-2" @click.stop>
              <div class="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <button
                  v-if="!item.isDirectory"
                  @click="downloadTarget = { path: item.path, name: item.name }"
                  class="p-1.5 rounded-full hover:bg-panel-hover transition-colors"
                  title="Download"
                >
                  <HugeiconsIcon :icon="Download01Icon" :size="16" class="text-subtle" />
                </button>
                <button
                  @click="deleteTarget = { path: item.path, name: item.name, isDirectory: item.isDirectory }"
                  class="p-1.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                  title="Delete"
                >
                  <HugeiconsIcon :icon="Delete01Icon" :size="16" class="text-subtle hover:text-red-600 dark:hover:text-red-400" />
                </button>
              </div>
            </td>
          </tr>

          <tr v-if="filesStore.files.length === 0 && !filesStore.currentPath">
            <td colspan="4" class="text-center py-20">
              <HugeiconsIcon :icon="File01Icon" :size="56" class="text-faint mx-auto mb-4" />
              <p class="text-muted text-sm">Drop files here or use the "New" button to upload</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Grid view -->
    <div v-else class="flex-1 overflow-y-auto p-3 md:p-6">
      <!-- Go up -->
      <div
        v-if="filesStore.currentPath"
        class="inline-flex items-center gap-2 px-3 py-1.5 mb-4 rounded-lg hover:bg-panel-alt cursor-pointer text-sm text-subtle"
        @click="filesStore.navigateUp()"
      >
        <HugeiconsIcon :icon="ArrowTurnBackwardIcon" :size="16" class="text-muted" />
        ..
      </div>

      <div class="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2 md:gap-3">
        <div
          v-for="item in filesStore.files"
          :key="item.path"
          class="group flex flex-col items-center p-4 rounded-xl transition-colors relative"
          :class="[
            item.isDirectory ? 'bg-panel-alt hover:bg-panel-alt' : 'bg-blue-50/50 dark:bg-blue-900/20 hover:bg-blue-50 dark:hover:bg-blue-900/30',
            (item.isDirectory || isPreviewable(item.name, item.size)) ? 'cursor-pointer' : '',
          ]"
          @click="handleClick(item)"
          @contextmenu="handleContextMenu($event, item)"
        >
          <!-- Hover actions -->
          <div class="absolute top-1.5 right-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" @click.stop>
            <button
              v-if="!item.isDirectory"
              @click="downloadTarget = { path: item.path, name: item.name }"
              class="p-1 rounded-full hover:bg-panel-hover transition-colors"
              title="Download"
            >
              <HugeiconsIcon :icon="Download01Icon" :size="14" class="text-subtle" />
            </button>
            <button
              @click="deleteTarget = { path: item.path, name: item.name, isDirectory: item.isDirectory }"
              class="p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              title="Delete"
            >
              <HugeiconsIcon :icon="Delete01Icon" :size="14" class="text-subtle hover:text-red-600 dark:hover:text-red-400" />
            </button>
          </div>

          <!-- Icon -->
          <HugeiconsIcon
            v-if="item.isDirectory"
            :icon="Folder01Icon"
            :size="48"
            class="text-muted mb-2"
          />
          <HugeiconsIcon
            v-else
            :icon="getFileIcon(item.name)"
            :size="48"
            :class="[getFileIconColor(item.name), 'mb-2']"
          />

          <!-- Name -->
          <input
            v-if="renameTarget?.path === item.path"
            v-model="renameInput"
            class="rename-input text-xs text-heading bg-input-bg border border-blue-400 dark:border-blue-500 rounded px-1.5 py-0.5 outline-none w-full text-center"
            @click.stop
            @keyup.enter="handleRename"
            @keyup.escape="renameTarget = null"
            @blur="handleRename"
          />
          <span v-else class="text-xs text-body text-center w-full break-all line-clamp-2" :title="item.name">{{ item.name }}</span>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="filesStore.files.length === 0 && !filesStore.currentPath" class="flex flex-col items-center justify-center py-20">
        <HugeiconsIcon :icon="File01Icon" :size="56" class="text-faint mb-4" />
        <p class="text-muted text-sm">Drop files here or use the "New" button to upload</p>
      </div>
    </div>

    <input ref="fileInput" type="file" multiple class="hidden" @change="handleUpload" />

    <!-- Drag overlay -->
    <div
      v-if="isDragging"
      class="absolute inset-2 bg-blue-50/80 dark:bg-blue-900/60 border-2 border-dashed border-blue-400 dark:border-blue-500 rounded-xl z-50 flex items-center justify-center pointer-events-none"
    >
      <div class="text-center">
        <HugeiconsIcon :icon="File01Icon" :size="48" class="text-blue-400 dark:text-blue-300 mx-auto mb-2" />
        <p class="text-blue-600 dark:text-blue-400 font-medium">Drop files here to upload</p>
      </div>
    </div>

    <!-- Upload progress -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-4 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-4 opacity-0"
    >
      <div
        v-if="filesStore.uploads.length"
        class="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 z-50 md:w-80 bg-panel rounded-xl shadow-lg border border-divider overflow-hidden"
      >
        <div class="px-4 py-2.5 bg-panel-alt border-b border-divider-light text-sm font-medium text-body">
          Uploading {{ filesStore.uploads.length }} file{{ filesStore.uploads.length > 1 ? 's' : '' }}
        </div>
        <div class="max-h-48 overflow-y-auto">
          <div v-for="(item, i) in filesStore.uploads" :key="i" class="px-4 py-2 border-b border-divider-light last:border-0">
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs text-body truncate flex-1 mr-2" :title="item.name">{{ middleTruncate(item.name, 30) }}</span>
              <span
                class="text-xs shrink-0"
                :class="{
                  'text-red-500': item.status === 'error',
                  'text-green-500': item.status === 'done',
                  'text-amber-500': item.status === 'processing',
                  'text-muted': item.status === 'uploading',
                }"
              >
                {{ item.status === 'error' ? 'Failed' : item.status === 'done' ? 'Done' : item.status === 'processing' ? 'Saving to cloud...' : item.progress + '%' }}
              </span>
            </div>
            <div class="h-1 bg-panel-alt rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-300"
                :class="{
                  'bg-red-400': item.status === 'error',
                  'bg-green-400': item.status === 'done',
                  'bg-amber-400 animate-pulse': item.status === 'processing',
                  'bg-blue-500': item.status === 'uploading',
                }"
                :style="{ width: item.status === 'processing' ? '100%' : item.progress + '%' }"
              />
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- File Preview Modal -->
    <FilePreview
      v-if="previewFile"
      :driveId="driveId"
      :filePath="previewFile.path"
      :fileName="previewFile.name"
      @close="previewFile = null"
    />

    <!-- Context Menu -->
    <ContextMenu
      v-if="contextMenu"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :items="contextMenu.items"
      @close="contextMenu = null"
    />

    <!-- Download File Confirmation Dialog -->
    <ConfirmDialog
      v-if="downloadTarget"
      title="Download file"
      :message="`Download &quot;${middleTruncate(downloadTarget.name, 35)}&quot;?`"
      confirmLabel="Download"
      confirmColor="bg-blue-600 hover:bg-blue-700"
      @confirm="filesStore.download(downloadTarget!.path); downloadTarget = null"
      @cancel="downloadTarget = null"
    />

    <!-- Download Folder Confirmation Dialog -->
    <ConfirmDialog
      v-if="downloadFolderTarget"
      title="Download folder as ZIP"
      :message="`Download &quot;${middleTruncate(downloadFolderTarget.name, 35)}&quot; as a ZIP file?`"
      confirmLabel="Download"
      confirmColor="bg-blue-600 hover:bg-blue-700"
      @confirm="filesStore.downloadFolder(downloadFolderTarget!.path); downloadFolderTarget = null"
      @cancel="downloadFolderTarget = null"
    />

    <!-- Delete Confirmation Dialog -->
    <ConfirmDialog
      v-if="deleteTarget"
      :title="`Delete ${deleteTarget.isDirectory ? 'folder' : 'file'}`"
      :message="`Are you sure you want to delete &quot;${middleTruncate(deleteTarget.name, 35)}&quot;? This action cannot be undone.`"
      @confirm="filesStore.remove(deleteTarget!.path, deleteTarget!.isDirectory); deleteTarget = null"
      @cancel="deleteTarget = null"
    />
  </div>
</template>
