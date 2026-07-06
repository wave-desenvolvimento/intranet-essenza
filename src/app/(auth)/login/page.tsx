"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, ArrowRight, Check, Loader2, X, Headset } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { login, resetPassword } from "./actions";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportStatus, setSupportStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [supportError, setSupportError] = useState("");

  function handleLogin(formData: FormData) {
    setError("");
    setSuccess("");
    startTransition(async () => {
      const result = await login(formData);
      if (result?.error) setError(result.error);
    });
  }

  async function handleSupportSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSupportStatus("sending");
    setSupportError("");
    const fd = new FormData(e.currentTarget);
    const supabase = createClient();
    const { error: err } = await supabase.from("support_tickets").insert({
      nome: fd.get("nome") as string,
      email: fd.get("email") as string,
      tipo: fd.get("tipo") as string,
      descricao: fd.get("descricao") as string,
    });
    if (err) {
      setSupportStatus("error");
      setSupportError("Erro ao enviar. Tente novamente.");
    } else {
      setSupportStatus("sent");
    }
  }

  function handleForgotPassword(email: string) {
    setError("");
    setSuccess("");
    const fd = new FormData();
    fd.set("email", email);
    startTransition(async () => {
      const result = await resetPassword(fd);
      if (result?.error) setError(result.error);
      if (result?.success) setSuccess(result.success);
    });
  }

  return (
    <div className="flex min-h-dvh">
      {/* Left panel - brand */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center bg-brand-olive-soft overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-brand-olive/5" />
        <div className="absolute -bottom-16 -right-16 h-64 w-64 rounded-full bg-brand-olive/5" />

        <div className="relative z-10 flex flex-col items-center gap-10 px-14">
          <BrandLogo size={140} />

          <div className="flex flex-col items-center gap-4 max-w-md">
            <h1 className="text-center text-3xl font-bold leading-snug text-ink-900">
              Tudo que você precisa,
              <br />
              em um <span className="text-brand-olive">só lugar.</span>
            </h1>
            <p className="text-center text-base leading-relaxed text-ink-600">
              Campanhas, materiais e conteúdo organizados para
              conectar a marca.
            </p>
          </div>
        </div>

        <p className="absolute bottom-6 text-xs text-ink-400">
          © {new Date().getFullYear()} Empório Essenza Serra Gaúcha ·{" "}
          <a href="https://www.wavecommerce.com.br/?utm_source=rodape&utm_medium=sistema-essenza" target="_blank" rel="noopener noreferrer" className="hover:text-ink-600 transition-colors">
            construído por WaveCommerce
          </a>
        </p>
      </div>

      {/* Right panel - form */}
      <div className="flex w-full lg:w-1/2 flex-col items-center justify-center px-6 py-12 bg-brand-cream">
        {/* Mobile logo */}
        <div className="mb-10 lg:hidden">
          <BrandLogo size={56} />
        </div>

        <div className="w-full max-w-sm">
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-ink-900">
              Bem-vindo de volta
            </h2>
            <p className="mt-2 text-sm text-ink-500">
              Acesse com suas credenciais para continuar.
            </p>
          </div>

          {/* Form */}
          <form action={handleLogin} className="flex flex-col gap-5">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium text-ink-700">
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="seu@email.com"
                required
                className="h-11 rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/15 transition-colors"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium text-ink-700">
                  Senha
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const emailInput = document.getElementById("email") as HTMLInputElement;
                    handleForgotPassword(emailInput?.value || "");
                  }}
                  className="text-xs font-medium text-brand-olive hover:text-brand-olive-dark transition-colors"
                >
                  Esqueceu a senha?
                </button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                  className="h-11 w-full rounded-xl border border-ink-200 bg-white px-3.5 pr-11 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/15 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-ink-400 hover:text-ink-600 transition-colors"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <button
              type="button"
              onClick={() => setRememberMe(!rememberMe)}
              className="flex items-center gap-2.5 self-start -mt-1"
            >
              <div
                className={`flex h-4 w-4 items-center justify-center rounded border-[1.5px] transition-all ${rememberMe
                  ? "border-brand-olive bg-brand-olive"
                  : "border-ink-300 bg-white"
                  }`}
              >
                {rememberMe && <Check size={10} className="text-white" strokeWidth={3} />}
              </div>
              <span className="text-sm text-ink-600">Manter-me conectado</span>
            </button>

            {/* Error / Success */}
            {error && (
              <p className="rounded-xl bg-danger-soft px-4 py-2.5 text-sm text-danger">
                {error}
              </p>
            )}
            {success && (
              <p className="rounded-xl bg-success-soft px-4 py-2.5 text-sm text-success">
                {success}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isPending}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-olive text-white text-sm font-medium hover:bg-brand-olive-dark disabled:opacity-60 transition-colors mt-1"
            >
              {isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  Entrar
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Support */}
          <p className="mt-8 text-center text-sm text-ink-400">
            Problemas para acessar?{" "}
            <button
              type="button"
              onClick={() => { setSupportOpen(true); setSupportStatus("idle"); setSupportError(""); }}
              className="font-medium text-brand-olive hover:text-brand-olive-dark transition-colors"
            >
              Falar com suporte
            </button>
          </p>
        </div>

        {/* Mobile footer */}
        <p className="mt-auto pt-8 text-xs text-ink-400 lg:hidden">
          © {new Date().getFullYear()} Empório Essenza Serra Gaúcha ·{" "}
          <a href="https://www.wavecommerce.com.br/?utm_source=rodape&utm_medium=sistema-essenza" target="_blank" rel="noopener noreferrer" className="hover:text-ink-600 transition-colors">
            construído por WaveCommerce
          </a>
        </p>
      </div>

      {/* Support modal */}
      {supportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSupportOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <button
              onClick={() => setSupportOpen(false)}
              className="absolute top-4 right-4 rounded-lg p-1 text-ink-400 hover:text-ink-700 hover:bg-ink-50 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-olive-soft text-brand-olive">
                <Headset size={20} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-ink-900">Suporte</h3>
                <p className="text-xs text-ink-500">Descreva seu problema de acesso</p>
              </div>
            </div>

            {supportStatus === "sent" ? (
              <div className="text-center py-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success mx-auto mb-3">
                  <Check size={24} />
                </div>
                <p className="text-sm font-medium text-ink-900 mb-1">Ticket enviado</p>
                <p className="text-xs text-ink-500">Entraremos em contato pelo email informado.</p>
                <button
                  onClick={() => setSupportOpen(false)}
                  className="mt-5 rounded-xl bg-ink-100 px-6 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-200 transition-colors"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <form onSubmit={handleSupportSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-ink-700">Nome</label>
                  <input
                    name="nome"
                    required
                    placeholder="Seu nome completo"
                    className="h-10 rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/15"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-ink-700">E-mail</label>
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="seu@email.com"
                    className="h-10 rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/15"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-ink-700">Tipo do problema</label>
                  <select
                    name="tipo"
                    required
                    className="h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/15"
                  >
                    <option value="acesso">Nao consigo acessar</option>
                    <option value="senha">Esqueci minha senha</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-ink-700">Descricao</label>
                  <textarea
                    name="descricao"
                    required
                    rows={3}
                    placeholder="Descreva o problema que esta enfrentando..."
                    className="rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/15 resize-none"
                  />
                </div>

                {supportError && (
                  <p className="rounded-xl bg-danger-soft px-4 py-2 text-sm text-danger">{supportError}</p>
                )}

                <button
                  type="submit"
                  disabled={supportStatus === "sending"}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-olive text-white text-sm font-medium hover:bg-brand-olive-dark disabled:opacity-60 transition-colors"
                >
                  {supportStatus === "sending" ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    "Enviar ticket"
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
