"use client";

import { useState, useTransition } from "react";
import {
  Plus, Trash2, BarChart3, MessageSquare, Send, Star,
  ChevronDown, Power, PowerOff, Clock, GripVertical, X,
} from "lucide-react";
import { createSurvey, deleteSurvey, toggleSurvey, submitResponse } from "./actions";
import { cn } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/custom-select";
import { Sheet } from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Survey { [key: string]: any; }

interface QuestionInput {
  label: string;
  type: "nps" | "rating" | "text" | "choice";
  options: string[];
  required: boolean;
}

interface Props {
  surveys: Survey[];
  canManage: boolean;
  canViewAll: boolean;
  currentUserId: string;
}

const QUESTION_TYPES = [
  { value: "nps", label: "NPS (0–10)" },
  { value: "rating", label: "Estrelas (1–5)" },
  { value: "text", label: "Texto livre" },
  { value: "choice", label: "Escolha única" },
];

function calcNps(responses: { score: number | null }[]) {
  const scored = responses.filter((r) => r.score !== null) as { score: number }[];
  if (scored.length === 0) return { nps: 0, promoters: 0, passives: 0, detractors: 0, total: responses.length };
  const promoters = scored.filter((r) => r.score >= 9).length;
  const detractors = scored.filter((r) => r.score <= 6).length;
  const passives = scored.length - promoters - detractors;
  const nps = Math.round(((promoters - detractors) / scored.length) * 100);
  return { nps, promoters, passives, detractors, total: responses.length };
}

function npsColor(nps: number) { return nps >= 50 ? "text-success" : nps >= 0 ? "text-warning" : "text-danger"; }
function npsBg(nps: number) { return nps >= 50 ? "bg-success-soft" : nps >= 0 ? "bg-warning-soft" : "bg-danger-soft"; }

// --- NPS Input ---
function NpsInput({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex items-center gap-1">
        {Array.from({ length: 11 }, (_, i) => i).map((n) => (
          <button key={n} type="button" onClick={() => onChange(n)} className={cn(
            "flex items-center justify-center h-9 w-9 rounded-lg text-sm font-medium transition-colors",
            value === n ? (n <= 6 ? "bg-danger text-white" : n <= 8 ? "bg-warning text-white" : "bg-success text-white") : "border border-ink-100 text-ink-600 hover:bg-ink-50"
          )}>{n}</button>
        ))}
      </div>
      <div className="flex items-center gap-2 text-[10px] text-ink-400 mt-1">
        <span>0 — Nada provável</span><span className="flex-1" /><span>10 — Muito provável</span>
      </div>
    </div>
  );
}

// --- Rating Input (stars) ---
function RatingInput({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} className="p-0.5 transition-colors">
          <Star size={24} className={cn(value !== null && n <= value ? "text-warning fill-warning" : "text-ink-200")} />
        </button>
      ))}
    </div>
  );
}

// --- Choice Input ---
function ChoiceInput({ options, value, onChange }: { options: string[]; value: string | null; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      {options.map((opt) => (
        <button key={opt} type="button" onClick={() => onChange(opt)} className={cn(
          "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-left transition-colors",
          value === opt ? "bg-brand-olive-soft text-brand-olive-dark font-medium" : "border border-ink-100 text-ink-700 hover:bg-ink-50"
        )}>
          <div className={cn("h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center", value === opt ? "border-brand-olive" : "border-ink-300")}>
            {value === opt && <div className="h-2 w-2 rounded-full bg-brand-olive" />}
          </div>
          {opt}
        </button>
      ))}
    </div>
  );
}

