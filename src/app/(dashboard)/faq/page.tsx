import { createClient } from "@/lib/supabase/server";
import { getFaqItems, getFaqCategories } from "./actions";
import { FaqManager } from "./faq-manager";

export default async function FaqPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [items, categories] = await Promise.all([getFaqItems(), getFaqCategories()]);

  const { data: canManage } = await supabase.rpc("has_permission", {
    _user_id: user?.id || "",
    _module: "faq",
    _action: "create",
  });

  return <FaqManager items={items} categories={categories} canManage={!!canManage} />;
}
