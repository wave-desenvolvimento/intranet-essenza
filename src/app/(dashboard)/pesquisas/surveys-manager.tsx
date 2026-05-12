"use client";

import { useState, useTransition } from "react";
import {
  Plus, Trash2, BarChart3, MessageSquare, Star, Send,
  ChevronDown, Power, PowerOff, Clock,
} from "lucide-react";
import { createSurvey, deleteSurvey, toggleSurvey, submitResponse } from "./actions";
import { cn } from "@/lib/utils";
import { Sheet } from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Survey { [key: string]: any; }

interface Props {
  surveys: Survey[];
  canManage: boolean;
  canViewAll: boolean;
  currentUserId: string;
}

function calcNps(responses: { score: number }[]) {
  if (responses.length === 0) return { nps: 0, promoters: 0, passives: 0, detractors: 0, total: 0 };
  const promoters = responses.filter((r) => r.score >= 9).length;
  const detractors = responses.filter((r) => r.score <= 6).length;
  const passives = responses.length - promoters - detractors;
  const nps = Math.round(((promoters - detractors) / responses.length) * 100);
  return { nps, promoters, passives, detractors, total: responses.length };
}

function npsColor(nps: number) {
  if (nps >= 50) return "text-success";
  if (nps >= 0) return "text-warning";
  return "text-danger";
}

function npsBg(nps: number) {
  if (nps >= 50) return "bg-success-soft";
  if (nps >= 0) return "bg-warning-soft";
  return "bg-danger-soft";
}

