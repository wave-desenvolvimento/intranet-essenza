"use client";

import { useState, useTransition, useCallback } from "react";
import {
  Search, Download, Trash2, ChevronDown, ChevronUp, MessageSquare,
  Phone, Mail, MapPin, Calendar, X,
} from "lucide-react";
import { updateLeadStatus, updateLeadNotes, deleteLead } from "./actions";
import type { ResellerLead } from "./actions";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";
import { CustomSelect } from "@/components/ui/custom-select";
import * as XLSX from "xlsx";

const STATUS_OPTIONS = [
  { value: "novo", label: "Novo", color: "bg-blue-100 text-blue-700" },
  { value: "em_contato", label: "Em contato", color: "bg-yellow-100 text-yellow-700" },
  { value: "convertido", label: "Convertido", color: "bg-green-100 text-green-700" },
  { value: "descartado", label: "Descartado", color: "bg-ink-100 text-ink-500" },
];

const ORIGEM_LABELS: Record<string, string> = {
  revenda: "Revenda",
  "primeiro-pedido": "Primeiro Pedido",
};

const TIPO_LABELS: Record<string, string> = {
  revendedor: "Revendedor",
  multimarcas: "Multimarcas",
};

interface Props {
  leads: ResellerLead[];
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
}

export function LeadsManager({ leads, canEdit, canDelete, canExport }: Props) {
  const { confirm: confirmAction, dialogProps } = useConfirm();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterOrigem, setFilterOrigem] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [isPending, startTransition] = useTransition();

  const filtered = leads.filter((l) => {
    if (filterStatus && l.status !== filterStatus) return false;
    if (filterOrigem && l.origem !== filterOrigem) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        l.nome.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.telefone.includes(q) ||
        l.cnpj?.includes(q) ||
        l.cidade?.toLowerCase().includes(q) ||
        l.estado?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const statusCounts = leads.reduce<Record<string, number>>((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {});

  function handleStatusChange(id: string, status: string) {
    startTransition(async () => {
      await updateLeadStatus(id, status);
    });
  }

  function handleSaveNotes(id: string) {
    startTransition(async () => {
      await updateLeadNotes(id, notesValue);
      setEditingNotes(null);
    });
  }

  async function handleDelete(id: string, nome: string) {
    const ok = await confirmAction({
      title: "Remover lead",
      message: `Deseja remover o lead "${nome}"? Esta ação não pode ser desfeita.`,
      confirmLabel: "Remover",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      await deleteLead(id);
    });
  }

  const handleExport = useCallback(() => {
    const wb = XLSX.utils.book_new();
    const rows = [
      ["Nome", "CNPJ", "Email", "Telefone", "Cidade", "Estado", "Tipo", "Origem", "Status", "Notas", "Data"],
      ...filtered.map((l) => [
        l.nome,
        l.cnpj || "",
        l.email,
        l.telefone,
        l.cidade || "",
        l.estado || "",
        l.tipo_cadastro ? TIPO_LABELS[l.tipo_cadastro] || l.tipo_cadastro : "",
        ORIGEM_LABELS[l.origem] || l.origem,
        STATUS_OPTIONS.find((s) => s.value === l.status)?.label || l.status,
        l.notas || "",
        new Date(l.created_at).toLocaleDateString("pt-BR"),
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [
      { wch: 30 }, { wch: 18 }, { wch: 30 }, { wch: 16 },
      { wch: 20 }, { wch: 6 }, { wch: 14 }, { wch: 16 },
      { wch: 14 }, { wch: 40 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    XLSX.writeFile(wb, `leads-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }, [filtered]);

  const statusOpts = [{ value: "", label: "Todos status" }, ...STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))];
  const origemOpts = [
    { value: "", label: "Todas origens" },
    { value: "revenda", label: "Revenda" },
    { value: "primeiro-pedido", label: "Primeiro Pedido" },
  ];

  const activeFilters = [filterStatus, filterOrigem].filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Leads de Revenda</h1>
          <p className="text-sm text-ink-500 mt-0.5">{leads.length} leads no total</p>
        </div>
        {canExport && (
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 transition-colors"
          >
            <Download size={16} />
            Exportar XLS
          </button>
        )}
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s.value}
            onClick={() => setFilterStatus(filterStatus === s.value ? "" : s.value)}
            className={cn(
              "rounded-xl border p-3 text-left transition-all",
              filterStatus === s.value
                ? "border-brand-olive bg-brand-olive/5 ring-1 ring-brand-olive"
                : "border-ink-100 bg-white hover:border-ink-200"
            )}
          >
            <p className="text-2xl font-semibold text-ink-900">{statusCounts[s.value] || 0}</p>
            <p className="text-xs text-ink-500 mt-0.5">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, email, telefone, CNPJ, cidade..."
            className="w-full rounded-lg border border-ink-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-olive focus:ring-1 focus:ring-brand-olive"
          />
        </div>
        <div className="flex gap-2">
          <div className="w-40">
            <CustomSelect options={statusOpts} value={filterStatus} onChange={setFilterStatus} placeholder="Status" />
          </div>
          <div className="w-40">
            <CustomSelect options={origemOpts} value={filterOrigem} onChange={setFilterOrigem} placeholder="Origem" />
          </div>
          {activeFilters > 0 && (
            <button
              onClick={() => { setFilterStatus(""); setFilterOrigem(""); }}
              className="inline-flex items-center gap-1 rounded-lg border border-ink-200 px-3 py-2 text-xs text-ink-500 hover:bg-ink-50"
            >
              <X size={12} />
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <p className="text-xs text-ink-400">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</p>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-ink-100 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 bg-ink-50/50">
              <th className="px-4 py-3 text-left font-medium text-ink-500">Nome</th>
              <th className="px-4 py-3 text-left font-medium text-ink-500 hidden md:table-cell">Contato</th>
              <th className="px-4 py-3 text-left font-medium text-ink-500 hidden lg:table-cell">Localização</th>
              <th className="px-4 py-3 text-left font-medium text-ink-500 hidden sm:table-cell">Origem</th>
              <th className="px-4 py-3 text-left font-medium text-ink-500">Status</th>
              <th className="px-4 py-3 text-left font-medium text-ink-500 hidden sm:table-cell">Data</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-ink-400">
                  Nenhum lead encontrado.
                </td>
              </tr>
            )}
            {filtered.map((lead) => {
              const isExpanded = expandedId === lead.id;
              const statusInfo = STATUS_OPTIONS.find((s) => s.value === lead.status);
              return (
                <tr key={lead.id} className="group">
                  <td colSpan={7} className="p-0">
                    {/* Main row */}
                    <div
                      className={cn(
                        "grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1fr_auto_auto_auto_auto_auto_auto] items-center cursor-pointer hover:bg-ink-50/50 transition-colors",
                        isExpanded && "bg-ink-50/30"
                      )}
                      onClick={() => setExpandedId(isExpanded ? null : lead.id)}
                    >
                      <div className="px-4 py-3">
                        <p className="font-medium text-ink-900">{lead.nome}</p>
                        {lead.tipo_cadastro && (
                          <p className="text-xs text-ink-400 mt-0.5">{TIPO_LABELS[lead.tipo_cadastro]}</p>
                        )}
                        {lead.cnpj && <p className="text-xs text-ink-400">{lead.cnpj}</p>}
                      </div>
                      <div className="px-4 py-3 hidden md:block">
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1 text-ink-600"><Mail size={12} />{lead.email}</span>
                          <span className="inline-flex items-center gap-1 text-ink-600"><Phone size={12} />{lead.telefone}</span>
                        </div>
                      </div>
                      <div className="px-4 py-3 hidden lg:block">
                        {(lead.cidade || lead.estado) && (
                          <span className="inline-flex items-center gap-1 text-ink-600">
                            <MapPin size={12} />
                            {[lead.cidade, lead.estado].filter(Boolean).join(" - ")}
                          </span>
                        )}
                      </div>
                      <div className="px-4 py-3 hidden sm:block">
                        <span className="text-xs text-ink-500">{ORIGEM_LABELS[lead.origem]}</span>
                      </div>
                      <div className="px-4 py-3">
                        <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-medium", statusInfo?.color)}>
                          {statusInfo?.label}
                        </span>
                      </div>
                      <div className="px-4 py-3 hidden sm:block">
                        <span className="text-xs text-ink-500">{new Date(lead.created_at).toLocaleDateString("pt-BR")}</span>
                      </div>
                      <div className="px-4 py-3">
                        {isExpanded ? <ChevronUp size={16} className="text-ink-400" /> : <ChevronDown size={16} className="text-ink-400" />}
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="border-t border-ink-100 bg-ink-50/20 px-4 py-4 space-y-4">
                        {/* Mobile-only contact info */}
                        <div className="flex flex-col gap-2 md:hidden">
                          <span className="inline-flex items-center gap-2 text-sm text-ink-600"><Mail size={14} />{lead.email}</span>
                          <span className="inline-flex items-center gap-2 text-sm text-ink-600"><Phone size={14} />{lead.telefone}</span>
                          {(lead.cidade || lead.estado) && (
                            <span className="inline-flex items-center gap-2 text-sm text-ink-600">
                              <MapPin size={14} />{[lead.cidade, lead.estado].filter(Boolean).join(" - ")}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs font-medium text-ink-500 mb-1">CNPJ</p>
                            <p className="text-sm text-ink-700">{lead.cnpj || "—"}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-ink-500 mb-1">Tipo</p>
                            <p className="text-sm text-ink-700">{lead.tipo_cadastro ? TIPO_LABELS[lead.tipo_cadastro] : "—"}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-ink-500 mb-1">Recebido em</p>
                            <p className="text-sm text-ink-700 inline-flex items-center gap-1">
                              <Calendar size={12} />
                              {new Date(lead.created_at).toLocaleString("pt-BR")}
                            </p>
                          </div>
                        </div>

                        {/* Status change */}
                        {canEdit && (
                          <div>
                            <p className="text-xs font-medium text-ink-500 mb-1">Alterar status</p>
                            <div className="flex gap-2 flex-wrap">
                              {STATUS_OPTIONS.map((s) => (
                                <button
                                  key={s.value}
                                  disabled={lead.status === s.value || isPending}
                                  onClick={() => handleStatusChange(lead.id, s.value)}
                                  className={cn(
                                    "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                                    lead.status === s.value
                                      ? cn(s.color, "ring-1 ring-current")
                                      : "bg-white border border-ink-200 text-ink-600 hover:bg-ink-50"
                                  )}
                                >
                                  {s.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Notes */}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <MessageSquare size={12} className="text-ink-400" />
                            <p className="text-xs font-medium text-ink-500">Notas</p>
                          </div>
                          {editingNotes === lead.id ? (
                            <div className="space-y-2">
                              <textarea
                                value={notesValue}
                                onChange={(e) => setNotesValue(e.target.value)}
                                rows={3}
                                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-olive focus:ring-1 focus:ring-brand-olive resize-none"
                                placeholder="Adicione observações sobre este lead..."
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleSaveNotes(lead.id)}
                                  disabled={isPending}
                                  className="rounded-lg bg-brand-olive px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-olive-dark disabled:opacity-50"
                                >
                                  Salvar
                                </button>
                                <button
                                  onClick={() => setEditingNotes(null)}
                                  className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600 hover:bg-ink-50"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() => {
                                if (!canEdit) return;
                                setEditingNotes(lead.id);
                                setNotesValue(lead.notas || "");
                              }}
                              className={cn(
                                "rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm min-h-[40px]",
                                canEdit && "cursor-pointer hover:border-ink-200"
                              )}
                            >
                              {lead.notas ? (
                                <p className="text-ink-700 whitespace-pre-wrap">{lead.notas}</p>
                              ) : (
                                <p className="text-ink-400 italic">{canEdit ? "Clique para adicionar notas..." : "Sem notas"}</p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Delete */}
                        {canDelete && (
                          <div className="flex justify-end pt-2 border-t border-ink-100">
                            <button
                              onClick={() => handleDelete(lead.id, lead.nome)}
                              disabled={isPending}
                              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger-soft transition-colors disabled:opacity-50"
                            >
                              <Trash2 size={12} />
                              Remover lead
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
