"use client";

import imageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase/client";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];

interface UploadOptions {
  bucket: string;
  folder?: string;
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
}

/** Compress image if applicable */
async function compressIfImage(file: File, options: UploadOptions): Promise<File> {
  if (!IMAGE_TYPES.includes(file.type)) return file;

  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: options.maxSizeMB || 1,
      maxWidthOrHeight: options.maxWidthOrHeight || 1920,
      useWebWorker: true,
      fileType: "image/webp",
    });

    // Return as File with .webp extension
    const name = file.name.replace(/\.[^.]+$/, ".webp");
    return new File([compressed], name, { type: "image/webp" });
  } catch {
    // If compression fails, return original
    return file;
  }
}

/** Upload file directly to Supabase Storage (bypasses server action body limit) */
export async function uploadToStorage(
  file: File,
  options: UploadOptions
): Promise<{ url: string } | { error: string }> {
  const supabase = createClient();

  // Compress images
  const processedFile = await compressIfImage(file, options);

  // Generate unique filename
  const ext = processedFile.name.split(".").pop() || "bin";
  const folder = options.folder ? `${options.folder}/` : "";
  const fileName = `${folder}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  // Upload directly
  const { error } = await supabase.storage
    .from(options.bucket)
    .upload(fileName, processedFile, { upsert: false });

  if (error) return { error: error.message || "Erro ao enviar arquivo." };

  const { data: urlData } = supabase.storage
    .from(options.bucket)
    .getPublicUrl(fileName);

  return { url: urlData.publicUrl };
}

/** Upload file to Supabase Storage with progress callback via XHR.
 *  Returns the public URL. */
export async function uploadToStorageWithProgress(
  file: File,
  options: UploadOptions & { onProgress: (pct: number) => void },
): Promise<{ url: string } | { error: string }> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return { error: "Nao autenticado" };

  const processedFile = await compressIfImage(file, options);
  const ext = processedFile.name.split(".").pop() || "bin";
  const folder = options.folder ? `${options.folder}/` : "";
  const fileName = `${folder}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const url = `${SUPABASE_URL}/storage/v1/object/${options.bucket}/${fileName}`;

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) options.onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const { data: urlData } = supabase.storage.from(options.bucket).getPublicUrl(fileName);
        resolve({ url: urlData.publicUrl });
      } else {
        resolve({ error: `Erro no upload (${xhr.status})` });
      }
    });
    xhr.addEventListener("error", () => resolve({ error: "Erro de rede no upload" }));
    xhr.addEventListener("abort", () => resolve({ error: "Upload cancelado" }));
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.send(processedFile);
  });
}

/** Upload video to private course-videos bucket with progress callback.
 *  Returns the storage path (not a public URL - use signed URLs to access). */
export async function uploadVideoWithProgress(
  file: File,
  onProgress: (pct: number) => void,
): Promise<{ path: string } | { error: string }> {
  const supabase = createClient();

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return { error: "Nao autenticado" };

  const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const url = `${SUPABASE_URL}/storage/v1/object/course-videos/${fileName}`;

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ path: fileName });
      } else {
        resolve({ error: `Erro no upload (${xhr.status})` });
      }
    });

    xhr.addEventListener("error", () => {
      resolve({ error: "Erro de rede no upload" });
    });

    xhr.addEventListener("abort", () => {
      resolve({ error: "Upload cancelado" });
    });

    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.send(file);
  });
}
