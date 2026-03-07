<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { HugeiconsIcon } from '@hugeicons/vue'
import { Cancel01Icon, Download01Icon } from '@hugeicons/core-free-icons'
import { useFilesStore } from '../stores/files'

const props = defineProps<{
  driveId: string
  filePath: string
  fileName: string
}>()

const emit = defineEmits<{ close: [] }>()
const filesStore = useFilesStore()
const loading = ref(true)
const error = ref('')
const objectUrl = ref('')
const textContent = ref('')

const ext = computed(() => props.fileName.split('.').pop()?.toLowerCase() || '')

const previewType = computed(() => {
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext.value)) return 'image'
  if (['mp4', 'webm', 'ogv', 'mov'].includes(ext.value)) return 'video'
  if (['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'].includes(ext.value)) return 'audio'
  if (ext.value === 'pdf') return 'pdf'
  if (['txt', 'json', 'xml', 'csv', 'md', 'log'].includes(ext.value)) return 'text'
  return 'unknown'
})

const mimeType = computed(() => {
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp', ico: 'image/x-icon',
    mp4: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg', mov: 'video/quicktime',
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', aac: 'audio/aac',
    flac: 'audio/flac', m4a: 'audio/mp4',
    pdf: 'application/pdf',
    txt: 'text/plain', json: 'application/json', xml: 'text/xml',
    csv: 'text/csv', md: 'text/markdown', log: 'text/plain',
  }
  return map[ext.value] || 'application/octet-stream'
})

const previewUrl = computed(() =>
  `http://localhost:3000/api/files/${props.driveId}/preview?path=${encodeURIComponent(props.filePath)}`
)

onMounted(async () => {
  try {
    if (previewType.value === 'text') {
      const headers: Record<string, string> = {}
    const token = localStorage.getItem('token')
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(previewUrl.value, { headers })
      if (!res.ok) throw new Error('Failed to load file')
      textContent.value = await res.text()
    } else {
      const headers: Record<string, string> = {}
    const token = localStorage.getItem('token')
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(previewUrl.value, { headers })
      if (!res.ok) throw new Error('Failed to load file')
      const blob = await res.blob()
      objectUrl.value = URL.createObjectURL(blob)
    }
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
})

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => document.addEventListener('keydown', handleKeydown))
onUnmounted(() => document.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" @click.self="emit('close')">
    <div class="bg-white rounded-2xl shadow-2xl w-[90vw] max-w-5xl h-[85vh] flex flex-col overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
        <h3 class="text-sm font-medium text-gray-900 truncate">{{ fileName }}</h3>
        <div class="flex items-center gap-1">
          <button
            @click="filesStore.download(filePath)"
            class="p-2 rounded-full hover:bg-gray-100 transition-colors"
            title="Download"
          >
            <HugeiconsIcon :icon="Download01Icon" :size="18" class="text-gray-600" />
          </button>
          <button
            @click="emit('close')"
            class="p-2 rounded-full hover:bg-gray-100 transition-colors"
            title="Close"
          >
            <HugeiconsIcon :icon="Cancel01Icon" :size="18" class="text-gray-600" />
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-auto flex items-center justify-center bg-gray-50 p-4">
        <div v-if="loading" class="text-gray-400 text-sm">Loading preview...</div>
        <div v-else-if="error" class="text-red-500 text-sm">{{ error }}</div>

        <!-- Image -->
        <img
          v-else-if="previewType === 'image'"
          :src="objectUrl"
          :alt="fileName"
          class="max-w-full max-h-full object-contain rounded-lg"
        />

        <!-- Video -->
        <video
          v-else-if="previewType === 'video'"
          :src="objectUrl"
          controls
          class="max-w-full max-h-full rounded-lg"
        />

        <!-- Audio -->
        <div v-else-if="previewType === 'audio'" class="w-full max-w-lg">
          <div class="bg-white rounded-xl p-8 shadow-sm text-center">
            <div class="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-10 h-10 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
              </svg>
            </div>
            <p class="text-sm font-medium text-gray-700 mb-4">{{ fileName }}</p>
            <audio :src="objectUrl" controls class="w-full" />
          </div>
        </div>

        <!-- PDF -->
        <iframe
          v-else-if="previewType === 'pdf'"
          :src="objectUrl"
          class="w-full h-full rounded-lg border-0"
        />

        <!-- Text -->
        <pre
          v-else-if="previewType === 'text'"
          class="w-full h-full overflow-auto bg-white rounded-lg p-5 text-sm text-gray-800 font-mono border border-gray-200"
        >{{ textContent }}</pre>

        <div v-else class="text-gray-400 text-sm">Preview not available for this file type</div>
      </div>
    </div>
  </div>
</template>
