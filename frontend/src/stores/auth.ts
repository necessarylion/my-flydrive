import { defineStore } from "pinia";
import { ref, computed } from "vue";
import axios from "axios";

const api = axios.create({ baseURL: "http://localhost:3000/api" });

export const useAuthStore = defineStore("auth", () => {
  const token = ref(localStorage.getItem("token") || "");
  const isAuthenticated = computed(() => !!token.value);

  async function login(email: string, password: string) {
    const { data } = await api.post("/auth/login", { email, password });
    token.value = data.token;
    localStorage.setItem("token", data.token);
  }

  function logout() {
    token.value = "";
    localStorage.removeItem("token");
  }

  return { token, isAuthenticated, login, logout };
});
