import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserScope, requirePermission } from "@/lib/permissions";
import { TrainingOverview, type TrainingOverviewData } from "./training-overview";

export default async function AcompanhamentoPage() {
  const p = await requirePermission("treinamentos", "view");
  if (p.error) notFound();
  const supabase = await createClient();
  const [scope, { data, error }] = await Promise.all([getUserScope(p.user!.id), supabase.rpc("training_overview")]);
  if (error) throw new Error("Erro ao carregar o acompanhamento de treinamentos");

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-ink-900">Acompanhamento de treinamentos</h1>
        <p className="text-sm text-ink-500">Clique no funcionário para ver aula por aula</p>
      </div>
      <TrainingOverview data={data as TrainingOverviewData} groupByFranchise={scope.isStaff} />
    </div>
  );
}
