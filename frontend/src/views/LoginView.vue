<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import appLogo from '../assets/local.svg'
import { HugeiconsIcon } from '@hugeicons/vue'
import { ViewIcon, ViewOffIcon } from '@hugeicons/core-free-icons'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const showPassword = ref(false)

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    await authStore.login(email.value, password.value)
    router.push('/')
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Login failed'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex font-sans">
    <!-- Left panel - decorative -->
    <div class="hidden lg:flex lg:w-1/2 bg-linear-to-br from-blue-600 via-blue-500 to-cyan-400 relative overflow-hidden">
      <div class="absolute inset-0">
        <div class="absolute top-1/4 -left-20 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
        <div class="absolute bottom-1/4 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
      </div>

      <div class="relative z-10 flex flex-col justify-center px-16 text-white">
        <img :src="appLogo" class="w-16 h-16 mb-8 drop-shadow-lg" alt="My Flydrive" />
        <h1 class="text-4xl font-bold mb-4 leading-tight">
          Welcome to<br />My Flydrive
        </h1>
        <p class="text-lg text-white/80 max-w-md leading-relaxed">
          Manage your files across multiple storage providers — local, S3, GCS, and Azure — all in one place.
        </p>

        <div class="mt-12 flex gap-6">
          <div class="flex items-center gap-2 text-white/70 text-sm">
            <div class="w-2 h-2 rounded-full bg-green-300"></div>
            Multi-provider
          </div>
          <div class="flex items-center gap-2 text-white/70 text-sm">
            <div class="w-2 h-2 rounded-full bg-yellow-300"></div>
            Secure
          </div>
          <div class="flex items-center gap-2 text-white/70 text-sm">
            <div class="w-2 h-2 rounded-full bg-cyan-300"></div>
            Fast
          </div>
        </div>
      </div>
    </div>

    <!-- Right panel - login form -->
    <div class="flex-1 flex items-center justify-center bg-page px-6">
      <div class="w-full max-w-sm">
        <!-- Mobile logo -->
        <div class="flex items-center justify-center gap-3 mb-10 lg:hidden">
          <img :src="appLogo" class="w-10 h-10" alt="My Flydrive" />
          <span class="text-xl text-body font-semibold tracking-tight">My Flydrive</span>
        </div>

        <div>
          <h2 class="text-2xl font-bold text-heading mb-1">Sign in</h2>
          <p class="text-sm text-subtle mb-8">Enter your credentials to access your drives</p>

          <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0 -translate-y-1"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 -translate-y-1"
          >
            <div v-if="error" class="mb-4 flex items-start gap-2 text-red-600 text-sm bg-red-50 dark:bg-red-900/20 rounded-2xl p-4">
              <svg class="w-5 h-5 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
              {{ error }}
            </div>
          </Transition>

          <form @submit.prevent="handleLogin" class="space-y-5">
            <div>
              <label class="block text-sm font-medium text-body mb-1.5">Email</label>
              <input
                v-model="email"
                type="email"
                required
                autofocus
                placeholder="admin@mydrive.com"
                class="w-full px-4 py-3 bg-input-bg rounded-2xl text-sm outline-none placeholder-muted text-heading focus:ring-2 focus:ring-blue-500/30 transition-all"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-body mb-1.5">Password</label>
              <div class="relative">
                <input
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  required
                  placeholder="Enter password"
                  class="w-full px-4 py-3 bg-input-bg rounded-2xl text-sm outline-none placeholder-muted text-heading focus:ring-2 focus:ring-blue-500/30 transition-all pr-11"
                />
                <button
                  type="button"
                  @click="showPassword = !showPassword"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabindex="-1"
                >
                  <HugeiconsIcon :icon="showPassword ? ViewOffIcon : ViewIcon" :size="18" />
                </button>
              </div>
            </div>

            <button
              type="submit"
              :disabled="loading"
              class="w-full py-3 bg-blue-600 text-white rounded-2xl text-sm font-medium hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100"
            >
              <span v-if="loading" class="flex items-center justify-center gap-2">
                <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Signing in...
              </span>
              <span v-else>Sign in</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
