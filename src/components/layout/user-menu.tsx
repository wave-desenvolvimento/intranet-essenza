"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import Link from "next/link";
import { User, LogOut } from "lucide-react";
import { logout } from "@/app/(dashboard)/actions";

interface UserMenuProps {
  user: {
    name: string;
    email: string;
    role?: string;
  };
}

export function UserMenu({ user }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  const initial = (user.name || user.email)?.[0]?.toUpperCase() || "U";

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleLogout() {
    startTransition(() => logout());
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg px-1 sm:px-2 py-1 hover:bg-ink-50 transition-colors"
      >
        <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full bg-brand-olive text-white text-xs sm:text-sm font-medium">
          {initial}
        </div>
        <div className="hidden sm:block text-left min-w-0">
          <p className="truncate text-sm font-medium text-ink-900">{user.name || "Usuário"}</p>
          <p className="truncate text-xs text-ink-500">{user.role || "Administrador"}</p>
        </div>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-ink-100 bg-white py-1 shadow-dropdown z-50">
          <div className="px-3 py-2 border-b border-ink-100 sm:hidden">
            <p className="truncate text-sm font-medium text-ink-900">{user.name || "Usuário"}</p>
            <p className="truncate text-xs text-ink-500">{user.email}</p>
          </div>
          <Link
            href="/perfil"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-ink-700 hover:bg-ink-50 transition-colors"
          >
            <User size={14} className="text-ink-400" />
            Meu Perfil
          </Link>
          <button
            onClick={handleLogout}
            disabled={isPending}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-ink-700 hover:bg-ink-50 disabled:opacity-50 transition-colors"
          >
            <LogOut size={14} className="text-ink-400" />
            {isPending ? "Saindo..." : "Sair"}
          </button>
        </div>
      )}
    </div>
  );
}