export function SurveysManager({ surveys, canManage, canViewAll, currentUserId }: Props) {
  const { confirm: confirmAction, dialogProps } = useConfirm();
  const [showSheet, setShowSheet] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [questions, setQuestions] = useState<QuestionInput[]>([
    { label: "De 0 a 10, o quanto você recomendaria a Essenza?", type: "nps", options: [], required: true },
  ]);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Response state
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [responseAnswers, setResponseAnswers] = useState<Record<string, string>>({});
  const [responseComment, setResponseComment] = useState("");

  // --- Question builder ---
  function addQuestion() {
    setQuestions((prev) => [...prev, { label: "", type: "text", options: [], required: true }]);
  }

  function removeQuestion(i: number) {
    setQuestions((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateQuestion(i: number, field: keyof QuestionInput, value: unknown) {
    setQuestions((prev) => prev.map((q, idx) => idx === i ? { ...q, [field]: value } : q));
  }

  function addOption(i: number) {
    setQuestions((prev) => prev.map((q, idx) => idx === i ? { ...q, options: [...q.options, ""] } : q));
  }

  function updateOption(qi: number, oi: number, value: string) {
    setQuestions((prev) => prev.map((q, idx) => idx === qi ? { ...q, options: q.options.map((o, j) => j === oi ? value : o) } : q));
  }

  function removeOption(qi: number, oi: number) {
    setQuestions((prev) => prev.map((q, idx) => idx === qi ? { ...q, options: q.options.filter((_, j) => j !== oi) } : q));
  }

  function openCreate() {
    setTitle(""); setDescription(""); setEndsAt("");
    setQuestions([{ label: "De 0 a 10, o quanto você recomendaria a Essenza?", type: "nps", options: [], required: true }]);
    setError(""); setShowSheet(true);
  }

  function handleSave() {
    if (questions.some((q) => !q.label.trim())) { setError("Todas as perguntas precisam de um texto."); return; }
    const fd = new FormData();
    fd.set("title", title); fd.set("description", description); fd.set("endsAt", endsAt);
    fd.set("questions", JSON.stringify(questions));
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

  function startResponding(surveyId: string) {
    setRespondingId(respondingId === surveyId ? null : surveyId);
    setResponseAnswers({});
    setResponseComment("");
  }

  function handleSubmitResponse(surveyId: string, surveyQuestions: { id: string }[]) {
    const answers = surveyQuestions
      .filter((q) => responseAnswers[q.id])
      .map((q) => ({ questionId: q.id, value: responseAnswers[q.id] }));
    startTransition(async () => {
      const r = await submitResponse(surveyId, answers, responseComment);
      if (r?.error) setError(r.error);
      else { setRespondingId(null); setResponseAnswers({}); setResponseComment(""); }
    });
  }

  function hasResponded(survey: Survey) {
    return (survey.responses || []).some((r: { user_id: string }) => r.user_id === currentUserId);
  }

  function isExpired(survey: Survey) {
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

      {error && !showSheet && <p className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

      {surveys.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-200 bg-ink-50/50 py-16">
          <BarChart3 size={32} className="text-ink-300 mb-2" />
          <p className="text-sm text-ink-400">Nenhuma pesquisa</p>
          {canManage && <button onClick={openCreate} className="mt-2 text-sm font-medium text-brand-olive">Criar primeira</button>}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {activeSurveys.map((survey) => {
            const npsData = calcNps(survey.responses || []);
            const responded = hasResponded(survey);
            const isExpanded = expandedId === survey.id;
            const isResponding = respondingId === survey.id;
            const surveyQuestions = survey.questions || [];
            const hasNps = surveyQuestions.some((q: { type: string }) => q.type === "nps");

            return (
              <div key={survey.id} className="rounded-xl border border-ink-100 bg-white overflow-hidden">
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-ink-900">{survey.title}</h3>
                        <span className="text-[10px] text-ink-400">{surveyQuestions.length} pergunta{surveyQuestions.length !== 1 ? "s" : ""}</span>
                        {survey.ends_at && (
                          <span className="flex items-center gap-1 text-[10px] text-ink-400"><Clock size={9} /> até {new Date(survey.ends_at).toLocaleDateString("pt-BR")}</span>
                        )}
                      </div>
                      {survey.description && <p className="text-xs text-ink-500 mb-3">{survey.description}</p>}

                      <div className="flex items-center gap-4">
                        {hasNps && (
                          <div className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5", npsBg(npsData.nps))}>
                            <span className={cn("text-lg font-bold", npsColor(npsData.nps))}>{npsData.nps}</span>
                            <span className="text-[10px] text-ink-500">NPS</span>
                          </div>
                        )}
                        <div className="flex items-center gap-3 text-[11px]">
                          {hasNps && (
                            <>
                              <span className="text-success">{npsData.promoters} promotor{npsData.promoters !== 1 ? "es" : ""}</span>
                              <span className="text-warning">{npsData.passives} neutro{npsData.passives !== 1 ? "s" : ""}</span>
                              <span className="text-danger">{npsData.detractors} detrator{npsData.detractors !== 1 ? "es" : ""}</span>
                            </>
                          )}
                          <span className="text-ink-400">{npsData.total} resposta{npsData.total !== 1 ? "s" : ""}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {!responded && (
                        <button onClick={() => startResponding(survey.id)} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition-colors", isResponding ? "bg-ink-100 text-ink-700" : "bg-brand-olive text-white hover:bg-brand-olive-dark")}>
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
                    <div className="mt-4 pt-4 border-t border-ink-100 flex flex-col gap-5">
                      {surveyQuestions.map((q: { id: string; label: string; type: string; options: string[] | null; required: boolean }) => (
                        <div key={q.id}>
                          <p className="text-xs font-medium text-ink-700 mb-2">
                            {q.label} {q.required && <span className="text-danger">*</span>}
                          </p>
                          {q.type === "nps" && <NpsInput value={responseAnswers[q.id] ? Number(responseAnswers[q.id]) : null} onChange={(v) => setResponseAnswers((p) => ({ ...p, [q.id]: String(v) }))} />}
                          {q.type === "rating" && <RatingInput value={responseAnswers[q.id] ? Number(responseAnswers[q.id]) : null} onChange={(v) => setResponseAnswers((p) => ({ ...p, [q.id]: String(v) }))} />}
                          {q.type === "text" && (
                            <textarea value={responseAnswers[q.id] || ""} onChange={(e) => setResponseAnswers((p) => ({ ...p, [q.id]: e.target.value }))} rows={2} className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-olive focus:outline-none resize-none" placeholder="Sua resposta..." />
                          )}
                          {q.type === "choice" && q.options && <ChoiceInput options={q.options} value={responseAnswers[q.id] || null} onChange={(v) => setResponseAnswers((p) => ({ ...p, [q.id]: v }))} />}
                        </div>
                      ))}
                      <textarea value={responseComment} onChange={(e) => setResponseComment(e.target.value)} placeholder="Comentário geral (opcional)" rows={2} className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-olive focus:outline-none resize-none" />
                      <button onClick={() => handleSubmitResponse(survey.id, surveyQuestions)} disabled={isPending} className="flex items-center gap-2 rounded-lg bg-brand-olive px-4 py-2 text-sm font-medium text-white hover:bg-brand-olive-dark disabled:opacity-50 transition-colors self-start">
                        <Send size={14} /> Enviar resposta
                      </button>
                    </div>
                  )}
                </div>

                {/* Expandable responses */}
                {canViewAll && npsData.total > 0 && (
                  <>
                    <button onClick={() => setExpandedId(isExpanded ? null : survey.id)} className="flex items-center gap-2 w-full px-5 py-2.5 border-t border-ink-100 text-xs font-medium text-ink-500 hover:bg-ink-50 transition-colors">
                      <MessageSquare size={12} /> Ver respostas ({npsData.total})
                      <ChevronDown size={12} className={cn("ml-auto transition-transform", isExpanded && "rotate-180")} />
                    </button>
                    {isExpanded && (
                      <div className="border-t border-ink-100 divide-y divide-ink-50 max-h-80 overflow-y-auto">
                        {(survey.responses as { score: number | null; comment: string | null; created_at: string; answers: { question_id: string; value: string }[] }[])
                          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                          .map((r, i) => (
                          <div key={i} className="px-5 py-3">
                            <div className="flex items-center gap-2 mb-1.5">
                              {r.score !== null && (
                                <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white", r.score <= 6 ? "bg-danger" : r.score <= 8 ? "bg-warning" : "bg-success")}>{r.score}</div>
                              )}
                              <span className="text-[10px] text-ink-400">{new Date(r.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
                            </div>
                            {(r.answers || []).length > 0 && (
                              <div className="flex flex-col gap-1 mb-1">
                                {(r.answers || []).map((a, j) => {
                                  const q = surveyQuestions.find((sq: { id: string }) => sq.id === a.question_id);
                                  if (!q) return null;
                                  return (
                                    <div key={j} className="text-xs">
                                      <span className="text-ink-400">{q.label}:</span>{" "}
                                      <span className="text-ink-700 font-medium">
                                        {q.type === "rating" ? "★".repeat(Number(a.value)) : a.value}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {r.comment && <p className="text-sm text-ink-600">{r.comment}</p>}
                            {!r.comment && (r.answers || []).length === 0 && <p className="text-xs text-ink-400 italic">Sem detalhes</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}

          {inactiveSurveys.length > 0 && canManage && (
            <details className="mt-2">
              <summary className="text-xs font-medium text-ink-400 cursor-pointer hover:text-ink-600">{inactiveSurveys.length} inativa{inactiveSurveys.length > 1 ? "s" : ""}</summary>
              <div className="flex flex-col gap-2 mt-2">
                {inactiveSurveys.map((s) => {
                  const nps = calcNps(s.responses || []);
                  return (
                    <div key={s.id} className="flex items-center gap-3 rounded-lg border border-ink-100 bg-white px-4 py-3 opacity-60">
                      <div className={cn("flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold", npsBg(nps.nps), npsColor(nps.nps))}>{nps.nps}</div>
                      <p className="text-sm text-ink-700 flex-1">{s.title}</p>
                      <span className="text-[10px] text-ink-400">{nps.total} respostas</span>
                      <button onClick={() => handleToggle(s.id, true)} className="text-ink-400 hover:text-success"><Power size={13} /></button>
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
      <Sheet open={showSheet} onClose={() => setShowSheet(false)} onSubmit={handleSave} title="Nova Pesquisa" wide>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-ink-700 mb-1.5 block">Título</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus className="h-10 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10" placeholder="Pesquisa de satisfação — Maio 2026" />
          </div>
          <div>
            <label className="text-sm font-medium text-ink-700 mb-1.5 block">Descrição (opcional)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2.5 text-sm text-ink-900 focus:border-brand-olive focus:outline-none resize-none" placeholder="Queremos saber sua opinião..." />
          </div>
          <div>
            <label className="text-sm font-medium text-ink-700 mb-1.5 block">Encerra em (opcional)</label>
            <input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="h-10 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-olive focus:outline-none" />
          </div>

          {/* Questions builder */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-ink-700">Perguntas</label>
              <button type="button" onClick={addQuestion} className="flex items-center gap-1 text-xs font-medium text-brand-olive hover:text-brand-olive-dark">
                <Plus size={12} /> Adicionar pergunta
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {questions.map((q, i) => (
                <div key={i} className="rounded-lg border border-ink-100 bg-ink-50/30 p-3">
                  <div className="flex items-start gap-2 mb-2">
                    <GripVertical size={14} className="text-ink-300 mt-2.5 shrink-0" />
                    <div className="flex-1 flex flex-col gap-2">
                      <input value={q.label} onChange={(e) => updateQuestion(i, "label", e.target.value)} className="h-9 w-full rounded-md border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-olive focus:outline-none" placeholder="Texto da pergunta" />
                      <div className="flex items-center gap-2">
                        <div className="w-40">
                          <CustomSelect options={QUESTION_TYPES} value={q.type} onChange={(v) => updateQuestion(i, "type", v)} />
                        </div>
                        <label className="flex items-center gap-1.5 text-xs text-ink-600 cursor-pointer">
                          <input type="checkbox" checked={q.required} onChange={(e) => updateQuestion(i, "required", e.target.checked)} className="rounded border-ink-300" />
                          Obrigatória
                        </label>
                      </div>
                      {q.type === "choice" && (
                        <div className="flex flex-col gap-1.5 pl-1">
                          {q.options.map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <input value={opt} onChange={(e) => updateOption(i, oi, e.target.value)} className="h-8 flex-1 rounded-md border border-ink-100 bg-white px-2 text-sm text-ink-900 focus:border-brand-olive focus:outline-none" placeholder={`Opção ${oi + 1}`} />
                              <button type="button" onClick={() => removeOption(i, oi)} className="text-ink-400 hover:text-danger"><X size={12} /></button>
                            </div>
                          ))}
                          <button type="button" onClick={() => addOption(i)} className="text-[11px] text-brand-olive hover:text-brand-olive-dark self-start">+ Adicionar opção</button>
                        </div>
                      )}
                    </div>
                    {questions.length > 1 && (
                      <button type="button" onClick={() => removeQuestion(i)} className="text-ink-400 hover:text-danger mt-2"><Trash2 size={13} /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="flex gap-2 pt-2 border-t border-ink-100 mt-2">
            <button onClick={handleSave} disabled={isPending || !title || questions.length === 0} className="flex-1 rounded-lg bg-brand-olive px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-olive-dark disabled:opacity-50">{isPending ? "Criando..." : "Criar Pesquisa"}</button>
            <button onClick={() => setShowSheet(false)} className="rounded-lg border border-ink-100 px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50">Cancelar</button>
          </div>
        </div>
      </Sheet>

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
