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

  if (error) return { error: "Erro ao enviar arquivo." };

  const { data: urlData } = supabase.storage
    .from(options.bucket)
    .getPublicUrl(fileName);

  return { url: urlData.publicUrl };
}
