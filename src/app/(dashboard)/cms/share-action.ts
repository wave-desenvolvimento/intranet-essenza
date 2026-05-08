"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

function generateCode(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(36).padStart(2, "0")).join("").slice(0, 12);
}

export async function createShareLink(
  publicUrl: string,
  expiresInSeconds: number = 86400
): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Extract bucket and path from public URL
  const match = publicUrl.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (!match) return { error: "URL inválida" };

  const [, bucket, path] = match;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) return { error: "Erro ao gerar link" };

  // Save short link
  const code = generateCode();
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

  await supabase.from("share_links").insert({
    code,
    signed_url: data.signedUrl,
    expires_at: expiresAt,
    created_by: user?.id || null,
  });

  // Return friendly URL
  const h = await headers();
  const host = h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || "http";
  const origin = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;

  return { url: `${origin}/s/${code}` };
}
