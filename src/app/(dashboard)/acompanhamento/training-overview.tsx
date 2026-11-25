"use client";

import { useState } from "react";
import Link from "next/link";
import { Award, CheckCircle2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TrainingOverviewData {
  trainings: { slug: string; title: string; total: number }[];
  people: {
    id: string;
    name: string;
    franchiseId: string | null;
    franchiseName: string | null;
    available: string[];
    certificates: string[];
    progress: Record<string, { done: number; started: number; lastAt: string }>;
  }[];
}

type Person = TrainingOverviewData["people"][number];

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });

function doneCount(person: Person) {
  return Object.values(person.progress).reduce((sum, p) => sum + p.done, 0);
}

function lastActivity(person: Person) {
  const dates = Object.values(person.progress).map((p) => p.lastAt).sort();
  return dates.length ? dateFormat.format(new Date(dates[dates.length - 1])) : "-";
}

function personStatus(person: Person, totalLessons: number) {
  const done = doneCount(person);
  if (totalLessons === 0) return { label: "Sem treinamentos", className: "bg-ink-100 text-ink-500" };
  if (done >= totalLessons) return { label: "Concluiu tudo", className: "bg-success-soft text-success" };
  const started = done > 0 || Object.values(person.progress).some((p) => p.started > 0);
  return started
    ? { label: "Em andamento", className: "bg-brand-olive-soft text-brand-olive-dark" }
    : { label: "Não iniciou", className: "bg-ink-100 text-ink-500" };
}

export function TrainingOverview({ data, groupByFranchise }: { data: TrainingOverviewData; groupByFranchise: boolean }) {
  // So renderiza a tabela da franquia aberta: com a rede inteira a pagina ficaria pesada
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  function setGroupOpen(key: string, open: boolean) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (open) next.add(key); else next.delete(key);
      return next;
    });
  }

  const totalFor = (person: Person) =>
    data.trainings.reduce((sum, t) => sum + (person.available.includes(t.slug) ? t.total : 0), 0);

  if (data.people.length === 0) {
    return <p className="rounded-xl border border-ink-100 bg-white px-6 py-12 text-center text-sm text-ink-500">Nenhum funcionário ativo</p>;
  }
  if (data.trainings.length === 0) {
    return <p className="rounded-xl border border-ink-100 bg-white px-6 py-12 text-center text-sm text-ink-500">Nenhum treinamento publicado</p>;
  }

  const groups = new Map<string, { name: string; people: Person[] }>();
  for (const person of data.people) {
    const key = person.franchiseId || "";
    const group = groups.get(key) || { name: person.franchiseName || "Sem franquia vinculada", people: [] };
    group.people.push(person);
    groups.set(key, group);
  }
  const sorted = [...groups.entries()].sort(([, a], [, b]) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      {sorted.map(([key, group]) => {
        const done = group.people.reduce((sum, p) => sum + doneCount(p), 0);
        const total = group.people.reduce((sum, p) => sum + totalFor(p), 0);
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        const countByStatus = (label: string) => group.people.filter((p) => personStatus(p, totalFor(p)).label === label).length;
        const finished = countByStatus("Concluiu tudo");
        const notStarted = countByStatus("Não iniciou");

        return (
          <details key={key} open={!groupByFranchise || undefined} onToggle={(e) => setGroupOpen(key, e.currentTarget.open)} className="group rounded-xl border border-ink-100 bg-white">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3">
              <h2 className="min-w-40 flex-1 text-sm font-semibold text-ink-900">{group.name}</h2>
              <span className="text-xs text-ink-500">{group.people.length} {group.people.length === 1 ? "funcionário" : "funcionários"}</span>
              <span className="text-xs text-ink-500">{finished} {finished === 1 ? "concluiu" : "concluíram"} tudo</span>
              <span className="text-xs text-ink-500">{notStarted} não {notStarted === 1 ? "iniciou" : "iniciaram"}</span>
              <span className="text-sm font-semibold text-brand-olive">{pct}% concluído</span>
              <ChevronDown size={16} aria-hidden className="text-ink-400 transition-transform group-open:rotate-180" />
            </summary>

            {(!groupByFranchise || openGroups.has(key)) && (
              <div className="overflow-x-auto border-t border-ink-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 text-left text-xs text-ink-500">
                      <th scope="col" className="px-4 py-2.5 font-medium">Funcionário</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Situação</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Total</th>
                      {data.trainings.map((t) => (
                        <th key={t.slug} scope="col" className="px-4 py-2.5 font-medium">{t.title}</th>
                      ))}
                      <th scope="col" className="px-4 py-2.5 font-medium whitespace-nowrap">Última atividade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.people.map((person) => {
                      const status = personStatus(person, totalFor(person));
                      return (
                        <tr key={person.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50">
                          <td className="px-4 py-2.5">
                            <Link href={`/acompanhamento/${person.id}`} className="font-medium text-ink-900 hover:underline">{person.name}</Link>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium", status.className)}>{status.label}</span>
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-ink-700">{doneCount(person)} de {totalFor(person)}</td>
                          {data.trainings.map((t) => {
                            if (!person.available.includes(t.slug)) {
                              return <td key={t.slug} className="px-4 py-2.5 text-ink-300" title="Sem acesso a este treinamento">-</td>;
                            }
                            const progress = person.progress[t.slug];
                            const complete = progress?.done === t.total;
                            return (
                              <td key={t.slug} className={cn("px-4 py-2.5 whitespace-nowrap", progress ? "text-ink-700" : "text-ink-400")}>
                                <span className="inline-flex items-center gap-1">
                                  {complete && <CheckCircle2 size={13} aria-label="Concluído" className="text-success" />}
                                  {progress?.done || 0} de {t.total}
                                  {person.certificates.includes(t.slug) && <Award size={13} aria-label="Certificado emitido" className="text-brand-olive" />}
                                  {progress && progress.started > 0 && <span className="text-xs text-ink-400">({progress.started} em andamento)</span>}
                                </span>
                              </td>
                            );
                          })}
                          <td className="px-4 py-2.5 whitespace-nowrap text-ink-500">{lastActivity(person)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </details>
        );
      })}
    </div>
  );
}
