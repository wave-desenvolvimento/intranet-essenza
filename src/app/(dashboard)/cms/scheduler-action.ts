"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function runScheduler() {
  const supabase = await createClient();

  // Auto-publish: draft items with published_at in the past
  const { data: published } = await supabase
    .from("cms_items")
    .update({ status: "published" })
    .eq("status", "draft")
    .not("published_at", "is", null)
    .lte("published_at", new Date().toISOString())
    .select("id");

  // Auto-expire: published items with expires_at in the past
  const { data: expired } = await supabase
    .from("cms_items")
    .update({ status: "archived" })
    .eq("status", "published")
    .not("expires_at", "is", null)
    .lte("expires_at", new Date().toISOString())
    .select("id");

  const result = {
    published: published?.length || 0,
    expired: expired?.length || 0,
    ranAt: new Date().toISOString(),
  };

  if (result.published > 0 || result.expired > 0) {
    revalidatePath("/cms");
    revalidatePath("/inicio");
  }

  return result;
}
