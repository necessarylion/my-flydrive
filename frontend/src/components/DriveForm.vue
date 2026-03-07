<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useDrivesStore } from '../stores/drives'
import type { Drive } from '../api/client'

const props = defineProps<{ drive: Drive | null }>()
const emit = defineEmits<{ saved: []; cancel: [] }>()
const store = useDrivesStore()

const isEdit = computed(() => !!props.drive)

const form = ref({
  name: '',
  type: 'local' as string,
  isDefault: false,
  root: './uploads',
  bucket: '',
  region: 'us-east-1',
  accessKeyId: '',
  secretAccessKey: '',
  endpoint: '',
  gcsBucket: '',
  projectId: '',
  keyFilename: '',
  connectionString: '',
  container: '',
})

watch(
  () => props.drive,
  (d) => {
    if (d) {
      form.value.name = d.name
      form.value.type = d.type
      form.value.isDefault = d.isDefault
      const cfg = d.config || {}
      if (d.type === 'local') {
        form.value.root = cfg.root || './uploads'
      } else if (d.type === 's3') {
        form.value.bucket = cfg.bucket || ''
        form.value.region = cfg.region || 'us-east-1'
        form.value.accessKeyId = cfg.accessKeyId || ''
        form.value.secretAccessKey = cfg.secretAccessKey || ''
        form.value.endpoint = cfg.endpoint || ''
      } else if (d.type === 'gcs') {
        form.value.gcsBucket = cfg.bucket || ''
        form.value.projectId = cfg.projectId || ''
        form.value.keyFilename = cfg.keyFilename || ''
      } else if (d.type === 'azure') {
        form.value.connectionString = cfg.connectionString || ''
        form.value.container = cfg.container || ''
      }
    }
  },
  { immediate: true }
)

function buildConfig() {
  switch (form.value.type) {
    case 'local':
      return { root: form.value.root }
    case 's3':
      return {
        bucket: form.value.bucket,
        region: form.value.region,
        accessKeyId: form.value.accessKeyId,
        secretAccessKey: form.value.secretAccessKey,
        ...(form.value.endpoint ? { endpoint: form.value.endpoint } : {}),
      }
    case 'gcs':
      return {
        bucket: form.value.gcsBucket,
        projectId: form.value.projectId,
        ...(form.value.keyFilename ? { keyFilename: form.value.keyFilename } : {}),
      }
    case 'azure':
      return {
        connectionString: form.value.connectionString,
        container: form.value.container,
      }
    default:
      return {}
  }
}

const saving = ref(false)
const error = ref('')

async function handleSubmit() {
  error.value = ''
  saving.value = true
  try {
    const payload = {
      name: form.value.name,
      type: form.value.type,
      isDefault: form.value.isDefault,
      config: buildConfig(),
    }
    if (isEdit.value && props.drive) {
      await store.editDrive(props.drive.id, payload)
    } else {
      await store.addDrive(payload)
    }
    emit('saved')
  } catch (e: any) {
    error.value = e.response?.data?.error || e.message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50" @click.self="emit('cancel')">
    <div class="bg-white rounded-2xl shadow-2xl w-[480px] max-h-[90vh] overflow-y-auto">
      <div class="px-6 pt-6 pb-4 border-b border-gray-100">
        <h2 class="text-lg font-medium text-gray-900">{{ isEdit ? 'Edit Drive' : 'Add Drive' }}</h2>
        <p class="text-sm text-gray-500 mt-0.5">Configure your storage provider</p>
      </div>

      <form @submit.prevent="handleSubmit" class="px-6 py-5 space-y-4">
        <!-- Name -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            v-model="form.name"
            required
            placeholder="My Drive"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
          />
        </div>

        <!-- Type -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Provider</label>
          <select
            v-model="form.type"
            :disabled="isEdit"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white disabled:bg-gray-50 disabled:text-gray-500"
          >
            <option value="local">Local Filesystem</option>
            <option value="s3">Amazon S3</option>
            <option value="gcs">Google Cloud Storage</option>
            <option value="azure">Azure Blob Storage</option>
          </select>
        </div>

        <!-- Default -->
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" v-model="form.isDefault" class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
          <span class="text-sm text-gray-700">Set as default drive</span>
        </label>

        <div class="border-t border-gray-100 pt-4">
          <p class="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Provider Settings</p>

          <!-- Local -->
          <template v-if="form.type === 'local'">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Root Path</label>
              <input
                v-model="form.root"
                required
                placeholder="./uploads"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </template>

          <!-- S3 -->
          <template v-if="form.type === 's3'">
            <div class="space-y-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Bucket</label>
                <input v-model="form.bucket" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Region</label>
                <input v-model="form.region" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Access Key ID</label>
                <input v-model="form.accessKeyId" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Secret Access Key</label>
                <input v-model="form.secretAccessKey" type="password" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Endpoint <span class="text-gray-400 font-normal">(optional, for MinIO/R2)</span></label>
                <input v-model="form.endpoint" placeholder="https://..." class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              </div>
            </div>
          </template>

          <!-- GCS -->
          <template v-if="form.type === 'gcs'">
            <div class="space-y-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Bucket</label>
                <input v-model="form.gcsBucket" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Project ID</label>
                <input v-model="form.projectId" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Key Filename <span class="text-gray-400 font-normal">(optional)</span></label>
                <input v-model="form.keyFilename" placeholder="/path/to/keyfile.json" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              </div>
            </div>
          </template>

          <!-- Azure -->
          <template v-if="form.type === 'azure'">
            <div class="space-y-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Connection String</label>
                <input v-model="form.connectionString" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Container</label>
                <input v-model="form.container" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              </div>
            </div>
          </template>
        </div>

        <div v-if="error" class="text-red-600 text-sm bg-red-50 rounded-lg p-3">{{ error }}</div>

        <div class="flex justify-end gap-2 pt-2">
          <button
            type="button"
            @click="emit('cancel')"
            class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="saving"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {{ saving ? 'Saving...' : isEdit ? 'Update' : 'Create' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
