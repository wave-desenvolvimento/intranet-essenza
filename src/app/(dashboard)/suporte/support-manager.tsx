"use client";

import { useState, useTransition, useCallback } from "react";
import {
  Search, Trash2, ChevronDown, ChevronUp, MessageSquare,
  Mail, Calendar, X, ChevronLeft, ChevronRight, Loader2,
  Settings, Plus, KeyRound, HelpCircle, LogIn, Send, CheckCircle,
} from "lucide-react";
import {
  getTickets, updateTicketStatus, updateTicketNotes, deleteTicket, replyToTicket,
  getSupportNotificationEmails, addSupportNotificationEmail, removeSupportNotificationEmail,
} from "./actions";
import type { SupportTicket, SupportNotificationEmail } from "./actions";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";
import { CustomSelect } from "@/components/ui/custom-select";
import { Sheet } from "@/components/ui/sheet";

const PAGE_SIZE = 30;

const STATUS_OPTIONS = [
  { value: "novo", label: "Novo", color: "bg-blue-100 text-blue-700" },
  { value: "em_andamento", label: "Em andamento", color: "bg-yellow-100 text-yellow-700" },
  { value: "resolvido", label: "Resolvido", color: "bg-green-100 text-green-700" },
];

const TIPO_ICONS: Record<string, React.ElementType> = {
  acesso: LogIn,
  senha: KeyRound,
  outro: HelpCircle,
};

const TIPO_LABELS: Record<string, string> = {
  acesso: "Acesso",
  senha: "Senha",
  outro: "Outro",
};

interface Props {
  initialData: SupportTicket[];
  initialTotal: number;
  initialCounts: Record<string, number>;
  canEdit: boolean;
  canDelete: boolean;
}

