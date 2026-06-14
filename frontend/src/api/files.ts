import { type TokenGetter } from './client';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

// A file uploaded via POST /files. `url` is a CloudFront signed URL valid until
// `expiresAt` (the backend mints and stores it at upload time).
export type UploadedFile = {
  id: string;
  key: string;
  originalName: string;
  contentType: string;
  size: number;
  url: string;
  expiresAt: string;
  createdAt: string;
};

export const filesApi = {
  // Uploads one file as multipart/form-data (field "file"). We must NOT set a
  // Content-Type header — the browser adds the multipart boundary itself.
  upload: async (getToken: TokenGetter, file: File): Promise<UploadedFile> => {
    const token = await getToken();
    const form = new FormData();
    form.append('file', file);

    const res = await fetch(`${API_URL}/files`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? `Upload failed (${res.status})`);
    }
    return (await res.json()) as UploadedFile;
  },
};
