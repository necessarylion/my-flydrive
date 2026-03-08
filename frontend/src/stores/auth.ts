import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { loginApi, getMe } from '../api/client';
import { useDrivesStore } from './drives';
import { useFilesStore } from './files';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || '');
  const userEmail = ref('');
  const isAuthenticated = computed(() => !!token.value);
  const userInitial = computed(() => {
    const first = userEmail.value.charAt(0);
    return first ? first.toUpperCase() : '?';
  });

  async function login(email: string, password: string) {
    const { data } = await loginApi(email, password);
    token.value = data.token;
    localStorage.setItem('token', data.token);
    userEmail.value = email;
  }

  async function fetchMe() {
    if (!token.value) return;
    try {
      const { data } = await getMe();
      userEmail.value = data.email;
    } catch {
      // ignore
    }
  }

  function logout() {
    token.value = '';
    userEmail.value = '';
    localStorage.removeItem('token');

    // Clear other stores to prevent data leakage between sessions
    const drivesStore = useDrivesStore();
    drivesStore.drives = [];

    const filesStore = useFilesStore();
    filesStore.files = [];
    filesStore.currentPath = '';
    filesStore.searchQuery = '';
    filesStore.isSearching = false;
  }

  return { token, isAuthenticated, userEmail, userInitial, login, logout, fetchMe };
});
