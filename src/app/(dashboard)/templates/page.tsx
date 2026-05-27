import { createClient } from "@/lib/supabase/server";
import { getTemplates, getPublishedTemplates } from "./actions";
import { TemplatesModule } from "./templates-module";

export default async function TemplatesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || "";

  // Check permissions
  const { data: canView } = await supabase.rpc("has_permission", { _user_id: userId, _module: "templates", _action: "view" });
  const { data: canCreate } = await supabase.rpc("has_permission", { _user_id: userId, _module: "templates", _action: "create" });
  const { data: canEdit } = await supabase.rpc("has_permission", { _user_id: userId, _module: "templates", _action: "edit" });
  const { data: canDelete } = await supabase.rpc("has_permission", { _user_id: userId, _module: "templates", _action: "delete" });

  // Anyone with view permission sees all published; create/edit also sees drafts
  const canManage = !!(canCreate || canEdit);
  const templates = canManage ? await getTemplates() : canView ? await getPublishedTemplates() : [];

  // Get franchise data for rendering
  const { data: profile } = await supabase
    .from("profiles")
    .select("franchise:franchises(*)")
    .eq("id", userId)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawFranchise = profile?.franchise as any;
  const franchise = Array.isArray(rawFranchise) ? rawFranchise[0] : rawFranchise;

  return (
    <TemplatesModule
      templates={templates}
      canCreate={!!canCreate}
      canEdit={!!canEdit}
      canDelete={!!canDelete}
      franchiseData={franchise || null}
    />
  );
}
