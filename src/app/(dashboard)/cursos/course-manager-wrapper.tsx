"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Settings, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { CourseManager } from "./course-manager";
import { coursePath } from "./course-path";
import { CourseCatalog } from "./course-catalog";
import { setCourseSettings, type CourseModule, type CourseCatalogData } from "./course-actions";

export function CourseManagerWithToggle({
  pageSlug,
  title,
  modules,
  catalogData,
  userName,
  userAvatar,
  canEdit,
  canView,
  sequential,
  certificate,
  certificateId,
  canConfigure,
}: {
  pageSlug: string;
  title: string;
  modules: CourseModule[];
  catalogData: CourseCatalogData;
  userName: string;
  userAvatar: string;
  canEdit: boolean;
  canView: boolean;
  sequential: boolean;
  certificate: boolean;
  certificateId: string | null;
  canConfigure: boolean;
}) {
  const [view, setView] = useState<"admin" | "preview">("admin");
  const [settings, setSettings] = useState({ sequential, certificate });
  const [isPending, startTransition] = useTransition();

  function changeSettings(change: Partial<typeof settings>) {
    const next = { ...settings, ...change };
    startTransition(async () => {
      const res = await setCourseSettings(pageSlug, next);
      if (res.error) { toast.error(res.error); return; }
      setSettings(next);
      toast.success("Configuração salva");
    });
  }

  const options = [
    {
      legend: "Como o funcionário assiste", name: "sequential" as const,
      choices: [
        { value: false, label: "Livre", hint: "abre qualquer aula, em qualquer ordem" },
        { value: true, label: "Aula por aula", hint: "só libera a próxima depois de concluir a anterior" },
      ],
    },
    {
      legend: "Certificado", name: "certificate" as const,
      choices: [
        { value: false, label: "Não gera", hint: "" },
        { value: true, label: "Gera certificado", hint: "ao concluir todas as aulas" },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="flex items-center gap-1 rounded-lg border border-ink-100 bg-white p-1 w-fit">
        <button
          onClick={() => setView("admin")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            view === "admin" ? "bg-ink-900 text-white" : "text-ink-500 hover:text-ink-700"
          )}
        >
          <Settings size={13} />
          Gerenciar
        </button>
        <button
          onClick={() => setView("preview")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            view === "preview" ? "bg-ink-900 text-white" : "text-ink-500 hover:text-ink-700"
          )}
        >
          <Eye size={13} />
          Visualizar como franqueado
        </button>
      </div>

      {view === "admin" && (
        <section aria-label="Configuração do treinamento" className="rounded-xl border border-ink-100 bg-white px-4 py-3">
          <div className="grid gap-4 lg:grid-cols-2">
            {options.map((option) => (
              <fieldset key={option.name} disabled={!canConfigure || isPending}>
                <legend className="mb-1.5 text-xs font-medium text-ink-700">{option.legend}</legend>
                <div className="flex flex-col gap-1.5">
                  {option.choices.map((choice) => (
                    <label key={choice.label} className={cn("flex items-center gap-2 text-sm text-ink-900", canConfigure ? "cursor-pointer" : "opacity-60")}>
                      <input
                        type="radio"
                        name={option.name}
                        checked={settings[option.name] === choice.value}
                        onChange={() => changeSettings({ [option.name]: choice.value })}
                        className="accent-brand-olive"
                      />
                      <span>{choice.label} {choice.hint && <span className="text-xs text-ink-500">({choice.hint})</span>}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
          {!canConfigure && <p className="mt-2 text-xs text-ink-500">Seu perfil não tem permissão para alterar esta configuração.</p>}
          {settings.sequential && <p className="mt-2 text-xs text-ink-500">Vídeos do YouTube ainda podem ser adiantados. Para impedir, use upload.</p>}
        </section>
      )}

      {view === "admin" ? (
        <CourseManager pageSlug={pageSlug} title={title} modules={modules} canEdit={canEdit} canView={canView} />
      ) : (
        <CourseCatalog basePath={coursePath(pageSlug)} data={catalogData} userName={userName} userAvatar={userAvatar} hasCertificate={settings.certificate} certificateId={certificateId} />
      )}
    </div>
  );
}
