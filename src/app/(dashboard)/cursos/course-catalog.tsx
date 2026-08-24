"use client";

import Link from "next/link";
import { Film, Play, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublishedModule } from "./course-actions";

export function CourseCatalog({ modules }: { modules: PublishedModule[] }) {
  const totalVideos = modules.reduce((sum, m) => sum + m.video_count, 0);
  const totalCompleted = modules.reduce((sum, m) => sum + m.completed_count, 0);
  const overallPct = totalVideos > 0 ? Math.round((totalCompleted / totalVideos) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-ink-900">Universo da Marca</h1>
        <p className="text-sm text-ink-500 mt-1">
          {modules.length} modulo{modules.length !== 1 ? "s" : ""} - {totalVideos} aula{totalVideos !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Overall progress */}
      {totalVideos > 0 && (
        <div className="rounded-xl border border-ink-100 bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-ink-700">Progresso geral</span>
            <span className="text-sm font-semibold text-brand-olive">{overallPct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-ink-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-brand-olive transition-all duration-500"
              style={{ width: `${overallPct}%` }}
            />
          </div>
          <p className="text-xs text-ink-400 mt-1.5">{totalCompleted} de {totalVideos} aulas concluidas</p>
        </div>
      )}

      {/* Modules grid */}
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
                </div>

                {/* Info */}
                <div className="flex flex-col flex-1 p-4">
                  <h3 className="text-sm font-semibold text-ink-900 line-clamp-2">{mod.title}</h3>
                  {mod.description && (
                    <p className="text-xs text-ink-500 mt-1 line-clamp-2">{mod.description}</p>
                  )}

                  <div className="mt-auto pt-3 space-y-2">
                    {/* Meta */}
                    <div className="flex items-center gap-3 text-xs text-ink-400">
                      <span className="flex items-center gap-1">
                        <Play size={11} />
                        {mod.video_count} aula{mod.video_count !== 1 ? "s" : ""}
                      </span>
                      {isStarted && !isComplete && (
                        <span className="flex items-center gap-1 text-brand-olive">
                          <Clock size={11} />
                          {mod.completed_count}/{mod.video_count}
                        </span>
                      )}
                    </div>

                    {/* Progress bar */}
                    {mod.video_count > 0 && (
                      <div className="h-1.5 w-full rounded-full bg-ink-100 overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            isComplete ? "bg-brand-olive" : pct > 0 ? "bg-brand-olive/70" : "bg-transparent"
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
