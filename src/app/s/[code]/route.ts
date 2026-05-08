import { createClient } from "@supabase/supabase-js";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data } = await supabase
    .from("share_links")
    .select("signed_url, expires_at")
    .eq("code", code)
    .single();

  if (!data) {
    return new Response("Link não encontrado", { status: 404 });
  }

  if (new Date(data.expires_at) < new Date()) {
    return new Response("Link expirado", { status: 410 });
  }

  // Validate signed URL origin to prevent SSRF
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl && !data.signed_url.startsWith(supabaseUrl)) {
    return new Response("URL inválida", { status: 400 });
  }

  // Fetch the image from signed URL and serve it directly
  const res = await fetch(data.signed_url);
  if (!res.ok) {
    return new Response("Erro ao carregar imagem", { status: 502 });
  }

  const contentType = res.headers.get("content-type") || "image/webp";

  return new Response(res.body, {
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=3600",
    },
  });
}
