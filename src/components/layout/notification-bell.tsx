"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, Check, CheckCheck, Megaphone, FileText, Image, Layers, X, ShoppingCart, UserPlus, BellRing, BellOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { markAsRead, markAllAsRead } from "@/app/(dashboard)/notifications-actions";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { usePushNotifications } from "@/hooks/use-push-notifications";

interface Notification {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  icon: string;
  read: boolean;
  created_at: string;
}

const ICON_MAP: Record<string, React.ElementType> = {
  megaphone: Megaphone,
  file: FileText,
  image: Image,
  layers: Layers,
  bell: Bell,
  cart: ShoppingCart,
  user: UserPlus,
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const push = usePushNotifications();

  const unreadCount = notifications.filter((n) => !n.read).length;

  const loadNotifications = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);

    setNotifications(data || []);
    setLoading(false);
  }, []);

  // Load on mount + poll every 30s
  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function handleRead(notif: Notification) {
    if (!notif.read) {
      setNotifications((prev) => prev.map((n) => n.id === notif.id ? { ...n, read: true } : n));
      await markAsRead(notif.id);
    }
    if (notif.href) {
      router.push(notif.href);
      setOpen(false);
    }
  }

  async function handleMarkAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await markAllAsRead();
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-ink-400 hover:text-ink-700 hover:bg-ink-50 transition-colors"
        title="Notificações"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-xl border border-ink-100 bg-white shadow-dropdown z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-ink-100">
            <h3 className="text-sm font-semibold text-ink-900">Notificações</h3>
            <div className="flex items-center gap-1">
              {push.supported && (
                <button
                  onClick={() => push.subscribed ? push.unsubscribe() : push.subscribe()}
                  disabled={push.loading || push.permission === "denied"}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
                    push.subscribed ? "text-brand-olive hover:text-brand-olive-dark" : "text-ink-400 hover:text-ink-700 hover:bg-ink-50",
                    push.permission === "denied" && "opacity-40 cursor-not-allowed"
                  )}
                  title={push.subscribed ? "Push ativo — clique para desativar" : push.permission === "denied" ? "Push bloqueado no navegador" : "Ativar notificações push"}
                >
                  {push.subscribed ? <BellRing size={12} /> : <BellOff size={12} />}
                  <span className="hidden sm:inline">{push.subscribed ? "Push ativo" : "Ativar push"}</span>
                </button>
              )}
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-ink-500 hover:text-ink-700 hover:bg-ink-50 transition-colors"
                  title="Marcar todas como lidas"
                >
                  <CheckCheck size={12} /> Ler todas
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-ink-400 hover:text-ink-700 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <p className="text-xs text-ink-400 text-center py-8">Carregando...</p>
            ) : notifications.length === 0 ? (
              <p className="text-xs text-ink-400 text-center py-8">Nenhuma notificação</p>
            ) : (
              notifications.map((notif) => {
                const Icon = ICON_MAP[notif.icon] || Bell;
                return (
                  <button
                    key={notif.id}
                    onClick={() => handleRead(notif)}
                    className={cn(
                      "flex items-start gap-3 w-full px-4 py-3 text-left hover:bg-ink-50/50 transition-colors border-b border-ink-50 last:border-0",
                      !notif.read && "bg-brand-olive-soft/20"
                    )}
                  >
                    <div className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg mt-0.5",
                      notif.read ? "bg-ink-50 text-ink-400" : "bg-brand-olive-soft text-brand-olive"
                    )}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs leading-snug", notif.read ? "text-ink-600" : "text-ink-900 font-medium")}>
                        {notif.title}
                      </p>
                      {notif.body && (
                        <p className="text-[10px] text-ink-400 mt-0.5">{notif.body}</p>
                      )}
                      <p className="text-[10px] text-ink-400 mt-1">{timeAgo(notif.created_at)}</p>
                    </div>
                    {!notif.read && (
                      <div className="h-2 w-2 rounded-full bg-brand-olive shrink-0 mt-1.5" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
