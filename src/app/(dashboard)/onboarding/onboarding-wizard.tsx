"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sparkles, ArrowRight, Check, Palette, FileText, Download,
  Megaphone, Image, Video, GraduationCap, Layers, Folder,
} from "lucide-react";
import { completeOnboarding } from "./actions";
import { cn } from "@/lib/utils";
import { getIconComponent } from "@/components/ui/icon-picker";

const ICON_MAP: Record<string, React.ElementType> = {
  palette: Palette, file: FileText, megaphone: Megaphone,
  image: Image, video: Video, "graduation-cap": GraduationCap,
  layers: Layers, folder: Folder,
};

interface Props {
  userName: string;
  franchiseName?: string;
  pages: { title: string; slug: string; icon: string }[];
}

const STEPS = [
  { id: "welcome", title: "Boas-vindas" },
  { id: "tour", title: "Conheça o Hub" },
  { id: "ready", title: "Pronto!" },
];

export function OnboardingWizard({ userName, franchiseName, pages }: Props) {
  const [step, setStep] = useState(0);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const firstName = userName.split(" ")[0];

  function next() { setStep((s) => Math.min(s + 1, STEPS.length - 1)); }
  function prev() { setStep((s) => Math.max(s - 1, 0)); }

  function finish() {
    startTransition(async () => {
      await completeOnboarding();
      router.push("/inicio");
    });
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors",
                i < step ? "bg-brand-olive text-white" :
                i === step ? "bg-brand-olive text-white ring-4 ring-brand-olive/20" :
                "bg-ink-100 text-ink-400"
              )}>
                {i < step ? <Check size={12} strokeWidth={3} /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn("h-0.5 w-8 rounded-full", i < step ? "bg-brand-olive" : "bg-ink-100")} />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="rounded-2xl border border-ink-100 bg-white shadow-card overflow-hidden">
          {step === 0 && (
            <div className="px-8 py-10 text-center">
              <div className="flex justify-center mb-5">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-olive-soft">
                  <Sparkles size={28} className="text-brand-olive" />
                </div>
              </div>
              <h1 className="text-xl font-semibold text-ink-900 mb-2">
                Bem-vindo, {firstName}!
              </h1>
              <p className="text-sm text-ink-500 mb-1">
                {franchiseName
                  ? `Você faz parte da ${franchiseName}.`
                  : "Você agora faz parte da rede Essenza."
                }
              </p>
              <p className="text-sm text-ink-500 mb-8">
                Este é seu Hub de Marca — aqui você encontra tudo para sua loja.
              </p>

              <div className="grid grid-cols-3 gap-3 mb-8">
                {[
                  { icon: FileText, label: "Materiais" },
                  { icon: Download, label: "Downloads" },
                  { icon: GraduationCap, label: "Treinamentos" },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl bg-ink-50 px-3 py-4 text-center">
                    <item.icon size={20} className="text-brand-olive mx-auto mb-1.5" />
                    <p className="text-[11px] font-medium text-ink-700">{item.label}</p>
                  </div>
                ))}
              </div>

              <button onClick={next} className="flex items-center gap-2 mx-auto rounded-xl bg-brand-olive px-6 py-3 text-sm font-medium text-white hover:bg-brand-olive-dark transition-colors">
                Vamos começar <ArrowRight size={14} />
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="px-8 py-10">
              <h2 className="text-lg font-semibold text-ink-900 mb-1 text-center">Conheça as seções</h2>
              <p className="text-sm text-ink-500 mb-6 text-center">Aqui está o que você pode acessar:</p>

              <div className="grid gap-2 mb-8">
                {pages.map((page) => {
                  const Icon = (getIconComponent(page.icon) as React.ElementType) || ICON_MAP[page.icon] || Folder;
                  return (
                    <div key={page.slug} className="flex items-center gap-3 rounded-xl border border-ink-100 px-4 py-3 hover:bg-ink-50/50 transition-colors">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-olive-soft">
                        <Icon size={16} className="text-brand-olive" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-ink-900">{page.title}</p>
                        <p className="text-[10px] text-ink-400">/pagina/{page.slug}</p>
                      </div>
                    </div>
                  );
                })}
                {pages.length === 0 && (
                  <p className="text-xs text-ink-400 text-center py-4">As seções serão configuradas pelo administrador.</p>
                )}
              </div>

              <div className="flex gap-3 justify-center">
                <button onClick={prev} className="rounded-xl border border-ink-100 px-5 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50 transition-colors">Voltar</button>
                <button onClick={next} className="flex items-center gap-2 rounded-xl bg-brand-olive px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-olive-dark transition-colors">
                  Próximo <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="px-8 py-10 text-center">
              <div className="flex justify-center mb-5">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-success-soft">
                  <Check size={28} className="text-success" strokeWidth={3} />
                </div>
              </div>
              <h2 className="text-xl font-semibold text-ink-900 mb-2">Tudo pronto!</h2>
              <p className="text-sm text-ink-500 mb-8">
                Seu hub está configurado. Explore os materiais e mantenha sua loja sempre atualizada.
              </p>

              <div className="flex gap-3 justify-center">
                <button onClick={prev} className="rounded-xl border border-ink-100 px-5 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50 transition-colors">Voltar</button>
                <button
                  onClick={finish}
                  disabled={isPending}
                  className="flex items-center gap-2 rounded-xl bg-brand-olive px-6 py-3 text-sm font-medium text-white hover:bg-brand-olive-dark disabled:opacity-50 transition-colors"
                >
                  {isPending ? "Entrando..." : "Ir para o Dashboard"} <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Skip */}
        {step < 2 && (
          <button onClick={finish} disabled={isPending} className="block mx-auto mt-4 text-xs text-ink-400 hover:text-ink-600 transition-colors">
            Pular introdução
          </button>
        )}
      </div>
    </div>
  );
}
