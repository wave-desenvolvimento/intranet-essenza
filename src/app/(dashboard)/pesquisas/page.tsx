import { createClient } from "@/lib/supabase/server";
import { getSurveys } from "./actions";
import { SurveysManager } from "./surveys-manager";

export default async function PesquisasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const surveys = await getSurveys();

  const { data: canManage } = await supabase.rpc("has_permission", {
    _user_id: user?.id || "",
    _module: "pesquisas",
    _action: "create",
  });

  const { data: canViewAll } = await supabase.rpc("has_permission", {
    _user_id: user?.id || "",
    _module: "pesquisas",
    _action: "view_all",
  });

  return (
    <SurveysManager
      surveys={surveys}
      canManage={!!canManage}
      canViewAll={!!canViewAll}
      currentUserId={user?.id || ""}
    />
  );
}
