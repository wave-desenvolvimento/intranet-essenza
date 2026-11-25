"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function setAppSetting(key: string, value: unknown) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key, value }, { onConflict: "key" });
  if (error) return { error: error.message };
  revalidatePath("/cms", "layout");
  revalidatePath("/pagina", "layout");
  return { success: true };
}
