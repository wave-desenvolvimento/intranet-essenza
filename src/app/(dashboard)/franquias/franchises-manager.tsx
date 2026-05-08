"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Plus, Search, Pencil, Trash2, X, Building2, MapPin, Users,
  UserCheck, UserX, ArrowRight, Upload,
} from "lucide-react";
import { createFranchise, updateFranchise, deleteFranchise } from "./actions";
import { cn } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/custom-select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";
import { Sheet } from "@/components/ui/sheet";
import { uploadToStorage } from "@/lib/upload";

const SEGMENT_LABELS: Record<string, string> = {
  franquia: "Franquia",
  multimarca_pdv: "Multimarca / PDV",
};

interface Franchise {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
  status: string;
  segment: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  website: string | null;
  logo_url: string | null;
  address: string | null;
  neighborhood: string | null;
  cep: string | null;
  cnpj: string | null;
  opening_hours: string | null;
  manager_name: string | null;
  created_at: string;
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
}

interface Props { franchises: Franchise[] }

const inputCls = "h-9 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10 transition-colors";

export function FranchisesManager({ franchises }: Props) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSegment, setFilterSegment] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const { confirm: confirmAction, dialogProps } = useConfirm();

  // Sheet state
  const [showSheet, setShowSheet] = useState(false);
  const [editing, setEditing] = useState<Franchise | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [segment, setSegment] = useState("franquia");
  const [status, setStatus] = useState("active");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [website, setWebsite] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [address, setAddress] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [cep, setCep] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [openingHours, setOpeningHours] = useState("");
  const [managerName, setManagerName] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const filtered = franchises.filter((f) => {
    const matchSearch = !search || f.name.toLowerCase().includes(search.toLowerCase()) || f.city?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || f.status === filterStatus;
    const matchSegment = !filterSegment || f.segment === filterSegment;
    return matchSearch && matchStatus && matchSegment;
  });

  const totalUsers = franchises.reduce((sum, f) => sum + f.totalUsers, 0);
  const totalActive = franchises.filter((f) => f.status === "active").length;

  function openCreate() {
    setEditing(null);
    setName(""); setCity(""); setState(""); setSegment("franquia"); setStatus("active");
    setPhone(""); setWhatsapp(""); setEmail(""); setInstagram(""); setFacebook("");
    setTiktok(""); setWebsite(""); setLogoUrl(""); setAddress(""); setNeighborhood("");
    setCep(""); setCnpj(""); setOpeningHours(""); setManagerName("");
    setError(""); setShowSheet(true);
  }

  function openEdit(f: Franchise) {
    setEditing(f);
    setName(f.name); setCity(f.city || ""); setState(f.state || ""); setSegment(f.segment); setStatus(f.status);
    setPhone(f.phone || ""); setWhatsapp(f.whatsapp || ""); setEmail(f.email || "");
    setInstagram(f.instagram || ""); setFacebook(f.facebook || ""); setTiktok(f.tiktok || "");
    setWebsite(f.website || ""); setLogoUrl(f.logo_url || ""); setAddress(f.address || "");
    setNeighborhood(f.neighborhood || ""); setCep(f.cep || ""); setCnpj(f.cnpj || "");
    setOpeningHours(f.opening_hours || ""); setManagerName(f.manager_name || "");
    setError(""); setShowSheet(true);
  }

  function closeSheet() { setShowSheet(false); setEditing(null); }

  function buildFormData() {
    const fd = new FormData();
    fd.set("name", name); fd.set("city", city); fd.set("state", state);
    fd.set("segment", segment); fd.set("status", status);
    fd.set("phone", phone); fd.set("whatsapp", whatsapp); fd.set("email", email);
    fd.set("instagram", instagram); fd.set("facebook", facebook); fd.set("tiktok", tiktok);
    fd.set("website", website); fd.set("logo_url", logoUrl); fd.set("address", address);
    fd.set("neighborhood", neighborhood); fd.set("cep", cep); fd.set("cnpj", cnpj);
    fd.set("opening_hours", openingHours); fd.set("manager_name", managerName);
    return fd;
  }

  function handleSave() {
    const fd = buildFormData();
    if (editing) {
      fd.set("id", editing.id);
      startTransition(async () => { const r = await updateFranchise(fd); r?.error ? setError(r.error) : closeSheet(); });
    } else {
      startTransition(async () => { const r = await createFranchise(fd); r?.error ? setError(r.error) : closeSheet(); });
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirmAction({ title: "Remover franquia", message: "Tem certeza que deseja remover esta franquia e todos os dados associados?", confirmLabel: "Remover", destructive: true });
    if (!ok) return;
    startTransition(async () => { const r = await deleteFranchise(id); if (r?.error) setError(r.error); });
  }

  async function handleLogoUpload(file: File) {
    setUploadingLogo(true);
    const r = await uploadToStorage(file, { bucket: "assets", folder: "logos" });
    setUploadingLogo(false);
    if ("url" in r) setLogoUrl(r.url);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">Franquias</h1>
          <p className="text-sm text-ink-500">{franchises.length} franquias · {totalActive} ativas · {totalUsers} usuários</p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <Link href="/usuarios" className="flex items-center gap-2 rounded-lg border border-ink-100 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 transition-colors">
            <Users size={16} /> Ver Todos os Usuários
          </Link>
          <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-brand-olive px-4 py-2 text-sm font-medium text-white hover:bg-brand-olive-dark transition-colors">
            <Plus size={16} /> Nova Franquia
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-4">
        <div className="flex items-center gap-2 rounded-lg border border-ink-100 bg-white py-1 px-3 h-9 flex-1">
          <Search size={14} className="text-ink-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou cidade..." className="flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 outline-none" />
        </div>
        <CustomSelect options={[{ value: "", label: "Todos segmentos" }, { value: "franquia", label: "Franquia" }, { value: "multimarca_pdv", label: "Multimarca / PDV" }]} value={filterSegment} onChange={setFilterSegment} />
        <CustomSelect options={[{ value: "", label: "Todos status" }, { value: "active", label: "Ativas" }, { value: "inactive", label: "Inativas" }]} value={filterStatus} onChange={setFilterStatus} />
      </div>

      {error && !showSheet && <p className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-ink-100 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100">
              <th className="px-4 py-3 text-left font-medium text-ink-500">Franquia</th>
              <th className="px-4 py-3 text-left font-medium text-ink-500 hidden md:table-cell">Cidade</th>
              <th className="px-4 py-3 text-left font-medium text-ink-500 hidden md:table-cell">Segmento</th>
              <th className="px-4 py-3 text-left font-medium text-ink-500">Usuários</th>
              <th className="px-4 py-3 text-left font-medium text-ink-500 hidden lg:table-cell">Status</th>
              <th className="px-4 py-3 text-right font-medium text-ink-500">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-400">Nenhuma franquia encontrada</td></tr>
            ) : filtered.map((f) => (
              <tr key={f.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50 transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/franquias/${f.slug}`} className="flex items-center gap-2.5 group">
                    {f.logo_url ? (
                      <img src={f.logo_url} alt="" className="h-8 w-8 rounded-lg object-cover" />
                    ) : (
                      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", f.status === "active" ? "bg-brand-olive-soft" : "bg-ink-100")}>
                        <Building2 size={15} className={f.status === "active" ? "text-brand-olive" : "text-ink-400"} />
                      </div>
                    )}
                    <span className="font-medium text-ink-900 group-hover:text-brand-olive transition-colors">{f.name}</span>
                  </Link>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  {f.city ? <span className="flex items-center gap-1 text-ink-600"><MapPin size={12} className="text-ink-400" />{f.city}{f.state ? ` - ${f.state}` : ""}</span> : <span className="text-ink-400">—</span>}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", f.segment === "franquia" ? "bg-brand-olive-soft text-brand-olive-dark" : "bg-info-soft text-info")}>{SEGMENT_LABELS[f.segment] || f.segment}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-ink-600"><Users size={13} className="text-ink-400" />{f.totalUsers}</span>
                    <span className="flex items-center gap-1 text-[11px] text-success"><UserCheck size={11} /> {f.activeUsers}</span>
                    {f.inactiveUsers > 0 && <span className="flex items-center gap-1 text-[11px] text-ink-400"><UserX size={11} /> {f.inactiveUsers}</span>}
                  </div>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", f.status === "active" ? "bg-success-soft text-success" : "bg-ink-100 text-ink-500")}>{f.status === "active" ? "Ativa" : "Inativa"}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Link href={`/franquias/${f.slug}`} className="rounded-md p-1.5 text-ink-400 hover:text-brand-olive hover:bg-brand-olive-soft transition-colors" title="Ver detalhes"><ArrowRight size={14} /></Link>
                    <button onClick={() => openEdit(f)} className="rounded-md p-1.5 text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors" title="Editar"><Pencil size={14} /></button>
                    <button onClick={() => handleDelete(f.id)} disabled={isPending} className="rounded-md p-1.5 text-ink-400 hover:text-danger hover:bg-danger-soft transition-colors" title="Remover"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sheet with all fields */}
      <Sheet open={showSheet} onClose={closeSheet} onSubmit={handleSave} title={editing ? "Editar Franquia" : "Nova Franquia"} wide>
        <div className="flex flex-col gap-5">
          {/* Identity */}
          <fieldset>
            <legend className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-3">Identificação</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-ink-700 mb-1 block">Nome *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} autoFocus className={inputCls} placeholder="Essenza Gramado" />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-700 mb-1 block">CNPJ</label>
                <input value={cnpj} onChange={(e) => setCnpj(e.target.value)} className={inputCls} placeholder="12.345.678/0001-90" />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-700 mb-1 block">Responsável</label>
                <input value={managerName} onChange={(e) => setManagerName(e.target.value)} className={inputCls} placeholder="Nome do gerente" />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-700 mb-1 block">Segmento</label>
                <CustomSelect options={[{ value: "franquia", label: "Franquia" }, { value: "multimarca_pdv", label: "Multimarca / PDV" }]} value={segment} onChange={setSegment} />
              </div>
              {editing && (
                <div>
                  <label className="text-xs font-medium text-ink-700 mb-1 block">Status</label>
                  <CustomSelect options={[{ value: "active", label: "Ativa" }, { value: "inactive", label: "Inativa" }]} value={status} onChange={setStatus} />
                </div>
              )}
            </div>
          </fieldset>

          {/* Logo */}
          <fieldset>
            <legend className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-3">Logo</legend>
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <div className="relative">
                  <img src={logoUrl} alt="Logo" className="h-16 w-16 rounded-xl object-cover border border-ink-100" />
                  <button type="button" onClick={() => setLogoUrl("")} className="absolute -top-1.5 -right-1.5 rounded-full bg-ink-700 p-0.5 text-white hover:bg-danger"><X size={10} /></button>
                </div>
              ) : (
                <label className={cn("flex h-16 w-16 items-center justify-center rounded-xl border-2 border-dashed cursor-pointer transition-colors", uploadingLogo ? "border-brand-olive bg-brand-olive-soft/30" : "border-ink-200 hover:border-brand-olive")}>
                  <input type="file" accept="image/*" className="sr-only" disabled={uploadingLogo} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }} />
                  {uploadingLogo ? <span className="text-[9px] text-brand-olive">...</span> : <Upload size={16} className="text-ink-400" />}
                </label>
              )}
              <p className="text-[10px] text-ink-400">Quadrada, mín. 200x200px</p>
            </div>
          </fieldset>

          {/* Address */}
          <fieldset>
            <legend className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-3">Endereço</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-ink-700 mb-1 block">Endereço</label>
                <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} placeholder="Rua Marechal Deodoro, 123" />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-700 mb-1 block">Bairro</label>
                <input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className={inputCls} placeholder="Centro" />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-700 mb-1 block">CEP</label>
                <input value={cep} onChange={(e) => setCep(e.target.value)} className={inputCls} placeholder="95700-000" />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-700 mb-1 block">Cidade</label>
                <input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} placeholder="Bento Gonçalves" />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-700 mb-1 block">Estado</label>
                <input value={state} onChange={(e) => setState(e.target.value)} className={inputCls} placeholder="RS" maxLength={2} />
              </div>
            </div>
          </fieldset>

          {/* Contact */}
          <fieldset>
            <legend className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-3">Contato</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-ink-700 mb-1 block">Telefone</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="(54) 3333-4444" />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-700 mb-1 block">WhatsApp</label>
                <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={inputCls} placeholder="5554999887766" />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-700 mb-1 block">E-mail</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="contato@essenza.com" />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-700 mb-1 block">Horário de funcionamento</label>
                <input value={openingHours} onChange={(e) => setOpeningHours(e.target.value)} className={inputCls} placeholder="Seg-Sáb 9h-19h" />
              </div>
            </div>
          </fieldset>

          {/* Social */}
          <fieldset>
            <legend className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-3">Redes Sociais</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-ink-700 mb-1 block">Instagram</label>
                <input value={instagram} onChange={(e) => setInstagram(e.target.value)} className={inputCls} placeholder="@essenza.gramado" />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-700 mb-1 block">Facebook</label>
                <input value={facebook} onChange={(e) => setFacebook(e.target.value)} className={inputCls} placeholder="/essenzagramado" />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-700 mb-1 block">TikTok</label>
                <input value={tiktok} onChange={(e) => setTiktok(e.target.value)} className={inputCls} placeholder="@essenza.gramado" />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-700 mb-1 block">Website</label>
                <input value={website} onChange={(e) => setWebsite(e.target.value)} className={inputCls} placeholder="essenzagramado.com.br" />
              </div>
            </div>
          </fieldset>

          {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

          <div className="flex gap-2 pt-2 border-t border-ink-100 mt-2">
            <button onClick={handleSave} disabled={isPending || !name} className="flex-1 rounded-lg bg-brand-olive px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-olive-dark disabled:opacity-50 transition-colors">{isPending ? "Salvando..." : editing ? "Salvar" : "Criar"}</button>
            <button onClick={closeSheet} className="rounded-lg border border-ink-100 px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50 transition-colors">Cancelar</button>
          </div>
        </div>
      </Sheet>
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
