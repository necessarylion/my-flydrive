import { defineStore } from "pinia";
import { ref } from "vue";
import { listFiles, uploadFile, downloadFile, deleteFile, createFolder, type FileItem } from "../api/client";

export const useFilesStore = defineStore("files", () => {
  const files = ref<FileItem[]>([]);
  const currentPath = ref("");
  const loading = ref(false);
  const currentDriveId = ref("");

  async function fetchFiles(driveId: string, path = "") {
    loading.value = true;
    currentDriveId.value = driveId;
    currentPath.value = path;
    try {
      const { data } = await listFiles(driveId, path);
      files.value = data.items;
    } finally {
      loading.value = false;
    }
  }

  async function upload(file: File) {
    await uploadFile(currentDriveId.value, file, currentPath.value);
    await fetchFiles(currentDriveId.value, currentPath.value);
  }

  async function download(path: string) {
    const { data } = await downloadFile(currentDriveId.value, path);
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = path.split("/").pop() || "file";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function remove(path: string) {
    await deleteFile(currentDriveId.value, path);
    await fetchFiles(currentDriveId.value, currentPath.value);
  }

  async function addFolder(name: string) {
    const folderPath = currentPath.value ? `${currentPath.value}/${name}` : name;
    await createFolder(currentDriveId.value, folderPath);
    await fetchFiles(currentDriveId.value, currentPath.value);
  }

  function navigateTo(path: string) {
    fetchFiles(currentDriveId.value, path);
  }

  function navigateUp() {
    const parts = currentPath.value.split("/").filter(Boolean);
    parts.pop();
    fetchFiles(currentDriveId.value, parts.join("/"));
  }

  return { files, currentPath, loading, currentDriveId, fetchFiles, upload, download, remove, addFolder, navigateTo, navigateUp };
});
