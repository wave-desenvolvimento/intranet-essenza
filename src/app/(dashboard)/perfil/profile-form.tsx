"use client";

import { useState, useTransition, useEffect } from "react";
import { User, Mail, Building2, Lock, Upload, Camera, Eye, EyeOff, Bell, BellOff } from "lucide-react";
import { updateProfile, changePassword, updateEmailPrefs } from "./actions";
import { uploadToStorage } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  fullName: string;
  email: string;
  franchiseName: string | null;
  avatarUrl: string;
  emailPrefs: Record<string, boolean>;
}

const EMAIL_CATEGORIES = [
  { key: "announcements", label: "Comunicados", desc: "Novos comunicados publicados pela rede" },
  { key: "surveys", label: "Pesquisas", desc: "Novas pesquisas para responder" },
  { key: "orders", label: "Pedidos", desc: "Atualizacoes de status dos pedidos" },
  { key: "content", label: "Conteudo (CMS)", desc: "Novos materiais publicados nas paginas" },
] as const;

// Defaults: content off, rest on
const PREF_DEFAULTS: Record<string, boolean> = {
  content: false,
  announcements: true,
  surveys: true,
  orders: true,
};

const inputCls = "h-10 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10";

export function ProfileForm({ fullName: initialName, email, franchiseName, avatarUrl: initialAvatar, emailPrefs: initialPrefs }: Props) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(initialName);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatar);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Password
  const [showPassSection, setShowPassSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [passError, setPassError] = useState("");

  // Email prefs
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() => {
    const merged = { ...PREF_DEFAULTS };
    for (const [k, v] of Object.entries(initialPrefs)) merged[k] = v;
    return merged;
  });

  function togglePref(key: string) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    startTransition(async () => {
      const r = await updateEmailPrefs(next);
      if (r?.error) toast.error(r.error);
      else toast.success("Preferencias atualizadas");
    });
  }

  // Scroll to #notificacoes if hash is present (from email link)
  useEffect(() => {
    if (window.location.hash === "#notificacoes") {
      document.getElementById("notificacoes")?.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  function handleSaveProfile() {
    const fd = new FormData();
    fd.set("fullName", name);
    fd.set("avatarUrl", avatarUrl);
    startTransition(async () => {
      const r = await updateProfile(fd);
      if (r?.error) toast.error(r.error);
      else toast.success("Perfil atualizado");
    });
  }

  function handleChangePassword() {
    setPassError("");
    const fd = new FormData();
    fd.set("currentPassword", currentPassword);
    fd.set("newPassword", newPassword);
    fd.set("confirmPassword", confirmPassword);
    startTransition(async () => {
      const r = await changePassword(fd);
      if (r?.error) setPassError(r.error);
      else {
        toast.success(r.success);
        setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
        setShowPassSection(false);
      }
    });
  }

  async function handleAvatarUpload(file: File) {
    setUploadingAvatar(true);
    const r = await uploadToStorage(file, { bucket: "assets", folder: "avatars" });
    setUploadingAvatar(false);
    if ("url" in r) setAvatarUrl(r.url);
  }

  const initial = (name || email)?.[0]?.toUpperCase() || "U";

  return (
    <div className="max-w-lg">
      <h1 className="text-lg font-semibold text-ink-900 mb-1">Meu Perfil</h1>
      <p className="text-sm text-ink-500 mb-6">Gerencie suas informações pessoais.</p>

      {/* Avatar + Name */}
      <div className="rounded-xl border border-ink-100 bg-white p-5 mb-4">
        <div className="flex items-center gap-4 mb-5">
          <div className="relative">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover border-2 border-ink-100" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-olive text-white text-xl font-semibold">
                {initial}
              </div>
            )}
            <label className={cn(
              "absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white cursor-pointer transition-colors",
              uploadingAvatar ? "bg-brand-olive-soft" : "bg-ink-100 hover:bg-ink-200"
            )}>
              <input type="file" accept="image/*" className="sr-only" disabled={uploadingAvatar} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); }} />
              {uploadingAvatar ? <span className="text-[8px] text-brand-olive">...</span> : <Camera size={12} className="text-ink-500" />}
            </label>
          </div>
          <div>
            <p className="text-sm font-medium text-ink-900">{name || "Usuário"}</p>
            <p className="text-xs text-ink-500">{email}</p>
            {franchiseName && (
              <p className="flex items-center gap-1 text-xs text-ink-400 mt-0.5">
                <Building2 size={11} /> {franchiseName}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-medium text-ink-700 mb-1 block">Nome completo</label>
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input value={name} onChange={(e) => setName(e.target.value)} className={cn(inputCls, "pl-9")} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-ink-700 mb-1 block">E-mail</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input value={email} disabled className={cn(inputCls, "pl-9 bg-ink-50 text-ink-400")} />
            </div>
          </div>
          <button onClick={handleSaveProfile} disabled={isPending || !name} className="self-start rounded-lg bg-brand-olive px-4 py-2 text-sm font-medium text-white hover:bg-brand-olive-dark disabled:opacity-50 transition-colors mt-1">
            {isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      {/* Email notifications */}
      <div id="notificacoes" className="rounded-xl border border-ink-100 bg-white p-5 mb-4 scroll-mt-8">
        <div className="flex items-center gap-2 mb-4">
          <Bell size={15} className="text-ink-400" />
          <h3 className="text-sm font-semibold text-ink-900">Notificacoes por email</h3>
        </div>
        <p className="text-xs text-ink-500 mb-4">Escolha quais tipos de email voce quer receber. Notificacoes no app e push continuam funcionando normalmente.</p>
        <div className="flex flex-col divide-y divide-ink-50">
          {EMAIL_CATEGORIES.map((cat) => {
            const enabled = prefs[cat.key] ?? PREF_DEFAULTS[cat.key];
            return (
              <div key={cat.key} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-900">{cat.label}</p>
                  <p className="text-xs text-ink-400">{cat.desc}</p>
                </div>
                <button
                  type="button"
                  onClick={() => togglePref(cat.key)}
                  disabled={isPending}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
                    enabled ? "bg-brand-olive" : "bg-ink-200"
                  )}
                >
                  <span className={cn(
                    "inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                    enabled ? "translate-x-6" : "translate-x-1"
                  )} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Password */}
      <div className="rounded-xl border border-ink-100 bg-white p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock size={15} className="text-ink-400" />
            <h3 className="text-sm font-semibold text-ink-900">Senha</h3>
          </div>
          <button onClick={() => setShowPassSection(!showPassSection)} className="text-xs font-medium text-brand-olive hover:text-brand-olive-dark transition-colors">
            {showPassSection ? "Cancelar" : "Alterar senha"}
          </button>
        </div>

        {showPassSection && (
          <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-ink-100">
            <div>
              <label className="text-xs font-medium text-ink-700 mb-1 block">Senha atual</label>
              <div className="relative">
                <input type={showPass ? "text" : "password"} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={cn(inputCls, "pr-10")} />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600">
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-ink-700 mb-1 block">Nova senha</label>
              <input type={showPass ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputCls} placeholder="Mínimo 6 caracteres" />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-700 mb-1 block">Confirmar nova senha</label>
              <input type={showPass ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputCls} />
            </div>
            {passError && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{passError}</p>}
            <button onClick={handleChangePassword} disabled={isPending || !currentPassword || !newPassword} className="self-start rounded-lg bg-brand-olive px-4 py-2 text-sm font-medium text-white hover:bg-brand-olive-dark disabled:opacity-50 transition-colors">
              {isPending ? "Alterando..." : "Alterar senha"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
