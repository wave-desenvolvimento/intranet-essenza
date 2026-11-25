import { createClient } from "@/lib/supabase/server";
import { TrainingOverview, type TrainingOverviewData } from "./training-overview";

/** Aba de treinamentos de uma franquia, ou null se o perfil nao tem a permissao. */
export async function getFranchiseTraining(userId: string, franchiseId: string) {
  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc("has_permission", { _user_id: userId, _module: "treinamentos", _action: "view" });
  if (!allowed) return null;

  const { data, error } = await supabase.rpc("training_overview", { _franchise_id: franchiseId });
  if (error) throw new Error("Erro ao carregar os treinamentos da franquia");
  return <TrainingOverview data={data as TrainingOverviewData} groupByFranchise={false} />;
}
