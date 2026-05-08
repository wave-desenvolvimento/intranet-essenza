"use server";

import { createClient } from "@/lib/supabase/server";

const ALLOWED_BUCKETS = ["assets", "banners"];

export async function uploadFile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const file = formData.get("file") as File;
  const bucket = formData.get("bucket") as string || "assets";
  const folder = formData.get("folder") as string || "";

  if (!file) return { error: "Nenhum arquivo enviado." };
  if (!ALLOWED_BUCKETS.includes(bucket)) return { error: "Bucket não permitido." };

  const ext = file.name.split(".").pop();
  const fileName = `${folder ? folder + "/" : ""}${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(fileName, file, { upsert: false });

  if (error) return { error: "Erro ao enviar arquivo." };

  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(fileName);

  return { url: urlData.publicUrl };
}
