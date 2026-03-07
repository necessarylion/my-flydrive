import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:3000/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export interface Drive {
  id: string;
  name: string;
  type: "local" | "s3" | "gcs" | "azure";
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

// Drives
export const listDrives = () => api.get<Drive[]>("/drives");
export const getDrive = (id: string) => api.get<Drive>(`/drives/${id}`);
export const createDrive = (data: any) => api.post<Drive>("/drives", data);
export const updateDrive = (id: string, data: any) => api.put<Drive>(`/drives/${id}`, data);
export const deleteDrive = (id: string) => api.delete(`/drives/${id}`);

// Files
export const listFiles = (driveId: string, path = "") =>
  api.get<{ path: string; items: FileItem[] }>(`/files/${driveId}/list`, { params: { path } });

export const uploadFile = (driveId: string, file: File, path = "") => {
  const form = new FormData();
  form.append("file", file);
  return api.post(`/files/${driveId}/upload`, form, { params: { path } });
};

export const downloadFile = (driveId: string, path: string) =>
  api.get(`/files/${driveId}/download`, { params: { path }, responseType: "blob" });

export const deleteFile = (driveId: string, path: string) =>
  api.delete(`/files/${driveId}`, { params: { path } });

export const createFolder = (driveId: string, path: string) =>
  api.post(`/files/${driveId}/folder`, { path });
