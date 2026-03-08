import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { loginApi, getMe } from "../api/client";

export const useAuthStore = defineStore("auth", () => {
  const token = ref(localStorage.getItem("token") || "");
  const userEmail = ref("");
  const isAuthenticated = computed(() => !!token.value);
  const userInitial = computed(() => {
    const first = userEmail.value.charAt(0);
    return first ? first.toUpperCase() : "?";
  });

  async function login(email: string, password: string) {
    const { data } = await loginApi(email, password);
    token.value = data.token;
    localStorage.setItem("token", data.token);
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
    token.value = "";
    userEmail.value = "";
    localStorage.removeItem("token");
  }

  return { token, isAuthenticated, userEmail, userInitial, login, logout, fetchMe };
});