export function SupportManager({ initialData, initialTotal, initialCounts, canEdit, canDelete }: Props) {
  const { confirm: confirmAction, dialogProps } = useConfirm();
  const [tickets, setTickets] = useState(initialData);
  const [total, setTotal] = useState(initialTotal);
  const [counts, setCounts] = useState(initialCounts);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("novo");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);

  // Email settings
  const [emailsOpen, setEmailsOpen] = useState(false);
  const [notifEmails, setNotifEmails] = useState<SupportNotificationEmail[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const totalAll = Object.values(counts).reduce((a, b) => a + b, 0);

  const fetchTickets = useCallback(async (p: number, status: string, q: string) => {
    setIsLoading(true);
    const res = await getTickets({ status: status || undefined, search: q || undefined, page: p });
    setTickets(res.data);
    setTotal(res.total);
    setCounts(res.counts);
    setIsLoading(false);
  }, []);

  function applyFilter(status: string) {
    setFilterStatus(status);
    setPage(0);
    setExpandedId(null);
    startTransition(() => fetchTickets(0, status, search));
  }

  function handleSearch(value: string) {
    setSearch(value);
    setPage(0);
    const timer = setTimeout(() => {
      startTransition(() => fetchTickets(0, filterStatus, value));
    }, 400);
    return () => clearTimeout(timer);
  }

  function goToPage(p: number) {
    setPage(p);
    setExpandedId(null);
    startTransition(() => fetchTickets(p, filterStatus, search));
  }

  async function handleStatusChange(id: string, status: string) {
    await updateTicketStatus(id, status);
    startTransition(() => fetchTickets(page, filterStatus, search));
  }

  async function handleSaveNotes(id: string) {
    await updateTicketNotes(id, notesValue);
    setEditingNotes(null);
    startTransition(() => fetchTickets(page, filterStatus, search));
  }

  const [replying, setReplying] = useState<string | null>(null);

  async function handleReply(id: string, status: "em_andamento" | "resolvido") {
    setReplying(id);
    await replyToTicket(id, status);
    setReplying(null);
    startTransition(() => fetchTickets(page, filterStatus, search));
  }

  async function handleDelete(id: string) {
    const ok = await confirmAction({
      title: "Remover ticket",
      message: "Deseja remover este ticket? Esta acao nao pode ser desfeita.",
      confirmLabel: "Remover",
      destructive: true,
    });
    if (!ok) return;
    await deleteTicket(id);
    startTransition(() => fetchTickets(page, filterStatus, search));
  }

  async function openEmailSettings() {
    setEmailsOpen(true);
    setEmailError("");
    setNewEmail("");
    setNotifEmails(await getSupportNotificationEmails());
  }

  async function handleAddEmail() {
    setEmailError("");
    const res = await addSupportNotificationEmail(newEmail);
    if ("error" in res && res.error) { setEmailError(res.error); return; }
    setNewEmail("");
    setNotifEmails(await getSupportNotificationEmails());
  }

  async function handleRemoveEmail(id: string) {
    await removeSupportNotificationEmail(id);
    setNotifEmails(await getSupportNotificationEmails());
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Tickets de Suporte</h1>
          <p className="text-sm text-ink-500 mt-0.5">{totalAll} tickets no total</p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              onClick={openEmailSettings}
              className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 transition-colors"
              title="Emails de notificacao"
            >
              <Settings size={16} />
              <span className="hidden sm:inline">Notificacoes</span>
            </button>
          )}
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-3 gap-3">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s.value}
            onClick={() => applyFilter(filterStatus === s.value ? "" : s.value)}
            className={cn(
              "rounded-xl border p-3 text-left transition-all",
              filterStatus === s.value
                ? "border-brand-olive bg-brand-olive/5 ring-1 ring-brand-olive"
                : "border-ink-100 bg-white hover:border-ink-200"
            )}
          >
            <p className="text-2xl font-bold text-ink-900">{counts[s.value] || 0}</p>
            <p className="text-xs text-ink-500 mt-0.5">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar por nome, email ou descricao..."
          className="w-full h-10 rounded-xl border border-ink-200 bg-white pl-9 pr-4 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/15"
        />
        {(isPending || isLoading) && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 animate-spin" />}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-ink-100 bg-white overflow-hidden">
        <table className="w-full table-fixed">
          <colgroup>
            <col style={{ width: "22%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "8%" }} />
          </colgroup>
          <thead>
            <tr className="border-b border-ink-100 bg-ink-50/50">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-ink-500">Nome</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-ink-500">Email</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-ink-500">Tipo</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-ink-500">Status</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-ink-500">Data</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {tickets.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-ink-400">Nenhum ticket encontrado</td></tr>
            ) : tickets.map((t) => {
              const expanded = expandedId === t.id;
              const TipoIcon = TIPO_ICONS[t.tipo] || HelpCircle;
              return (
                <tr key={t.id} className="group">
                  <td colSpan={6} className="p-0">
                    <button
                      onClick={() => setExpandedId(expanded ? null : t.id)}
                      className="flex w-full items-center border-b border-ink-50 hover:bg-ink-50/50 transition-colors"
                    >
                      <div className="w-[22%] px-4 py-3 text-left">
                        <p className="text-sm font-medium text-ink-900 truncate">{t.nome}</p>
                      </div>
                      <div className="w-[22%] px-4 py-3 text-left">
                        <p className="text-sm text-ink-600 truncate">{t.email}</p>
                      </div>
                      <div className="w-[14%] px-4 py-3 text-left">
                        <span className="inline-flex items-center gap-1 text-xs text-ink-600">
                          <TipoIcon size={12} />
                          {TIPO_LABELS[t.tipo] || t.tipo}
                        </span>
                      </div>
                      <div className="w-[14%] px-4 py-3 text-left">
                        <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-[10px] font-medium",
                          STATUS_OPTIONS.find((s) => s.value === t.status)?.color || "bg-ink-100 text-ink-500"
                        )}>
                          {STATUS_OPTIONS.find((s) => s.value === t.status)?.label || t.status}
                        </span>
                      </div>
                      <div className="w-[20%] px-4 py-3 text-left">
                        <p className="text-xs text-ink-500">{new Date(t.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                      <div className="w-[8%] px-4 py-3 text-right">
                        {expanded ? <ChevronUp size={14} className="text-ink-400" /> : <ChevronDown size={14} className="text-ink-400" />}
                      </div>
                    </button>

                    {expanded && (
                      <div className="border-b border-ink-100 bg-ink-50/30 px-6 py-4 space-y-4">
                        {/* Description */}
                        <div>
                          <p className="text-xs font-medium text-ink-500 mb-1">Descricao</p>
                          <p className="text-sm text-ink-800 whitespace-pre-wrap">{t.descricao}</p>
                        </div>

                        {/* Status + Reply actions */}
                        {canEdit && (
                          <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-3">
                              <p className="text-xs font-medium text-ink-500">Status:</p>
                              <CustomSelect
                                value={t.status}
                                options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
                                onChange={(v) => handleStatusChange(t.id, v)}
                                className="min-w-[180px]"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              {t.status === "novo" && (
                                <button
                                  onClick={() => handleReply(t.id, "em_andamento")}
                                  disabled={replying === t.id}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-1.5 text-xs font-medium text-yellow-700 hover:bg-yellow-100 disabled:opacity-50 transition-colors"
                                >
                                  {replying === t.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                                  Informar que esta em andamento
                                </button>
                              )}
                              {t.status !== "resolvido" && (
                                <button
                                  onClick={() => handleReply(t.id, "resolvido")}
                                  disabled={replying === t.id}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 transition-colors"
                                >
                                  {replying === t.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                                  Informar resolucao
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Notes */}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <MessageSquare size={12} className="text-ink-400" />
                            <p className="text-xs font-medium text-ink-500">Notas internas</p>
                          </div>
                          {editingNotes === t.id ? (
                            <div className="flex gap-2">
                              <textarea
                                value={notesValue}
                                onChange={(e) => setNotesValue(e.target.value)}
                                rows={2}
                                className="flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-olive/30 resize-none"
                              />
                              <div className="flex flex-col gap-1">
                                <button onClick={() => handleSaveNotes(t.id)} className="rounded-lg bg-brand-olive px-3 py-1.5 text-xs text-white hover:bg-brand-olive-dark">Salvar</button>
                                <button onClick={() => setEditingNotes(null)} className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50">Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditingNotes(t.id); setNotesValue(t.notas || ""); }}
                              className="text-sm text-ink-600 hover:text-ink-900 transition-colors"
                              disabled={!canEdit}
                            >
                              {t.notas || (canEdit ? "Adicionar nota..." : "Sem notas")}
                            </button>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-3 pt-2 border-t border-ink-100">
                          <span className="text-[10px] text-ink-400">
                            <Mail size={10} className="inline mr-1" />{t.email}
                          </span>
                          {canDelete && (
                            <button onClick={() => handleDelete(t.id)} className="inline-flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 ml-auto">
                              <Trash2 size={12} /> Remover
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-ink-500">{total} resultado{total !== 1 ? "s" : ""}</p>
          <div className="flex items-center gap-1">
            <button onClick={() => goToPage(page - 1)} disabled={page === 0} className="rounded-lg border border-ink-200 p-2 text-ink-500 hover:bg-ink-50 disabled:opacity-30">
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const p = page < 3 ? i : page - 2 + i;
              if (p >= totalPages) return null;
              return (
                <button key={p} onClick={() => goToPage(p)}
                  className={cn("rounded-lg px-3 py-1.5 text-xs font-medium", p === page ? "bg-brand-olive text-white" : "text-ink-600 hover:bg-ink-50")}
                >{p + 1}</button>
              );
            })}
            <button onClick={() => goToPage(page + 1)} disabled={page >= totalPages - 1} className="rounded-lg border border-ink-200 p-2 text-ink-500 hover:bg-ink-50 disabled:opacity-30">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Email settings sheet */}
      <Sheet open={emailsOpen} onClose={() => setEmailsOpen(false)} title="Emails de notificacao">
        <p className="text-sm text-ink-500 mb-4">
          Novos tickets de suporte serao enviados para os emails abaixo.
        </p>

        <div className="flex gap-2 mb-4">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddEmail()}
            placeholder="nome@empresa.com"
            className="flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-olive/30 focus:border-brand-olive"
          />
          <button
            onClick={handleAddEmail}
            disabled={!newEmail.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-olive px-3 py-2 text-sm font-medium text-white hover:bg-brand-olive/90 disabled:opacity-40 transition-colors"
          >
            <Plus size={14} />
            Adicionar
          </button>
        </div>

        {emailError && <p className="text-sm text-red-600 mb-3">{emailError}</p>}

        {notifEmails.length === 0 ? (
          <p className="text-sm text-ink-400 text-center py-8">Nenhum email cadastrado.</p>
        ) : (
          <ul className="space-y-2">
            {notifEmails.map((ne) => (
              <li key={ne.id} className="flex items-center justify-between rounded-lg border border-ink-100 px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <Mail size={14} className="text-ink-400 shrink-0" />
                  <span className="text-sm text-ink-800 truncate">{ne.email}</span>
                </div>
                <button
                  onClick={() => handleRemoveEmail(ne.id)}
                  className="rounded p-1 text-ink-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                  title="Remover"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
