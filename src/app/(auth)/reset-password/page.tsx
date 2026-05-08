"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, ArrowRight, Loader2, Check } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { updatePassword } from "./actions";

export default function ResetPasswordPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = await updatePassword(formData);
      if (result?.error) setError(result.error);
      else setSuccess(true);
    });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10 bg-brand-cream">
      <div className="w-full max-w-[380px]">
        <div className="flex justify-center mb-8">
          <BrandLogo size={56} />
        </div>

        {success ? (
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success-soft">
                <Check size={24} className="text-success" strokeWidth={3} />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-ink-900 mb-2">Senha atualizada</h2>
            <p className="text-sm text-ink-500 mb-6">Sua senha foi alterada com sucesso.</p>
            <a href="/login" className="inline-flex items-center gap-2 rounded-[10px] bg-brand-olive px-6 py-3 text-sm font-medium text-white hover:bg-brand-olive-dark transition-colors">
              Ir para login <ArrowRight size={14} />
            </a>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2.5 mb-8">
              <h2 className="text-[22px] font-semibold text-ink-900">Nova senha</h2>
              <p className="text-sm text-ink-500">Defina sua nova senha de acesso.</p>
            </div>

            <form action={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-sm font-medium text-ink-700">Nova senha</label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    placeholder="Mínimo 6 caracteres"
                    className="h-12 w-full rounded-[10px] border border-ink-100 bg-white px-3.5 pr-12 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-400 hover:text-ink-600">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="confirmPassword" className="text-sm font-medium text-ink-700">Confirmar senha</label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  placeholder="Repita a senha"
                  className="h-12 w-full rounded-[10px] border border-ink-100 bg-white px-3.5 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10"
                />
              </div>

              {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

              <button type="submit" disabled={isPending} className="flex h-[46px] items-center justify-center gap-2 rounded-[10px] bg-brand-olive text-white text-sm font-medium hover:bg-brand-olive-dark disabled:opacity-60 transition-colors mt-2">
                {isPending ? <Loader2 size={15} className="animate-spin" /> : <>Salvar nova senha <ArrowRight size={14} /></>}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
