"use client";

import { useState, useTransition, useEffect } from "react";
import { BarChart3, X, Send, Star, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { submitResponse } from "@/app/(dashboard)/pesquisas/actions";

interface Question {
  id: string;
  label: string;
  type: "nps" | "rating" | "text" | "choice";
  options: string[] | null;
  required: boolean;
  sort_order: number;
}

interface PendingSurvey {
  id: string;
  title: string;
  description: string | null;
  questions: Question[];
}

interface Props {
  surveys: PendingSurvey[];
}

export function SurveyWidget({ surveys }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [comment, setComment] = useState("");
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState(0);

  // Load dismissed from sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem("dismissed-surveys");
    if (saved) setDismissed(new Set(JSON.parse(saved)));
  }, []);

  const pending = surveys.filter((s) => !dismissed.has(s.id));
  const activeSurvey = activeId ? pending.find((s) => s.id === activeId) : null;
  const questions = activeSurvey?.questions.sort((a, b) => a.sort_order - b.sort_order) || [];
  const currentQuestion = questions[step];
  const isLastStep = step === questions.length; // last step is comment

  function dismiss(id: string) {
    // Only dismiss permanently after submitting
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    sessionStorage.setItem("dismissed-surveys", JSON.stringify([...next]));
  }

  function open(id: string) {
    setActiveId(id);
    setAnswers({});
    setComment("");
    setStep(0);
    setSubmitted(false);
  }

  function close() {
    // Just close the modal, keep the floating button visible
    setActiveId(null);
    setStep(0);
  }

  function handleSubmit() {
    if (!activeSurvey) return;
    const answerList = questions
      .filter((q) => answers[q.id])
      .map((q) => ({ questionId: q.id, value: answers[q.id] }));

    startTransition(async () => {
      const r = await submitResponse(activeSurvey.id, answerList, comment);
      if (r?.error) return;
      setSubmitted(true);
      setTimeout(() => dismiss(activeSurvey.id), 2000);
    });
  }

  function canAdvance(): boolean {
    if (!currentQuestion) return true; // comment step
    if (!currentQuestion.required) return true;
    return !!answers[currentQuestion.id];
  }

  if (pending.length === 0) return null;

  // --- Floating button (no survey open) ---
  if (!activeId) {
    return (
      <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-[80] flex flex-col items-end gap-2">
        {pending.map((s) => (
          <button
            key={s.id}
            onClick={() => open(s.id)}
            className="group flex items-center gap-2.5 rounded-full bg-brand-olive pl-4 pr-2 py-2 text-sm font-medium text-white shadow-lg hover:bg-brand-olive-dark transition-all animate-bounce-slow"
          >
            <BarChart3 size={16} className="shrink-0" />
            <span className="hidden sm:inline max-w-[200px] truncate">{s.title}</span>
            <span className="sm:hidden">Pesquisa</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
              <ChevronRight size={14} />
            </div>
          </button>
        ))}
        <style>{`
          @keyframes bounce-slow {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-6px); }
          }
          .animate-bounce-slow { animation: bounce-slow 2s ease-in-out infinite; }
        `}</style>
      </div>
    );
  }

  // --- Modal ---
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={close} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-100 bg-brand-olive-soft/30">
          <div>
            <h2 className="text-sm font-semibold text-ink-900">{activeSurvey?.title}</h2>
            {activeSurvey?.description && <p className="text-xs text-ink-500 mt-0.5">{activeSurvey.description}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={close} className="text-[10px] text-ink-400 hover:text-ink-600">Responder depois</button>
            <button onClick={close} className="rounded-full p-1 text-ink-400 hover:text-ink-700 hover:bg-ink-100"><X size={16} /></button>
          </div>
        </div>

        {/* Progress */}
        <div className="px-6 pt-4">
          <div className="flex items-center gap-1 mb-1">
            {questions.map((_, i) => (
              <div key={i} className={cn("h-1 flex-1 rounded-full transition-colors", i <= step ? "bg-brand-olive" : "bg-ink-100")} />
            ))}
            <div className={cn("h-1 flex-1 rounded-full transition-colors", isLastStep ? "bg-brand-olive" : "bg-ink-100")} />
          </div>
          <p className="text-[10px] text-ink-400 mb-4">{step + 1} de {questions.length + 1}</p>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 min-h-[200px]">
          {submitted ? (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success-soft mb-3">
                <BarChart3 size={24} className="text-success" />
              </div>
              <p className="text-sm font-semibold text-ink-900">Obrigado pela resposta!</p>
              <p className="text-xs text-ink-500 mt-1">Sua opinião é muito importante pra gente.</p>
            </div>
          ) : currentQuestion ? (
            <div>
              <p className="text-sm font-medium text-ink-900 mb-4">
                {currentQuestion.label} {currentQuestion.required && <span className="text-danger">*</span>}
              </p>

              {currentQuestion.type === "nps" && (
                <div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {Array.from({ length: 11 }, (_, i) => i).map((n) => (
                      <button key={n} type="button" onClick={() => setAnswers((p) => ({ ...p, [currentQuestion.id]: String(n) }))} className={cn(
                        "flex items-center justify-center h-10 w-10 rounded-xl text-sm font-semibold transition-all",
                        answers[currentQuestion.id] === String(n)
                          ? (n <= 6 ? "bg-danger text-white scale-110" : n <= 8 ? "bg-warning text-white scale-110" : "bg-success text-white scale-110")
                          : "border border-ink-100 text-ink-600 hover:bg-ink-50"
                      )}>{n}</button>
                    ))}
                  </div>
                  <div className="flex justify-between text-[10px] text-ink-400 mt-2 px-1">
                    <span>Nada provável</span><span>Muito provável</span>
                  </div>
                </div>
              )}

              {currentQuestion.type === "rating" && (
                <div className="flex items-center gap-2 py-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setAnswers((p) => ({ ...p, [currentQuestion.id]: String(n) }))} className="p-1 transition-transform hover:scale-110">
                      <Star size={32} className={cn(
                        Number(answers[currentQuestion.id] || 0) >= n ? "text-warning fill-warning" : "text-ink-200"
                      )} />
                    </button>
                  ))}
                </div>
              )}

              {currentQuestion.type === "text" && (
                <textarea
                  value={answers[currentQuestion.id] || ""}
                  onChange={(e) => setAnswers((p) => ({ ...p, [currentQuestion.id]: e.target.value }))}
                  rows={3}
                  className="w-full rounded-xl border border-ink-100 bg-white px-4 py-3 text-sm text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10 resize-none"
                  placeholder="Sua resposta..."
                  autoFocus
                />
              )}

              {currentQuestion.type === "choice" && currentQuestion.options && (
                <div className="flex flex-col gap-2">
                  {currentQuestion.options.map((opt) => (
                    <button key={opt} type="button" onClick={() => setAnswers((p) => ({ ...p, [currentQuestion.id]: opt }))} className={cn(
                      "flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-left transition-all",
                      answers[currentQuestion.id] === opt ? "bg-brand-olive-soft text-brand-olive-dark font-medium ring-2 ring-brand-olive/20" : "border border-ink-100 text-ink-700 hover:bg-ink-50"
                    )}>
                      <div className={cn("h-5 w-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors", answers[currentQuestion.id] === opt ? "border-brand-olive" : "border-ink-300")}>
                        {answers[currentQuestion.id] === opt && <div className="h-2.5 w-2.5 rounded-full bg-brand-olive" />}
                      </div>
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Comment step (last) */
            <div>
              <p className="text-sm font-medium text-ink-900 mb-4">Quer deixar um comentário? (opcional)</p>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-ink-100 bg-white px-4 py-3 text-sm text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10 resize-none"
                placeholder="Sugestões, críticas, elogios..."
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Footer */}
        {!submitted && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-ink-100 bg-ink-50/30">
            <button
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
              className="text-xs font-medium text-ink-500 hover:text-ink-700 disabled:opacity-30"
            >
              Voltar
            </button>
            {isLastStep ? (
              <button
                onClick={handleSubmit}
                disabled={isPending}
                className="flex items-center gap-2 rounded-xl bg-brand-olive px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-olive-dark disabled:opacity-50 transition-colors"
              >
                <Send size={14} /> {isPending ? "Enviando..." : "Enviar"}
              </button>
            ) : (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canAdvance()}
                className="flex items-center gap-2 rounded-xl bg-brand-olive px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-olive-dark disabled:opacity-50 transition-colors"
              >
                Próxima <ChevronRight size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
