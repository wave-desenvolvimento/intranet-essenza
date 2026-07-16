import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isAssetVisible(a: { published_at?: string | null; expires_at?: string | null }): boolean {
  const now = new Date();
  if (a.published_at && new Date(a.published_at) > now) return false;
  if (a.expires_at && new Date(a.expires_at) <= now) return false;
  return true;
}

export function getAssetScheduleStatus(a: { published_at?: string | null; expires_at?: string | null }): "visible" | "scheduled" | "expired" {
  const now = new Date();
  if (a.published_at && new Date(a.published_at) > now) return "scheduled";
  if (a.expires_at && new Date(a.expires_at) <= now) return "expired";
  return "visible";
}