export function SurveysManager({ surveys, canManage, canViewAll, currentUserId }: Props) {
  const { confirm: confirmAction, dialogProps } = useConfirm();
  const [showSheet, setShowSheet] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Response form
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");

  function openCreate() {
    setTitle(""); setDescription(""); setEndsAt(""); setError(""); setShowSheet(true);
  }

  function handleSave() {
    const fd = new FormData();
    fd.set("title", title); fd.set("description", description);
    fd.set("endsAt", endsAt);
    startTransition(async () => {
      const r = await createSurvey(fd);
      if (r?.error) setError(r.error); else setShowSheet(false);
    });
  }

  async function handleDelete(id: string) {
    const ok = await confirmAction({ title: "Remover pesquisa", message: "Todas as respostas serão perdidas.", confirmLabel: "Remover", destructive: true });
    if (!ok) return;
    startTransition(async () => { const r = await deleteSurvey(id); if (r?.error) setError(r.error); });
  }

  function handleToggle(id: string, active: boolean) {
    startTransition(async () => { await toggleSurvey(id, active); });
  }

  function handleSubmitResponse(surveyId: string) {
    if (score === null) return;
    startTransition(async () => {
      const r = await submitResponse(surveyId, score, comment);
      if (r?.error) setError(r.error);
      else { setRespondingId(null); setScore(null); setComment(""); }
    });
  }

  function hasResponded(survey: Survey): boolean {
    return (survey.responses || []).some((r: { user_id: string }) => r.user_id === currentUserId);
  }

  function isExpired(survey: Survey): boolean {
    return survey.ends_at && new Date(survey.ends_at) < new Date();
  }

  const activeSurveys = surveys.filter((s) => s.active && !isExpired(s));
  const inactiveSurveys = surveys.filter((s) => !s.active || isExpired(s));

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">Pesquisas NPS</h1>
          <p className="text-sm text-ink-500">{activeSurveys.length} pesquisa{activeSurveys.length !== 1 ? "s" : ""} ativa{activeSurveys.length !== 1 ? "s" : ""}</p>
        </div>
        {canManage && (
          <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-brand-olive px-4 py-2 text-sm font-medium text-white hover:bg-brand-olive-dark transition-colors self-start">
            <Plus size={16} /> Nova Pesquisa
          </button>
        )}
      </div>

      {error && <p className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

      {surveys.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-200 bg-ink-50/50 py-16">
          <BarChart3 size={32} className="text-ink-300 mb-2" />
          <p className="text-sm text-ink-400">Nenhuma pesquisa</p>
          {canManage && <button onClick={openCreate} className="mt-2 text-sm font-medium text-brand-olive">Criar primeira</button>}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Active surveys */}
          {activeSurveys.map((survey) => {
            const npsData = calcNps(survey.responses || []);
            const responded = hasResponded(survey);
            const isExpanded = expandedId === survey.id;
            const isResponding = respondingId === survey.id;

            return (
              <div key={survey.id} className="rounded-xl border border-ink-100 bg-white overflow-hidden">
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-ink-900">{survey.title}</h3>
                        {survey.ends_at && (
                          <span className="flex items-center gap-1 text-[10px] text-ink-400">
                            <Clock size={9} /> até {new Date(survey.ends_at).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </div>
                      {survey.description && <p className="text-xs text-ink-500 mb-3">{survey.description}</p>}

                      {/* NPS Score + stats */}
                      <div className="flex items-center gap-4">
                        <div className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5", npsBg(npsData.nps))}>
                          <span className={cn("text-lg font-bold", npsColor(npsData.nps))}>{npsData.nps}</span>
                          <span className="text-[10px] text-ink-500">NPS</span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px]">
                          <span className="text-success">{npsData.promoters} promotor{npsData.promoters !== 1 ? "es" : ""}</span>
                          <span className="text-warning">{npsData.passives} neutro{npsData.passives !== 1 ? "s" : ""}</span>
                          <span className="text-danger">{npsData.detractors} detrator{npsData.detractors !== 1 ? "es" : ""}</span>
                          <span className="text-ink-400">{npsData.total} resposta{npsData.total !== 1 ? "s" : ""}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {!responded && (
                        <button onClick={() => { setRespondingId(isResponding ? null : survey.id); setScore(null); setComment(""); }} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition-colors", isResponding ? "bg-ink-100 text-ink-700" : "bg-brand-olive text-white hover:bg-brand-olive-dark")}>
                          {isResponding ? "Cancelar" : "Responder"}
                        </button>
                      )}
                      {responded && <span className="text-[10px] text-success font-medium">Respondido</span>}
                      {canManage && (
                        <>
                          <button onClick={() => handleToggle(survey.id, false)} className="rounded-md p-1.5 text-ink-400 hover:text-warning hover:bg-warning-soft transition-colors" title="Desativar"><PowerOff size={13} /></button>
                          <button onClick={() => handleDelete(survey.id)} disabled={isPending} className="rounded-md p-1.5 text-ink-400 hover:text-danger hover:bg-danger-soft transition-colors" title="Remover"><Trash2 size={13} /></button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Response form */}
                  {isResponding && !responded && (
                    <div className="mt-4 pt-4 border-t border-ink-100">
                      <p className="text-xs font-medium text-ink-700 mb-3">De 0 a 10, o quanto você recomendaria a Essenza?</p>
                      <div className="flex items-center gap-1 mb-3">
                        {Array.from({ length: 11 }, (_, i) => i).map((n) => (
                          <button
                            key={n}
                            onClick={() => setScore(n)}
                            className={cn(
                              "flex items-center justify-center h-9 w-9 rounded-lg text-sm font-medium transition-colors",
                              score === n
                                ? n <= 6 ? "bg-danger text-white" : n <= 8 ? "bg-warning text-white" : "bg-success text-white"
                                : "border border-ink-100 text-ink-600 hover:bg-ink-50"
                            )}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-ink-400 mb-3">
                        <span>0 — Nada provável</span>
                        <span className="flex-1" />
                        <span>10 — Muito provável</span>
                      </div>
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Comentário (opcional)"
                        rows={2}
                        className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-olive focus:outline-none resize-none mb-3"
                      />
                      <button
                        onClick={() => handleSubmitResponse(survey.id)}
                        disabled={score === null || isPending}
                        className="flex items-center gap-2 rounded-lg bg-brand-olive px-4 py-2 text-sm font-medium text-white hover:bg-brand-olive-dark disabled:opacity-50 transition-colors"
                      >
                        <Send size={14} /> Enviar resposta
                      </button>
                    </div>
                  )}
                </div>

                {/* Expandable responses (admin only) */}
                {canViewAll && npsData.total > 0 && (
                  <>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : survey.id)}
                      className="flex items-center gap-2 w-full px-5 py-2.5 border-t border-ink-100 text-xs font-medium text-ink-500 hover:bg-ink-50 transition-colors"
                    >
                      <MessageSquare size={12} />
                      Ver respostas ({npsData.total})
                      <ChevronDown size={12} className={cn("ml-auto transition-transform", isExpanded && "rotate-180")} />
                    </button>
                    {isExpanded && (
                      <div className="border-t border-ink-100 divide-y divide-ink-50 max-h-64 overflow-y-auto">
                        {(survey.responses as { score: number; comment: string | null; created_at: string }[])
                          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                          .map((r, i) => (
                          <div key={i} className="flex items-start gap-3 px-5 py-3">
                            <div className={cn(
                              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white",
                              r.score <= 6 ? "bg-danger" : r.score <= 8 ? "bg-warning" : "bg-success"
                            )}>
                              {r.score}
                            </div>
                            <div className="flex-1 min-w-0">
                              {r.comment ? (
                                <p className="text-sm text-ink-700">{r.comment}</p>
                              ) : (
                                <p className="text-xs text-ink-400 italic">Sem comentário</p>
                              )}
                              <span className="text-[10px] text-ink-400">{new Date(r.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}

          {/* Inactive / expired */}
          {inactiveSurveys.length > 0 && canManage && (
            <details className="mt-2">
              <summary className="text-xs font-medium text-ink-400 cursor-pointer hover:text-ink-600">{inactiveSurveys.length} pesquisa{inactiveSurveys.length > 1 ? "s" : ""} inativa{inactiveSurveys.length > 1 ? "s" : ""}</summary>
              <div className="flex flex-col gap-2 mt-2">
                {inactiveSurveys.map((s) => {
                  const nps = calcNps(s.responses || []);
                  return (
                    <div key={s.id} className="flex items-center gap-3 rounded-lg border border-ink-100 bg-white px-4 py-3 opacity-60">
                      <div className={cn("flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold", npsBg(nps.nps), npsColor(nps.nps))}>
                        {nps.nps}
                      </div>
                      <p className="text-sm text-ink-700 flex-1">{s.title}</p>
                      <span className="text-[10px] text-ink-400">{nps.total} respostas</span>
                      <button onClick={() => handleToggle(s.id, true)} className="text-ink-400 hover:text-success" title="Reativar"><Power size={13} /></button>
                      <button onClick={() => handleDelete(s.id)} disabled={isPending} className="text-ink-400 hover:text-danger"><Trash2 size={13} /></button>
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Create Sheet */}
      <Sheet open={showSheet} onClose={() => setShowSheet(false)} onSubmit={handleSave} title="Nova Pesquisa NPS">
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-ink-700 mb-1.5 block">Título</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus className="h-10 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10" placeholder="Pesquisa de satisfação — Maio 2026" />
          </div>
          <div>
            <label className="text-sm font-medium text-ink-700 mb-1.5 block">Descrição (opcional)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2.5 text-sm text-ink-900 focus:border-brand-olive focus:outline-none resize-none" placeholder="Queremos saber sua opinião sobre..." />
          </div>
          <div>
            <label className="text-sm font-medium text-ink-700 mb-1.5 block">Encerra em (opcional)</label>
            <input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="h-10 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-olive focus:outline-none" />
          </div>
          {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="flex gap-2 pt-2 border-t border-ink-100 mt-2">
            <button onClick={handleSave} disabled={isPending || !title} className="flex-1 rounded-lg bg-brand-olive px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-olive-dark disabled:opacity-50">{isPending ? "Criando..." : "Criar Pesquisa"}</button>
            <button onClick={() => setShowSheet(false)} className="rounded-lg border border-ink-100 px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50">Cancelar</button>
          </div>
        </div>
      </Sheet>

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
