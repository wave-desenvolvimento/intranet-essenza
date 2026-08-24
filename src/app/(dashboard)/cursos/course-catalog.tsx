"use client";

import Link from "next/link";
import { Film, Play, CheckCircle2, Clock, Award, Lock, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CourseCatalogData } from "./course-actions";

function formatDurationHuman(seconds: number): string {
  if (seconds <= 0) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}min`;
  if (h > 0) return `${h}h`;
  return `${m}min`;
}

export function CourseCatalog({
  data,
  userName,
  userAvatar,
}: {
  data: CourseCatalogData;
  userName: string;
  userAvatar: string;
}) {
  const { modules, continueWatching, totalCompleted, totalVideos, totalDurationSeconds } = data;
  const overallPct = totalVideos > 0 ? Math.round((totalCompleted / totalVideos) * 100) : 0;
  const completedDuration = totalDurationSeconds > 0 && totalVideos > 0
    ? Math.round((totalCompleted / totalVideos) * totalDurationSeconds)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header - Bem-vindo */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-brand-olive/10 overflow-hidden flex items-center justify-center shrink-0">
          {userAvatar ? (
            <img src={userAvatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-lg font-bold text-brand-olive">
              {userName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div>
          <h1 className="text-lg font-bold text-ink-900">Bem-vindo(a), {userName}</h1>
          <p className="text-sm text-ink-500">Continue sua jornada de aprendizado</p>
        </div>
      </div>

      {/* Stats card */}
      {totalVideos > 0 && (
        <div className="rounded-xl border border-ink-100 bg-white p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink-900">Seu progresso</p>
              <p className="text-xs text-ink-500 mt-0.5">Continue assistindo para concluir todos os modulos</p>
            </div>

            <div className="flex items-center gap-6">
              {/* Progress ring */}
              <div className="relative h-14 w-14 shrink-0">
                <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
                  <path
                    d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831 15.9155 15.9155 0 0 1 0-31.831"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="3"
                  />
                  <path
                    d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831 15.9155 15.9155 0 0 1 0-31.831"
                    fill="none"
                    stroke="#6b7f3e"
                    strokeWidth="3"
                    strokeDasharray={`${overallPct}, 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-ink-900">
                  {overallPct}%
                </span>
              </div>

              <div className="flex flex-col gap-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-olive" />
                  <span className="text-ink-600">
                    {totalCompleted}/{totalVideos} aulas concluidas
                  </span>
                </div>
                {totalDurationSeconds > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    <span className="text-ink-600">
                      {formatDurationHuman(completedDuration)}/{formatDurationHuman(totalDurationSeconds)} no curso
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Continue de onde parou */}
      {continueWatching && (
        <div>
          <h2 className="text-sm font-semibold text-ink-900 mb-3">
            {continueWatching.watched_pct > 0 ? "Retomar de onde parou" : "Iniciar proximo curso"}
          </h2>
          <Link
            href={`/cursos/${continueWatching.module_slug}`}
            className="group flex items-center gap-4 rounded-xl border border-ink-100 bg-white p-4 hover:border-brand-olive/30 hover:shadow-sm transition-all"
          >
            {/* Thumbnail */}
            <div className="relative h-16 w-28 rounded-lg bg-ink-50 overflow-hidden shrink-0 flex items-center justify-center">
              {continueWatching.module_cover_url ? (
                <img src={continueWatching.module_cover_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <Film size={20} className="text-ink-200" />
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play size={14} className="text-ink-700 ml-0.5" />
                </div>
              </div>
              {/* Mini progress bar */}
              {continueWatching.watched_pct > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
                  <div className="h-full bg-brand-olive" style={{ width: `${continueWatching.watched_pct}%` }} />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs text-ink-500">{continueWatching.module_title}</p>
              <p className="text-sm font-medium text-ink-900 truncate">{continueWatching.video_title}</p>
              <p className="text-xs text-ink-400 mt-0.5">
                Aula {continueWatching.video_index + 1} de {continueWatching.video_total}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="hidden sm:inline text-xs font-medium text-brand-olive group-hover:underline">
                {continueWatching.watched_pct > 0 ? "Continuar" : "Iniciar"}
              </span>
              <ArrowRight size={16} className="text-brand-olive" />
            </div>
          </Link>
        </div>
      )}

      {/* Modulos disponiveis */}
      <div>
        <h2 className="text-sm font-semibold text-ink-900 mb-3">Modulos disponiveis</h2>
        {modules.length === 0 ? (
          <div className="rounded-xl border border-ink-100 bg-white px-6 py-16 text-center">
            <Film size={40} className="mx-auto text-ink-200 mb-3" />
            <p className="text-sm text-ink-500">Nenhum curso disponivel no momento</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((mod) => {
              const pct = mod.video_count > 0 ? Math.round((mod.completed_count / mod.video_count) * 100) : 0;
              const isComplete = pct === 100 && mod.video_count > 0;
              const isStarted = mod.completed_count > 0;

              return (
                <Link
                  key={mod.id}
                  href={`/cursos/${mod.slug}`}
                  className="group flex flex-col rounded-xl border border-ink-100 bg-white overflow-hidden hover:border-ink-200 hover:shadow-sm transition-all"
                >
                  {/* Cover */}
                  <div className="relative aspect-video bg-ink-50 overflow-hidden">
                    {mod.cover_url ? (
                      <img
                        src={mod.cover_url}
                        alt=""
                        className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <Film size={36} className="text-ink-200" />
                      </div>
                    )}

                    {/* Play overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
                      <div className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-full transition-all",
                        "bg-white/90 shadow-lg opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
                      )}>
                        <Play size={20} className="text-ink-700 ml-0.5" />
                      </div>
                    </div>

                    {/* Status badge */}
                    {isComplete && (
                      <div className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full bg-brand-olive px-2.5 py-1 text-[10px] font-semibold text-white">
                        <CheckCircle2 size={12} />
                        Concluido
                      </div>
                    )}

                    {/* Progress bar on cover */}
                    {isStarted && !isComplete && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
                        <div className="h-full bg-brand-olive" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex flex-col flex-1 p-4">
                    <h3 className="text-sm font-semibold text-ink-900 line-clamp-2">{mod.title}</h3>
                    {mod.description && (
                      <p className="text-xs text-ink-500 mt-1 line-clamp-2">{mod.description}</p>
                    )}

                    <div className="mt-auto pt-3">
                      <div className="flex items-center gap-3 text-xs text-ink-400">
                        <span className="flex items-center gap-1">
                          <Play size={11} />
                          {mod.video_count} aula{mod.video_count !== 1 ? "s" : ""}
                        </span>
                        {mod.total_duration_seconds > 0 && (
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            {formatDurationHuman(mod.total_duration_seconds)}
                          </span>
                        )}
                        {isStarted && (
                          <span className="ml-auto text-brand-olive font-medium">
                            {pct}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Meus certificados - em breve */}
      <div>
        <h2 className="text-sm font-semibold text-ink-900 mb-3">Meus certificados</h2>
        <div className="rounded-xl border border-ink-100 bg-white p-6 flex items-center gap-4 opacity-60">
          <div className="h-12 w-12 rounded-full bg-ink-50 flex items-center justify-center shrink-0">
            <Award size={22} className="text-ink-300" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-ink-700">Certificados</p>
            <p className="text-xs text-ink-400 mt-0.5">Conclua os modulos para gerar seus certificados</p>
          </div>
          <Lock size={16} className="text-ink-300 shrink-0" />
        </div>
      </div>
    </div>
  );
}
