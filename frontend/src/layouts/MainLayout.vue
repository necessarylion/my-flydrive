<script setup lang="ts">
import { onMounted, computed, ref, watch } from 'vue';
import { useRouter, useRoute, RouterView } from 'vue-router';
import { useDrivesStore } from '../stores/drives';
import { useFilesStore } from '../stores/files';
import { useThemeStore } from '../stores/theme';
import SidebarDriveList from '../components/SidebarDriveList.vue';
import { HugeiconsIcon } from '@hugeicons/vue';
import {
  Search01Icon,
  PowerIcon,
  Cancel01Icon,
  Menu01Icon,
  Sun02Icon,
  Moon02Icon,
} from '@hugeicons/core-free-icons';
import { useAuthStore } from '../stores/auth';
import appLogo from '../assets/logo.svg';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const filesStore = useFilesStore();
const themeStore = useThemeStore();
const sidebarOpen = ref(false);

const searchInput = ref('');
let searchDebounce: ReturnType<typeof setTimeout> | null = null;

function handleSearch(value: string) {
  searchInput.value = value;
  if (searchDebounce) clearTimeout(searchDebounce);
  if (!value.trim()) {
    if (filesStore.isSearching) filesStore.clearSearch();
    return;
  }
  // Only search if a drive is active
  const driveId = filesStore.currentDriveId || (route.params.driveId as string);
  if (!driveId) return;
  if (!filesStore.currentDriveId) filesStore.currentDriveId = driveId;
  searchDebounce = setTimeout(() => {
    filesStore.search(value.trim());
  }, 300);
}

function clearSearch() {
  searchInput.value = '';
  filesStore.clearSearch();
}

function handleLogout() {
  authStore.logout();
  router.push('/login');
}
const drivesStore = useDrivesStore();

onMounted(() => {
  drivesStore.fetchDrives();
  authStore.fetchMe();
});

const activeDriveId = computed(() => (route.params.driveId as string) || '');

function handleDriveSelect(id: string) {
  sidebarOpen.value = false;
  router.push(`/files/${id}`);
}

// Close sidebar on route change
watch(
  () => route.path,
  () => {
    sidebarOpen.value = false;
  },
);
</script>

<template>
  <div class="h-screen flex flex-col bg-page font-sans">
    <!-- Top bar -->
    <header class="flex items-center px-2 h-14 md:h-16 shrink-0">
      <!-- Mobile hamburger -->
      <button
        @click="sidebarOpen = !sidebarOpen"
        class="md:hidden w-10 h-10 rounded-full flex items-center justify-center hover:bg-btn-hover transition-colors"
      >
        <HugeiconsIcon :icon="Menu01Icon" class="text-subtle" :size="22" />
      </button>

      <div class="flex items-center gap-2.5 md:w-60 shrink-0 mr-2 md:mr-0">
        <img :src="appLogo" class="w-8 h-8 md:w-9 md:h-9 md:mx-2" alt="My FlyDrive" />
        <span
          class="hidden md:inline text-[26px] text-body font-medium tracking-tight font-['New_Amsterdam']"
          >MY FLYDRIVE</span
        >
      </div>

      <!-- Search bar -->
      <div class="flex-1 max-w-180">
        <div
          class="flex items-center bg-panel rounded-2xl px-3 md:px-5 h-10 md:h-12 transition-all"
        >
          <HugeiconsIcon
            :icon="Search01Icon"
            class="text-subtle mr-2 md:mr-3 shrink-0"
            :size="20"
          />
          <input
            type="text"
            :value="searchInput"
            @input="handleSearch(($event.target as HTMLInputElement).value)"
            @keyup.escape="clearSearch"
            placeholder="Search in Drive"
            class="bg-transparent outline-none w-full text-sm text-body placeholder-subtle"
          />
          <button v-if="searchInput" @click="clearSearch" class="text-muted hover:text-subtle ml-2">
            <HugeiconsIcon :icon="Cancel01Icon" :size="18" />
          </button>
        </div>
      </div>

      <div class="flex items-center gap-1 md:gap-2 ml-auto shrink-0">
        <button
          @click="themeStore.toggle()"
          class="w-9 h-9 rounded-full flex items-center justify-center hover:bg-btn-hover transition-colors"
          title="Toggle theme"
        >
          <HugeiconsIcon
            :icon="themeStore.dark ? Sun02Icon : Moon02Icon"
            class="text-subtle"
            :size="20"
          />
        </button>
        <button
          @click="handleLogout"
          class="w-9 h-9 rounded-full flex items-center justify-center hover:bg-btn-hover transition-colors"
          title="Sign out"
        >
          <HugeiconsIcon :icon="PowerIcon" class="text-subtle" :size="20" />
        </button>
        <div
          class="w-8 h-8 md:w-9 md:h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs md:text-sm font-medium"
          :title="authStore.userEmail"
        >
          {{ authStore.userInitial }}
        </div>
      </div>
    </header>

    <!-- Body -->
    <div class="flex flex-1 overflow-hidden px-2 pb-2">
      <!-- Mobile sidebar overlay -->
      <Transition
        enter-active-class="transition-opacity duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-200"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="sidebarOpen"
          class="fixed inset-0 bg-overlay z-40 md:hidden"
          @click="sidebarOpen = false"
        />
      </Transition>

      <!-- Sidebar -->
      <aside
        class="fixed inset-y-0 left-0 z-50 w-64 bg-page flex flex-col pt-16 px-2 overflow-y-auto transition-transform duration-200 md:static md:w-60 md:pt-2 md:px-0 md:pr-3 md:translate-x-0 md:z-auto"
        :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full'"
      >
        <SidebarDriveList
          :drives="drivesStore.drives"
          :activeDriveId="activeDriveId"
          @select="handleDriveSelect"
        />
      </aside>

      <!-- Main content -->
      <main class="flex-1 bg-panel rounded-2xl overflow-y-auto min-w-0">
        <RouterView />
      </main>
    </div>
  </div>
</template>
