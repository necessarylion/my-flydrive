<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useRouter, useRoute, RouterView } from 'vue-router'
import { useDrivesStore } from '../stores/drives'
import { useFilesStore } from '../stores/files'
import SidebarDriveList from '../components/SidebarDriveList.vue'
import { HugeiconsIcon } from '@hugeicons/vue'
import { Search01Icon, Settings01Icon, Logout02Icon, Cancel01Icon } from '@hugeicons/core-free-icons'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const filesStore = useFilesStore()

const searchInput = ref('')
let searchDebounce: ReturnType<typeof setTimeout> | null = null

function handleSearch(value: string) {
  searchInput.value = value
  if (searchDebounce) clearTimeout(searchDebounce)
  if (!value.trim()) {
    if (filesStore.isSearching) filesStore.clearSearch()
    return
  }
  // Only search if a drive is active
  const driveId = filesStore.currentDriveId || (route.params.driveId as string)
  if (!driveId) return
  if (!filesStore.currentDriveId) filesStore.currentDriveId = driveId
  searchDebounce = setTimeout(() => {
    filesStore.search(value.trim())
  }, 300)
}

function clearSearch() {
  searchInput.value = ''
  filesStore.clearSearch()
}

function handleLogout() {
  authStore.logout()
  router.push('/login')
}
const drivesStore = useDrivesStore()

onMounted(() => drivesStore.fetchDrives())

const activeDriveId = computed(() => (route.params.driveId as string) || '')

function handleDriveSelect(id: string) {
  router.push(`/files/${id}`)
}
</script>

<template>
  <div class="h-screen flex flex-col bg-[#f0f4f9] font-sans">
    <!-- Top bar -->
    <header class="flex items-center px-5 h-16 shrink-0">
      <div class="flex items-center gap-2.5 w-57.5">
        <div class="w-10 h-10 bg-linear-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
          <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2v11z"/>
          </svg>
        </div>
        <span class="text-[20px] text-gray-700 font-medium tracking-tight font-['New_Amsterdam']">MY FLYDRIVE</span>
      </div>

      <!-- Search bar -->
      <div class="flex-1 max-w-180">
        <div class="flex items-center bg-[#dfe3e8] rounded-full px-5 h-12 hover:bg-[#d3d8de] hover:shadow-sm transition-all focus-within:bg-white focus-within:shadow-md">
          <HugeiconsIcon :icon="Search01Icon" class="text-gray-500 mr-3" :size="20" />
          <input
            type="text"
            :value="searchInput"
            @input="handleSearch(($event.target as HTMLInputElement).value)"
            @keyup.escape="clearSearch"
            placeholder="Search in Drive"
            class="bg-transparent outline-none w-full text-sm text-gray-700 placeholder-gray-500"
          />
          <button
            v-if="searchInput"
            @click="clearSearch"
            class="text-gray-400 hover:text-gray-600 ml-2"
          >
            <HugeiconsIcon :icon="Cancel01Icon" :size="18" />
          </button>
        </div>
      </div>

      <div class="flex items-center gap-1 ml-auto">
        <router-link
          to="/drives"
          class="w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors"
          title="Drive Settings"
        >
          <HugeiconsIcon :icon="Settings01Icon" class="text-gray-600" :size="20" />
        </router-link>
        <button
          @click="handleLogout"
          class="w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors"
          title="Logout"
        >
          <HugeiconsIcon :icon="Logout02Icon" class="text-gray-600" :size="20" />
        </button>
      </div>
    </header>

    <!-- Body -->
    <div class="flex flex-1 overflow-hidden px-2 pb-2">
      <!-- Sidebar -->
      <aside class="w-[240px] shrink-0 flex flex-col pt-2 pr-3 overflow-y-auto">
        <SidebarDriveList
          :drives="drivesStore.drives"
          :activeDriveId="activeDriveId"
          @select="handleDriveSelect"
        />
      </aside>

      <!-- Main content -->
      <main class="flex-1 bg-white rounded-2xl overflow-y-auto">
        <RouterView />
      </main>
    </div>
  </div>
</template>
