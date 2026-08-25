import { createClient } from "@/lib/supabase/server";
import { TemplatesModule } from "./templates-module";

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const { preview } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || "";

  // Permissoes + profile em paralelo
  const [canViewRes, canCreateRes, canEditRes, canDeleteRes, profileRes] = await Promise.all([
    supabase.rpc("has_permission", { _user_id: userId, _module: "templates", _action: "view" }),
    supabase.rpc("has_permission", { _user_id: userId, _module: "templates", _action: "create" }),
    supabase.rpc("has_permission", { _user_id: userId, _module: "templates", _action: "edit" }),
    supabase.rpc("has_permission", { _user_id: userId, _module: "templates", _action: "delete" }),
    supabase.from("profiles").select("franchise:franchises(*)").eq("id", userId).single(),
  ]);

  const canManage = !!(canCreateRes.data || canEditRes.data);

  // Templates: query direta sem server action
  const templatesQuery = canManage
    ? supabase.from("banner_templates").select("*").order("sort_order")
    : canViewRes.data
      ? supabase.from("banner_templates").select("*").eq("status", "published").order("sort_order")
      : null;

  const templates = templatesQuery ? (await templatesQuery).data || [] : [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawFranchise = profileRes.data?.franchise as any;
  const franchise = Array.isArray(rawFranchise) ? rawFranchise[0] : rawFranchise;

  return (
    <TemplatesModule
      templates={templates}
      canCreate={!!canCreateRes.data}
      canEdit={!!canEditRes.data}
      canDelete={!!canDeleteRes.data}
      franchiseData={franchise || null}
      initialPreviewId={preview || null}
    />
  );
}
