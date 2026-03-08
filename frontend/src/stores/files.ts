import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  listFiles,
  uploadFile,
  downloadFile,
  downloadFolder as downloadFolderApi,
  renameFile,
  deleteFile,
  createFolder,
  searchFiles as searchFilesApi,
  type FileItem,
} from '../api/client';

export const useFilesStore = defineStore('files', () => {
  const files = ref<FileItem[]>([]);
  const currentPath = ref('');
  const loading = ref(false);
  const currentDriveId = ref('');
  const searchQuery = ref('');
  const isSearching = ref(false);

  interface UploadItem {
    name: string;
    progress: number;
    status: 'uploading' | 'processing' | 'done' | 'error';
  }
  const uploads = ref<UploadItem[]>([]);

  async function fetchFiles(driveId: string, path = '') {
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

  async function uploadMultiple(files: File[]) {
    const startIdx = uploads.value.length;
    uploads.value.push(
      ...files.map((f) => ({ name: f.name, progress: 0, status: 'uploading' as const })),
    );

    await Promise.all(
      files.map(async (f, i) => {
        const idx = startIdx + i;
        const item = uploads.value[idx];
        if (!item) return;
        try {
          await uploadFile(
            currentDriveId.value,
            f,
            currentPath.value,
            (p) => {
              item.progress = p;
            },
            () => {
              item.status = 'processing';
            },
          );
          item.status = 'done';
          item.progress = 100;
        } catch {
          item.status = 'error';
        }
      }),
    );

    await fetchFiles(currentDriveId.value, currentPath.value);

    setTimeout(() => {
      uploads.value = uploads.value.filter(
        (u) => u.status === 'uploading' || u.status === 'processing',
      );
    }, 2000);
  }

  function triggerBlobDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function download(path: string) {
    const { data } = await downloadFile(currentDriveId.value, path);
    triggerBlobDownload(data, path.split('/').pop() || 'file');
  }

  async function downloadFolder(path: string) {
    const { data } = await downloadFolderApi(currentDriveId.value, path);
    triggerBlobDownload(data, (path.split('/').filter(Boolean).pop() || 'download') + '.zip');
  }

  async function rename(path: string, newName: string, isDirectory = false) {
    await renameFile(currentDriveId.value, path, newName, isDirectory);
    await fetchFiles(currentDriveId.value, currentPath.value);
  }

  async function remove(path: string, isDirectory = false) {
    await deleteFile(currentDriveId.value, path, isDirectory);
    await fetchFiles(currentDriveId.value, currentPath.value);
  }

  async function addFolder(name: string) {
    const folderPath = currentPath.value ? `${currentPath.value}/${name}` : name;
    await createFolder(currentDriveId.value, folderPath);
    await fetchFiles(currentDriveId.value, currentPath.value);
  }

  async function search(query: string) {
    if (!query.trim()) {
      clearSearch();
      return;
    }
    loading.value = true;
    searchQuery.value = query;
    isSearching.value = true;
    try {
      const { data } = await searchFilesApi(currentDriveId.value, query);
      files.value = data.items;
    } finally {
      loading.value = false;
    }
  }

  function clearSearch() {
    searchQuery.value = '';
    isSearching.value = false;
    fetchFiles(currentDriveId.value, currentPath.value);
  }

  function navigateTo(path: string) {
    searchQuery.value = '';
    isSearching.value = false;
    fetchFiles(currentDriveId.value, path);
  }

  function navigateUp() {
    const parts = currentPath.value.split('/').filter(Boolean);
    parts.pop();
    fetchFiles(currentDriveId.value, parts.join('/'));
  }

  return {
    files,
    currentPath,
    loading,
    currentDriveId,
    searchQuery,
    isSearching,
    uploads,
    fetchFiles,
    upload,
    uploadMultiple,
    download,
    downloadFolder,
    rename,
    remove,
    addFolder,
    search,
    clearSearch,
    navigateTo,
    navigateUp,
  };
});
