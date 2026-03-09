import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || '';
    if (err.response?.status === 401 && !url.includes('/auth/')) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export interface Drive {
  id: string;
  name: string;
  type: 'local' | 's3' | 'gcs' | 'azure';
  isDefault: boolean;
  config?: any;
  createdAt: string;
  updatedAt: string;
}

export interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  lastModified?: string;
}

// Auth
export const loginApi = (email: string, password: string) =>
  api.post<{ token: string }>('/auth/login', { email, password });
export const getMe = () => api.get<{ email: string }>('/auth/me');

// Drives
export const listDrives = () => api.get<Drive[]>('/drives');
export const getDrive = (id: string) => api.get<Drive>(`/drives/${id}`);
export const createDrive = (data: any) => api.post<Drive>('/drives', data);
export const updateDrive = (id: string, data: any) => api.put<Drive>(`/drives/${id}`, data);
export const deleteDrive = (id: string) => api.delete(`/drives/${id}`);

// Files
export const listFiles = (driveId: string, path = '') =>
  api.get<{ path: string; items: FileItem[] }>(`/files/${driveId}/list`, { params: { path } });

const CHUNK_SIZE = 50 * 1024 * 1024; // 50MB

export const uploadFile = async (
  driveId: string,
  file: File,
  path = '',
  onProgress?: (progress: number) => void,
  onProcessing?: () => void,
) => {
  // Small files: direct upload
  if (file.size <= CHUNK_SIZE) {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/files/${driveId}/upload`, form, {
      params: { path },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      },
    });
  }

  // Large files: chunked upload
  const uploadId = crypto.randomUUID();
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const chunk = file.slice(start, start + CHUNK_SIZE);
    const form = new FormData();
    form.append('chunk', chunk);
    form.append('uploadId', uploadId);
    form.append('chunkIndex', String(i));
    form.append('totalChunks', String(totalChunks));
    form.append('fileName', file.name);
    await api.post(`/files/${driveId}/upload-chunk`, form, { params: { path } });
    if (onProgress) {
      onProgress(Math.round(((i + 1) / totalChunks) * 100));
    }
  }

  onProcessing?.();
  return api.post(
    `/files/${driveId}/upload-complete`,
    {
      uploadId,
      fileName: file.name,
      totalChunks,
    },
    { params: { path } },
  );
};

export const downloadFile = (driveId: string, path: string) =>
  api.get(`/files/${driveId}/download`, { params: { path }, responseType: 'blob' });

export const downloadFolder = (driveId: string, path: string) =>
  api.get(`/files/${driveId}/download-folder`, { params: { path }, responseType: 'blob' });

export const renameFile = (driveId: string, path: string, newName: string, isDirectory = false) =>
  api.patch(`/files/${driveId}/rename`, { path, newName, isDirectory });

export const deleteFile = (driveId: string, path: string, isDirectory = false) =>
  api.delete(`/files/${driveId}`, { params: { path, isDirectory } });

export const createFolder = (driveId: string, path: string) =>
  api.post(`/files/${driveId}/folder`, { path });

export const searchFiles = (driveId: string, query: string) =>
  api.get<{ query: string; items: FileItem[] }>(`/files/${driveId}/search`, {
    params: { q: query },
  });
