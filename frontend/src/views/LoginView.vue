<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

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
  <div class="min-h-screen bg-[#f0f4f9] flex items-center justify-center font-sans">
    <div class="w-full max-w-sm">
      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <!-- Logo -->
        <div class="flex items-center justify-center gap-2.5 mb-8">
          <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
            <svg class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2v11z"/>
            </svg>
          </div>
          <span class="text-2xl text-gray-700 font-medium tracking-tight">Drive</span>
        </div>

        <h2 class="text-lg font-semibold text-gray-900 text-center mb-1">Sign in</h2>
        <p class="text-sm text-gray-500 text-center mb-6">to continue to My Drive</p>

        <form @submit.prevent="handleLogin" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              v-model="email"
              type="email"
              required
              autofocus
              placeholder="admin@mydrive.com"
              class="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              v-model="password"
              type="password"
              required
              placeholder="Enter password"
              class="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>

          <div v-if="error" class="text-red-600 text-sm bg-red-50 rounded-lg p-3">{{ error }}</div>

          <button
            type="submit"
            :disabled="loading"
            class="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {{ loading ? 'Signing in...' : 'Sign in' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
