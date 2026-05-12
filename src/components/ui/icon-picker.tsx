"use client";

import { useState } from "react";
import {
  Monitor, Package, ShoppingBag, ShoppingCart, Gift, Tag, Star, Heart, Sparkles,
  Megaphone, Image, FileText, Folder, Layers, Video, Music,
  Camera, Palette, Brush, Scissors, Printer, Mail, Send,
  Globe, Share2,
  Store, Building2, MapPin, Users, User, Crown,
  Flame, Zap, Award, Trophy, Target, TrendingUp,
  Calendar, Clock, Bell, Bookmark, Flag, Search,
  Box, Truck, CreditCard, Receipt, BarChart3, PieChart,
  Smartphone, Laptop, Tv, Wifi, Download, Upload,
  Eye, Coffee, Wine, Leaf, Flower2, Sun, Moon,
  GraduationCap, BookOpen, Lightbulb, Puzzle, Settings, Wrench, X,
  LayoutDashboard, ShieldCheck, MonitorCog, Stamp, History,
} from "lucide-react";
import { cn } from "@/lib/utils";

// SVG icons for social networks (not available in Lucide)
function IconInstagram({ size = 16, className }: { size?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="20" height="20" x="2" y="2" rx="5" /><circle cx="12" cy="12" r="5" /><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" /></svg>;
}
function IconFacebook({ size = 16, className }: { size?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>;
}
function IconX({ size = 16, className }: { size?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>;
}
function IconTiktok({ size = 16, className }: { size?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.88-2.88 2.89 2.89 0 0 1 2.88-2.88c.28 0 .56.04.82.12v-3.5a6.37 6.37 0 0 0-.82-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.87a8.16 8.16 0 0 0 4.76 1.52v-3.4a4.85 4.85 0 0 1-1-.3z" /></svg>;
}
function IconPinterest({ size = 16, className }: { size?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M12 0a12 12 0 0 0-4.37 23.17c-.1-.94-.2-2.4.04-3.44l1.4-5.95s-.36-.72-.36-1.78c0-1.67.97-2.92 2.17-2.92 1.02 0 1.52.77 1.52 1.69 0 1.03-.66 2.57-1 3.99-.28 1.2.6 2.17 1.78 2.17 2.14 0 3.78-2.26 3.78-5.52 0-2.89-2.08-4.91-5.04-4.91-3.44 0-5.45 2.58-5.45 5.24 0 1.04.4 2.15.9 2.75.1.12.11.22.08.34l-.34 1.36c-.05.22-.18.26-.4.16-1.5-.7-2.43-2.9-2.43-4.66 0-3.81 2.77-7.3 7.98-7.3 4.19 0 7.45 2.99 7.45 6.98 0 4.16-2.63 7.52-6.28 7.52-1.23 0-2.38-.64-2.77-1.39l-.75 2.88c-.27 1.05-1.01 2.36-1.5 3.16A12 12 0 1 0 12 0z" /></svg>;
}
function IconLinkedin({ size = 16, className }: { size?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect width="4" height="12" x="2" y="9" /><circle cx="4" cy="4" r="2" /></svg>;
}
function IconYoutube({ size = 16, className }: { size?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" /><path d="m10 15 5-3-5-3z" /></svg>;
}
function IconWhatsapp({ size = 16, className }: { size?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" /></svg>;
}
function IconSpotify({ size = 16, className }: { size?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" /></svg>;
}

export const ICONS: { name: string; icon: React.ElementType; category: string }[] = [
  // Produtos & Loja
  { name: "monitor", icon: Monitor, category: "Produtos" },
  { name: "package", icon: Package, category: "Produtos" },
  { name: "shopping-bag", icon: ShoppingBag, category: "Produtos" },
  { name: "gift", icon: Gift, category: "Produtos" },
  { name: "tag", icon: Tag, category: "Produtos" },
  { name: "box", icon: Box, category: "Produtos" },
  { name: "store", icon: Store, category: "Produtos" },
  { name: "credit-card", icon: CreditCard, category: "Produtos" },
  { name: "receipt", icon: Receipt, category: "Produtos" },
  { name: "truck", icon: Truck, category: "Produtos" },
  // Marca & Design
  { name: "star", icon: Star, category: "Marca" },
  { name: "heart", icon: Heart, category: "Marca" },
  { name: "sparkles", icon: Sparkles, category: "Marca" },
  { name: "crown", icon: Crown, category: "Marca" },
  { name: "award", icon: Award, category: "Marca" },
  { name: "trophy", icon: Trophy, category: "Marca" },
  { name: "flame", icon: Flame, category: "Marca" },
  { name: "zap", icon: Zap, category: "Marca" },
  { name: "palette", icon: Palette, category: "Marca" },
  { name: "brush", icon: Brush, category: "Marca" },
  // Mídia & Conteúdo
  { name: "image", icon: Image, category: "Mídia" },
  { name: "video", icon: Video, category: "Mídia" },
  { name: "camera", icon: Camera, category: "Mídia" },
  { name: "music", icon: Music, category: "Mídia" },
  { name: "file-text", icon: FileText, category: "Mídia" },
  { name: "folder", icon: Folder, category: "Mídia" },
  { name: "layers", icon: Layers, category: "Mídia" },
  { name: "printer", icon: Printer, category: "Mídia" },
  { name: "scissors", icon: Scissors, category: "Mídia" },
  { name: "eye", icon: Eye, category: "Mídia" },
  // Marketing & Redes
  { name: "megaphone", icon: Megaphone, category: "Marketing" },
  { name: "target", icon: Target, category: "Marketing" },
  { name: "trending-up", icon: TrendingUp, category: "Marketing" },
  { name: "bar-chart", icon: BarChart3, category: "Marketing" },
  { name: "pie-chart", icon: PieChart, category: "Marketing" },
  { name: "share", icon: Share2, category: "Marketing" },
  { name: "globe", icon: Globe, category: "Marketing" },
  { name: "mail", icon: Mail, category: "Marketing" },
  { name: "send", icon: Send, category: "Marketing" },
  { name: "flag", icon: Flag, category: "Marketing" },
  // Pessoas & Lugares
  { name: "users", icon: Users, category: "Geral" },
  { name: "user", icon: User, category: "Geral" },
  { name: "building", icon: Building2, category: "Geral" },
  { name: "map-pin", icon: MapPin, category: "Geral" },
  { name: "calendar", icon: Calendar, category: "Geral" },
  { name: "clock", icon: Clock, category: "Geral" },
  { name: "bell", icon: Bell, category: "Geral" },
  { name: "bookmark", icon: Bookmark, category: "Geral" },
  { name: "search", icon: Search, category: "Geral" },
  { name: "settings", icon: Settings, category: "Geral" },
  // Redes Sociais
  { name: "instagram", icon: IconInstagram, category: "Redes" },
  { name: "facebook", icon: IconFacebook, category: "Redes" },
  { name: "x-twitter", icon: IconX, category: "Redes" },
  { name: "linkedin", icon: IconLinkedin, category: "Redes" },
  { name: "youtube", icon: IconYoutube, category: "Redes" },
  { name: "tiktok", icon: IconTiktok, category: "Redes" },
  { name: "pinterest", icon: IconPinterest, category: "Redes" },
  { name: "whatsapp", icon: IconWhatsapp, category: "Redes" },
  { name: "spotify", icon: IconSpotify, category: "Redes" },
  // Essenza
  { name: "coffee", icon: Coffee, category: "Essenza" },
  { name: "wine", icon: Wine, category: "Essenza" },
  { name: "leaf", icon: Leaf, category: "Essenza" },
  { name: "flower", icon: Flower2, category: "Essenza" },
  { name: "sun", icon: Sun, category: "Essenza" },
  { name: "moon", icon: Moon, category: "Essenza" },
  { name: "lightbulb", icon: Lightbulb, category: "Essenza" },
  { name: "graduation", icon: GraduationCap, category: "Essenza" },
  { name: "book", icon: BookOpen, category: "Essenza" },
  { name: "puzzle", icon: Puzzle, category: "Essenza" },
  // Sistema
  { name: "layout-dashboard", icon: LayoutDashboard, category: "Sistema" },
  { name: "shopping-cart", icon: ShoppingCart, category: "Sistema" },
  { name: "shield-check", icon: ShieldCheck, category: "Sistema" },
  { name: "monitor-cog", icon: MonitorCog, category: "Sistema" },
  { name: "stamp", icon: Stamp, category: "Sistema" },
  { name: "wrench", icon: Wrench, category: "Sistema" },
  { name: "history", icon: History, category: "Sistema" },
];

// Lookup pra renderizar ícone por nome
export function getIconComponent(name: string): React.ElementType | null {
  return ICONS.find((i) => i.name === name)?.icon || null;
}

interface IconPickerProps {
  value: string;
  onChange: (name: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const categories = [...new Set(ICONS.map((i) => i.category))];

  const filtered = ICONS.filter((i) => {
    if (category && i.category !== category) return false;
    if (search && !i.name.includes(search.toLowerCase())) return false;
    return true;
  });

  const SelectedIcon = getIconComponent(value);

  return (
    <div className="flex flex-col gap-2">
      {/* Current selection */}
      {value && SelectedIcon && (
        <div className="flex items-center gap-2 rounded-lg bg-brand-olive-soft px-3 py-2">
          <SelectedIcon size={18} className="text-brand-olive" />
          <span className="text-sm font-medium text-brand-olive-dark">{value}</span>
          <button type="button" onClick={() => onChange("")} className="ml-auto text-ink-400 hover:text-ink-700"><X size={12} /></button>
        </div>
      )}

      {/* Search */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar ícone..."
        className="h-9 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10"
      />

      {/* Category tabs */}
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setCategory(null)}
          className={cn("rounded-md px-2 py-1 text-[10px] font-medium transition-colors", !category ? "bg-brand-olive text-white" : "bg-ink-50 text-ink-500 hover:bg-ink-100")}
        >
          Todos
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={cn("rounded-md px-2 py-1 text-[10px] font-medium transition-colors", category === cat ? "bg-brand-olive text-white" : "bg-ink-50 text-ink-500 hover:bg-ink-100")}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-8 gap-1 max-h-[200px] overflow-y-auto rounded-lg border border-ink-100 p-2">
        {filtered.map((item) => {
          const Icon = item.icon;
          const isSelected = value === item.name;
          return (
            <button
              key={item.name}
              type="button"
              onClick={() => onChange(item.name)}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                isSelected
                  ? "bg-brand-olive text-white"
                  : "text-ink-500 hover:bg-ink-50 hover:text-ink-700"
              )}
              title={item.name}
            >
              <Icon size={16} />
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="col-span-8 text-center text-xs text-ink-400 py-4">Nenhum ícone encontrado</p>
        )}
      </div>
    </div>
  );
}
