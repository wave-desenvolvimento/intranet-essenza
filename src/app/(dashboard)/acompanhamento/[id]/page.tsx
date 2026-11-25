import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Award, CheckCircle2, Circle, CircleDashed } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function UserTrainingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await requirePermission("treinamentos", "view");
  if (p.error) notFound();
  const supabase = await createClient();

  const { data: allowed } = await supabase.rpc("can_access_user", { _target: id, _module: "treinamentos", _action: "view" });
  if (!allowed) notFound();

  const [profileRes, modulesRes, pagesRes, progressRes, permsRes, certsRes] = await Promise.all([
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
    supabase.rpc("get_user_permissions", { _user_id: id }),
    supabase.from("course_certificates").select("id, page_slug").eq("user_id", id),
  ]);
  if (!profileRes.data) notFound();
  if (modulesRes.error || pagesRes.error || progressRes.error || permsRes.error || certsRes.error) throw new Error("Erro ao carregar os treinamentos do usuário");

  const franchise = Array.isArray(profileRes.data.franchise) ? profileRes.data.franchise[0] : profileRes.data.franchise;
  const progress = new Map(progressRes.data.map((r) => [r.video_id as string, r]));

  const modules = modulesRes.data.map((m) => ({
    ...m,
    lessons: m.course_videos
      .filter((v) => v.status === "published")
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((v) => ({ id: v.id, title: v.title, progress: progress.get(v.id) })),
  }));

  const certificates = new Map(certsRes.data.map((c) => [c.page_slug as string, c.id as string]));
  const accessible = new Set((permsRes.data || []).map((perm: { module: string }) => perm.module));
  const trainings = pagesRes.data
    .filter((page) => accessible.has(page.slug))
    .map((page) => {
      const pageModules = modules.filter((m) => m.page_slug === page.slug && m.lessons.length > 0);
      const lessons = pageModules.flatMap((m) => m.lessons);
      return { ...page, modules: pageModules, total: lessons.length, done: lessons.filter((l) => l.progress?.completed_at).length };
    })
    .filter((t) => t.total > 0);

  const lessons = trainings.flatMap((t) => t.modules.flatMap((m) => m.lessons));
  const doneLessons = lessons.filter((l) => l.progress?.completed_at).length;
  const startedLessons = lessons.filter((l) => l.progress && !l.progress.completed_at && l.progress.watched_pct > 0).length;
  const summary = [
    { label: "Aulas concluídas", value: `${doneLessons} de ${lessons.length}` },
    { label: "Em andamento", value: startedLessons },
    { label: "Não iniciadas", value: lessons.length - doneLessons - startedLessons },
    { label: "Treinamentos concluídos", value: `${trainings.filter((t) => t.done === t.total).length} de ${trainings.length}` },
  ];

  return (
    <div className="space-y-5">
      <Link href="/acompanhamento" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-700 transition-colors">
        <ArrowLeft size={14} />
        Voltar para Acompanhamento
      </Link>

      <div>
        <h1 className="text-lg font-semibold text-ink-900">Treinamentos de {profileRes.data.full_name}</h1>
        {franchise?.name && <p className="text-sm text-ink-500">{franchise.name}</p>}
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-ink-100 bg-ink-100 lg:grid-cols-4">
        {summary.map((s) => (
          <div key={s.label} className="bg-white px-4 py-3">
            <dt className="text-xs text-ink-500">{s.label}</dt>
            <dd className="text-lg font-semibold text-ink-900">{s.value}</dd>
          </div>
        ))}
      </dl>

      {trainings.length === 0 && (
        <p className="rounded-xl border border-ink-100 bg-white px-6 py-12 text-center text-sm text-ink-500">Nenhum treinamento publicado</p>
      )}

      {trainings.map((t) => (
        <section key={t.slug} className="rounded-xl border border-ink-100 bg-white overflow-hidden">
          <header className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3">
            <h2 className="flex items-center gap-3 text-sm font-semibold text-ink-900">
              {t.title}
              {certificates.has(t.slug) && (
                <Link href={`/certificado/${certificates.get(t.slug)}`} target="_blank" className="inline-flex items-center gap-1 text-xs font-medium text-brand-olive hover:underline">
                  <Award size={13} aria-hidden /> Ver certificado
                </Link>
              )}
            </h2>
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
