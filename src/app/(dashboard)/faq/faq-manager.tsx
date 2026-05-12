"use client";

import { useState, useTransition } from "react";
import {
  Plus, Pencil, Trash2, Search, ChevronDown, BookOpen, HelpCircle, Tag,
} from "lucide-react";
import { createFaqItem, updateFaqItem, deleteFaqItem, createFaqCategory, deleteFaqCategory } from "./actions";
import { cn } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/custom-select";
import { Sheet } from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface FaqItem { [key: string]: any; }
interface FaqCategory { id: string; name: string; slug: string; icon: string; }

interface Props {
  items: FaqItem[];
  categories: FaqCategory[];
  canManage: boolean;
}

export function FaqManager({ items, categories, canManage }: Props) {
  const { confirm: confirmAction, dialogProps } = useConfirm();
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showSheet, setShowSheet] = useState(false);
  const [editing, setEditing] = useState<FaqItem | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  // Category management
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const categoryOptions = [{ value: "", label: "Sem categoria" }, ...categories.map((c) => ({ value: c.id, label: c.name }))];
  const filterOptions = [{ value: "", label: "Todas as categorias" }, ...categories.map((c) => ({ value: c.id, label: c.name }))];

  const filtered = items.filter((item) => {
    if (!item.published && !canManage) return false;
    const matchSearch = !search ||
      item.question.toLowerCase().includes(search.toLowerCase()) ||
      item.answer.replace(/<[^>]*>/g, "").toLowerCase().includes(search.toLowerCase());
    const matchCategory = !filterCategory || item.category_id === filterCategory;
    return matchSearch && matchCategory;
  });

  // Group by category
  const uncategorized = filtered.filter((i) => !i.category_id);
  const grouped = categories
    .map((c) => ({ category: c, items: filtered.filter((i) => i.category_id === c.id) }))
    .filter((g) => g.items.length > 0);

  function openCreate() {
    setEditing(null); setQuestion(""); setAnswer(""); setCategoryId("");
    setError(""); setShowSheet(true);
  }

  function openEdit(item: FaqItem) {
    setEditing(item); setQuestion(item.question); setAnswer(item.answer);
    setCategoryId(item.category_id || "");
    setError(""); setShowSheet(true);
  }

  function closeSheet() { setShowSheet(false); setEditing(null); }

  function handleSave() {
    const fd = new FormData();
    fd.set("question", question); fd.set("answer", answer); fd.set("categoryId", categoryId);
    if (editing) {
      fd.set("id", editing.id); fd.set("published", String(editing.published));
      startTransition(async () => { const r = await updateFaqItem(fd); r?.error ? setError(r.error) : closeSheet(); });
    } else {
      startTransition(async () => { const r = await createFaqItem(fd); r?.error ? setError(r.error) : closeSheet(); });
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirmAction({ title: "Remover pergunta", message: "Tem certeza?", confirmLabel: "Remover", destructive: true });
    if (!ok) return;
    startTransition(async () => { const r = await deleteFaqItem(id); if (r?.error) setError(r.error); });
  }

  function handleCreateCategory() {
    if (!newCategoryName.trim()) return;
    startTransition(async () => {
      const r = await createFaqCategory(newCategoryName.trim(), "folder");
      if (r?.error) setError(r.error);
      else { setNewCategoryName(""); setShowCategorySheet(false); }
    });
  }

  async function handleDeleteCategory(id: string) {
    const ok = await confirmAction({ title: "Remover categoria", message: "As perguntas serão mantidas sem categoria.", confirmLabel: "Remover", destructive: true });
    if (!ok) return;
    startTransition(async () => { const r = await deleteFaqCategory(id); if (r?.error) setError(r.error); });
  }

  function renderItem(item: FaqItem) {
    const isOpen = expandedId === item.id;
    return (
      <div key={item.id} className={cn("border-b border-ink-50 last:border-0", !item.published && "opacity-50")}>
        <button
          onClick={() => setExpandedId(isOpen ? null : item.id)}
          className="flex items-center gap-3 w-full px-5 py-4 text-left hover:bg-ink-50/50 transition-colors"
        >
          <HelpCircle size={16} className={cn("shrink-0", isOpen ? "text-brand-olive" : "text-ink-400")} />
          <span className={cn("flex-1 text-sm font-medium", isOpen ? "text-brand-olive" : "text-ink-900")}>{item.question}</span>
          {canManage && (
            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => openEdit(item)} className="rounded-md p-1 text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors"><Pencil size={12} /></button>
              <button onClick={() => handleDelete(item.id)} className="rounded-md p-1 text-ink-400 hover:text-danger hover:bg-danger-soft transition-colors"><Trash2 size={12} /></button>
            </div>
          )}
          <ChevronDown size={14} className={cn("shrink-0 text-ink-400 transition-transform", isOpen && "rotate-180")} />
        </button>
        {isOpen && (
          <div className="px-5 pb-4 pl-12">
            <div className="prose prose-sm max-w-none text-ink-700" dangerouslySetInnerHTML={{ __html: item.answer }} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">FAQ</h1>
          <p className="text-sm text-ink-500">{items.filter((i) => i.published).length} perguntas frequentes</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCategorySheet(true)} className="flex items-center gap-2 rounded-lg border border-ink-100 px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 transition-colors">
              <Tag size={14} /> Categorias
            </button>
            <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-brand-olive px-4 py-2 text-sm font-medium text-white hover:bg-brand-olive-dark transition-colors">
              <Plus size={16} /> Nova Pergunta
            </button>
          </div>
        )}
      </div>

      {/* Search + filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-5">
        <div className="flex items-center gap-2 rounded-lg border border-ink-100 bg-white py-1 px-3 h-10 flex-1">
          <Search size={15} className="text-ink-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar pergunta..." className="flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 outline-none" />
        </div>
        {categories.length > 0 && (
          <CustomSelect options={filterOptions} value={filterCategory} onChange={setFilterCategory} />
        )}
      </div>

      {error && !showSheet && <p className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-200 bg-ink-50/50 py-16">
          <BookOpen size={32} className="text-ink-300 mb-2" />
          <p className="text-sm text-ink-400">{search ? "Nenhuma pergunta encontrada" : "Nenhuma pergunta cadastrada"}</p>
          {canManage && !search && <button onClick={openCreate} className="mt-2 text-sm font-medium text-brand-olive">Criar primeira</button>}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Grouped by category */}
          {grouped.map(({ category, items: catItems }) => (
            <div key={category.id}>
              <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-1 mb-2">{category.name}</p>
              <div className="rounded-xl border border-ink-100 bg-white overflow-hidden">
                {catItems.map(renderItem)}
              </div>
            </div>
          ))}

          {/* Uncategorized */}
          {uncategorized.length > 0 && (
            <div>
              {grouped.length > 0 && <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-1 mb-2">Geral</p>}
              <div className="rounded-xl border border-ink-100 bg-white overflow-hidden">
                {uncategorized.map(renderItem)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* FAQ Item Sheet */}
      <Sheet open={showSheet} onClose={closeSheet} onSubmit={handleSave} title={editing ? "Editar Pergunta" : "Nova Pergunta"} wide>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-ink-700 mb-1.5 block">Pergunta</label>
            <input value={question} onChange={(e) => setQuestion(e.target.value)} autoFocus className="h-10 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10" placeholder="Como faço para..." />
          </div>
          <div>
            <label className="text-sm font-medium text-ink-700 mb-1.5 block">Resposta</label>
            <RichTextEditor value={answer} onChange={setAnswer} placeholder="Explique a resposta..." />
          </div>
          <div>
            <label className="text-sm font-medium text-ink-700 mb-1.5 block">Categoria</label>
            <CustomSelect options={categoryOptions} value={categoryId} onChange={setCategoryId} />
          </div>
          {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="flex gap-2 pt-2 border-t border-ink-100 mt-2">
            <button onClick={handleSave} disabled={isPending || !question || !answer} className="flex-1 rounded-lg bg-brand-olive px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-olive-dark disabled:opacity-50">{isPending ? "Salvando..." : editing ? "Salvar" : "Criar"}</button>
            <button onClick={closeSheet} className="rounded-lg border border-ink-100 px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50">Cancelar</button>
          </div>
        </div>
      </Sheet>

      {/* Category Management Sheet */}
      <Sheet open={showCategorySheet} onClose={() => setShowCategorySheet(false)} title="Gerenciar Categorias">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Nome da categoria" className="h-9 flex-1 rounded-lg border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-olive focus:outline-none" />
            <button onClick={handleCreateCategory} disabled={isPending || !newCategoryName.trim()} className="rounded-lg bg-brand-olive px-3 py-2 text-sm font-medium text-white hover:bg-brand-olive-dark disabled:opacity-50">Criar</button>
          </div>
          {categories.length === 0 ? (
            <p className="text-xs text-ink-400 py-4 text-center">Nenhuma categoria</p>
          ) : (
            <div className="rounded-xl border border-ink-100 bg-white divide-y divide-ink-50">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-ink-900">{c.name}</span>
                  <button onClick={() => handleDeleteCategory(c.id)} disabled={isPending} className="text-ink-400 hover:text-danger"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Sheet>

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
