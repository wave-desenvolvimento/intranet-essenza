import { createClient } from "@/lib/supabase/server";
import { FaqManager } from "./faq-manager";

export default async function FaqPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || "";

  const [itemsRes, categoriesRes, canManageRes] = await Promise.all([
    supabase.from("faq_items").select("*, category:faq_categories(id, name, slug, icon)").order("sort_order"),
    supabase.from("faq_categories").select("*").order("sort_order"),
    supabase.rpc("has_permission", { _user_id: userId, _module: "faq", _action: "create" }),
  ]);

  return <FaqManager items={itemsRes.data || []} categories={categoriesRes.data || []} canManage={!!canManageRes.data} />;
}
