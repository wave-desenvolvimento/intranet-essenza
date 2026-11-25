"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/sheet";
import { createTicket } from "./actions";

export function NewTicket({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const field = "w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm focus:border-brand-olive focus:outline-none focus:ring-1 focus:ring-brand-olive";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createTicket(formData);
      if (res.error) { setError(res.error); return; }
      setOpen(false);
      toast.success("Chamado aberto");
      onCreated();
    });
  }

  return (
    <>
      <button
        onClick={() => { setError(""); setOpen(true); }}
        className="inline-flex items-center gap-2 rounded-lg bg-brand-olive px-4 py-2 text-sm font-medium text-white hover:bg-brand-olive-dark transition-colors"
      >
        <Plus size={16} /> Novo chamado
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Novo chamado">
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-xs font-medium text-ink-700">
            Assunto
            <select name="tipo" defaultValue="outro" className={`mt-1 ${field}`}>
              <option value="outro">Dúvida ou problema</option>
              <option value="acesso">Acesso</option>
              <option value="senha">Senha</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-ink-700">
            Descrição
            <textarea name="descricao" required rows={5} className={`mt-1 resize-none ${field}`} placeholder="Conte o que está acontecendo" />
          </label>
          {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
          <button type="submit" disabled={isPending} className="w-full rounded-lg bg-brand-olive px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-olive-dark disabled:opacity-50">
            {isPending ? "Enviando..." : "Enviar chamado"}
          </button>
        </form>
      </Sheet>
    </>
  );
}
