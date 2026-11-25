import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Circle, CircleDashed } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function UserTrainingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await requirePermission("usuarios", "view");
  if (p.error) notFound();
  const supabase = await createClient();

  const { data: allowed } = await supabase.rpc("can_manage_user", { _target: id, _action: "view" });
  if (!allowed) notFound();

  const [profileRes, modulesRes, pagesRes, progressRes] = await Promise.all([
    supabase.from("profiles").select("full_name, franchise:franchises(name)").eq("id", id).single(),
    supabase
      .from("course_modules")
      .select("id, title, page_slug, course_videos(id, title, sort_order, status)")
      .eq("status", "published")
      .order("sort_order"),
    supabase.from("cms_pages").select("slug, title, sort_order").order("sort_order"),
    supabase
      .from("lesson_progress")
      .select("video_id, watched_pct, completed_at, updated_at")
      .eq("user_id", id)
      .not("video_id", "is", null),
  ]);
  if (!profileRes.data) notFound();
  if (modulesRes.error || pagesRes.error || progressRes.error) throw new Error("Erro ao carregar os treinamentos do usuário");

  const franchise = Array.isArray(profileRes.data.franchise) ? profileRes.data.franchise[0] : profileRes.data.franchise;
  const progress = new Map(progressRes.data.map((r) => [r.video_id as string, r]));

  const modules = modulesRes.data.map((m) => ({
    ...m,
    lessons: m.course_videos
      .filter((v) => v.status === "published")
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((v) => ({ id: v.id, title: v.title, progress: progress.get(v.id) })),
  }));

  const trainings = pagesRes.data
    .map((page) => {
      const pageModules = modules.filter((m) => m.page_slug === page.slug && m.lessons.length > 0);
      const lessons = pageModules.flatMap((m) => m.lessons);
      return { ...page, modules: pageModules, total: lessons.length, done: lessons.filter((l) => l.progress?.completed_at).length };
    })
    .filter((t) => t.total > 0);

  return (
    <div className="space-y-5">
      <Link href="/usuarios" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-700 transition-colors">
        <ArrowLeft size={14} />
        Voltar para Usuários
      </Link>

      <div>
        <h1 className="text-lg font-semibold text-ink-900">Treinamentos de {profileRes.data.full_name}</h1>
        {franchise?.name && <p className="text-sm text-ink-500">{franchise.name}</p>}
      </div>

      {trainings.length === 0 && (
        <p className="rounded-xl border border-ink-100 bg-white px-6 py-12 text-center text-sm text-ink-500">Nenhum treinamento publicado</p>
      )}

      {trainings.map((t) => (
        <section key={t.slug} className="rounded-xl border border-ink-100 bg-white overflow-hidden">
          <header className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-ink-900">{t.title}</h2>
            <span className="text-xs text-ink-500">
              {t.done === t.total ? "Concluído" : `${t.done} de ${t.total} aulas concluídas`}
            </span>
          </header>
          {t.modules.map((m) => (
            <div key={m.id} className="border-b border-ink-50 last:border-0 px-4 py-3">
              <h3 className="mb-2 text-xs font-medium text-ink-500">{m.title}</h3>
              <ul className="space-y-2">
                {m.lessons.map((l) => {
                  const pct = l.progress?.completed_at ? 100 : l.progress?.watched_pct ?? 0;
                  const StatusIcon = l.progress?.completed_at ? CheckCircle2 : pct > 0 ? CircleDashed : Circle;
                  return (
                    <li key={l.id} className="flex items-center gap-3 text-sm">
                      <StatusIcon size={15} aria-hidden className={pct > 0 ? "text-brand-olive shrink-0" : "text-ink-300 shrink-0"} />
                      <span className="flex-1 min-w-0 truncate text-ink-700">{l.title}</span>
                      <progress value={pct} max={100} aria-label={`Progresso em ${l.title}`} className="hidden sm:block h-1.5 w-24 appearance-none overflow-hidden rounded-full bg-ink-100 [&::-webkit-progress-bar]:bg-ink-100 [&::-webkit-progress-value]:bg-brand-olive [&::-moz-progress-bar]:bg-brand-olive" />
                      <span className="w-40 shrink-0 text-right text-xs text-ink-500">
                        {l.progress?.completed_at
                          ? `Concluída em ${dateFormat.format(new Date(l.progress.completed_at))}`
                          : pct > 0 ? `Assistiu ${pct}%` : "Não iniciada"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
