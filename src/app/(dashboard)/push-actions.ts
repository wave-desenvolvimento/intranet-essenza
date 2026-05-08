"use server";

import { createClient } from "@/lib/supabase/server";

export async function subscribePush(subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  // Validate subscription input
  if (
    !subscription?.endpoint ||
    !subscription.endpoint.startsWith("https://") ||
    !subscription.keys?.p256dh ||
    !subscription.keys?.auth
  ) {
    return { error: "Subscription inválida" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { error } = await supabase.from("push_subscriptions").upsert({
    user_id: user.id,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
  }, { onConflict: "user_id,endpoint" });

  if (error) return { error: error.message };
  return { success: true };
}

export async function unsubscribePush(endpoint: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  await supabase.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", endpoint);
  return { success: true };
}
