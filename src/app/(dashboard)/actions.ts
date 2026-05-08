"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  // Clear dev mode cookie on logout
  const { cookies } = await import("next/headers");
  const store = await cookies();
  store.delete("dev-view-mode");

  redirect("/login");
}
