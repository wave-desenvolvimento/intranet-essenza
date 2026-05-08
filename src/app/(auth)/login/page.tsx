"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, ArrowRight, Check, Loader2 } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { login, resetPassword } from "./actions";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleLogin(formData: FormData) {
    setError("");
    setSuccess("");
    startTransition(async () => {
      const result = await login(formData);
      if (result?.error) setError(result.error);
    });
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
      {/* Left panel — brand */}
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
              fortalecer a rede Essenza Serra Gaúcha.
            </p>
          </div>
        </div>

        <p className="absolute bottom-6 text-xs text-ink-400">
          © {new Date().getFullYear()} Essenza Serra Gaúcha ·{" "}
          <a href="https://www.wavecommerce.com.br/?utm_source=rodape&utm_medium=sistema-essenza" target="_blank" rel="noopener noreferrer" className="hover:text-ink-600 transition-colors">
            construído por WaveCommerce
          </a>
        </p>
      </div>

      {/* Right panel — form */}
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
            <a
              href="mailto:suporte@emporioessenza.com.br"
              className="font-medium text-brand-olive hover:text-brand-olive-dark transition-colors"
            >
              Falar com suporte
            </a>
          </p>
        </div>

        {/* Mobile footer */}
        <p className="mt-auto pt-8 text-xs text-ink-400 lg:hidden">
          © {new Date().getFullYear()} Essenza Serra Gaúcha ·{" "}
          <a href="https://www.wavecommerce.com.br/?utm_source=rodape&utm_medium=sistema-essenza" target="_blank" rel="noopener noreferrer" className="hover:text-ink-600 transition-colors">
            construído por WaveCommerce
          </a>
        </p>
      </div>
    </div>
  );
}
