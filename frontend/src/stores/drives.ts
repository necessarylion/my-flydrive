import { defineStore } from "pinia";
import { ref } from "vue";
import { listDrives, createDrive, updateDrive, deleteDrive, type Drive } from "../api/client";

export const useDrivesStore = defineStore("drives", () => {
  const drives = ref<Drive[]>([]);
  const loading = ref(false);

  async function fetchDrives() {
    loading.value = true;
    try {
      const { data } = await listDrives();
      drives.value = data;
    } finally {
      loading.value = false;
    }
  }

  async function addDrive(payload: any) {
    const { data } = await createDrive(payload);
    drives.value.push(data);
    if (data.isDefault) {
      drives.value.forEach((d) => {
        if (d.id !== data.id) d.isDefault = false;
      });
    }
    return data;
  }

  async function editDrive(id: string, payload: any) {
    const { data } = await updateDrive(id, payload);
    const idx = drives.value.findIndex((d) => d.id === id);
    if (idx !== -1) drives.value[idx] = data;
    if (data.isDefault) {
      drives.value.forEach((d) => {
        if (d.id !== data.id) d.isDefault = false;
      });
    }
    return data;
  }

  async function removeDrive(id: string) {
    await deleteDrive(id);
    drives.value = drives.value.filter((d) => d.id !== id);
  }

  return { drives, loading, fetchDrives, addDrive, editDrive, removeDrive };
});
