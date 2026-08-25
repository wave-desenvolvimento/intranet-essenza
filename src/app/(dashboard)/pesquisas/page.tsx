import { createClient } from "@/lib/supabase/server";
import { SurveysManager } from "./surveys-manager";

export default async function PesquisasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || "";

  const [surveysRes, canManageRes, canViewAllRes] = await Promise.all([
    supabase
      .from("surveys")
      .select("*, questions:survey_questions(id, label, type, options, required, sort_order), responses:survey_responses(id, score, comment, user_id, franchise_id, created_at, franchise:franchises(name), answers:survey_answers(question_id, value))")
      .order("created_at", { ascending: false }),
    supabase.rpc("has_permission", { _user_id: userId, _module: "pesquisas", _action: "create" }),
    supabase.rpc("has_permission", { _user_id: userId, _module: "pesquisas", _action: "view_all" }),
  ]);

  const surveys = (surveysRes.data || []).map((s) => ({
    ...s,
    questions: (s.questions || []).sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order),
  }));

  return (
    <SurveysManager
      surveys={surveys}
      canManage={!!canManageRes.data}
      canViewAll={!!canViewAllRes.data}
      currentUserId={userId}
    />
  );
}
