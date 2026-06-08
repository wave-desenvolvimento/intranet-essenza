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

  // Check if it's a bulk share (JSON array)
  if (data.signed_url.startsWith("[")) {
    try {
      const items = JSON.parse(data.signed_url) as { signedUrl: string; label: string; type: "image" | "file" }[];
      return new Response(renderGalleryPage(items), {
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" },
      });
    } catch {
      return new Response("Erro ao processar link", { status: 500 });
    }
  }

  // Single file — validate and proxy
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl && !data.signed_url.startsWith(supabaseUrl)) {
    return new Response("URL inválida", { status: 400 });
  }

  const res = await fetch(data.signed_url);
  if (!res.ok) {
    return new Response("Erro ao carregar arquivo", { status: 502 });
  }

  const contentType = res.headers.get("content-type") || "application/octet-stream";

  return new Response(res.body, {
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=3600",
    },
  });
}

function renderGalleryPage(items: { signedUrl: string; label: string; type: "image" | "file" }[]) {
  const images = items.filter((i) => i.type === "image");
  const files = items.filter((i) => i.type === "file");

  function fileIcon(url: string) {
    const ext = url.match(/\.(\w{2,5})(?:\?|$)/)?.[1]?.toUpperCase() || "FILE";
    return ext;
  }

  const imageCards = images.map((img) => `
    <a href="${img.signedUrl}" target="_blank" class="img-card">
      <img src="${img.signedUrl}" alt="${img.label}" loading="lazy" />
      <div class="img-overlay">
        <span class="img-label">${img.label}</span>
        <a href="${img.signedUrl}" download class="dl-btn" title="Baixar">&#8595;</a>
      </div>
    </a>
  `).join("");

  const fileCards = files.map((f) => `
    <div class="file-card">
      <div class="file-ext">${fileIcon(f.signedUrl)}</div>
      <div class="file-info">
        <p class="file-name">${f.label}</p>
        <p class="file-type">${fileIcon(f.signedUrl)}</p>
      </div>
      <div class="file-actions">
        <a href="${f.signedUrl}" target="_blank" class="action-btn" title="Abrir">&#x2197;</a>
        <a href="${f.signedUrl}" download class="action-btn" title="Baixar">&#8595;</a>
      </div>
    </div>
  `).join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Essenza — Arquivos compartilhados</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f0; color: #1a1a1a; min-height: 100vh; }
    .container { max-width: 720px; margin: 0 auto; padding: 32px 16px; }
    .header { text-align: center; margin-bottom: 32px; }
    .header h1 { font-size: 18px; font-weight: 600; color: #3d3d2e; }
    .header p { font-size: 12px; color: #999; margin-top: 4px; }
    .section-title { font-size: 11px; font-weight: 600; color: #999; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }
    .section { margin-bottom: 28px; }

    .img-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
    .img-card { position: relative; border-radius: 12px; overflow: hidden; background: #1a1a1a; aspect-ratio: 1; display: block; text-decoration: none; }
    .img-card img { width: 100%; height: 100%; object-fit: cover; transition: opacity 0.2s; }
    .img-card:hover img { opacity: 0.85; }
    .img-overlay { position: absolute; bottom: 0; left: 0; right: 0; padding: 8px 10px; background: linear-gradient(transparent, rgba(0,0,0,.6)); display: flex; align-items: flex-end; justify-content: space-between; }
    .img-label { font-size: 11px; color: #fff; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .dl-btn { color: rgba(255,255,255,.7); font-size: 16px; text-decoration: none; padding: 4px; border-radius: 4px; }
    .dl-btn:hover { color: #fff; background: rgba(255,255,255,.15); }

    .file-card { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: #fff; border: 1px solid #e5e5e0; border-radius: 10px; margin-bottom: 8px; }
    .file-ext { width: 40px; height: 40px; border-radius: 8px; background: #fee; color: #c33; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .file-info { flex: 1; min-width: 0; }
    .file-name { font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .file-type { font-size: 10px; color: #999; }
    .file-actions { display: flex; gap: 4px; flex-shrink: 0; }
    .action-btn { width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #999; text-decoration: none; font-size: 14px; }
    .action-btn:hover { background: #f0f0eb; color: #3d3d2e; }

    .lightbox { display: none; position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,.85); align-items: center; justify-content: center; padding: 24px; }
    .lightbox.active { display: flex; }
    .lightbox img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px; }
    .lightbox-close { position: absolute; top: 16px; right: 16px; width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,.1); color: #fff; border: none; font-size: 18px; cursor: pointer; }
    .lightbox-close:hover { background: rgba(255,255,255,.2); }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Essenza</h1>
      <p>Conteúdo compartilhado &middot; ${items.length} ${items.length === 1 ? "item" : "itens"}</p>
    </div>

    ${images.length > 0 ? `
    <div class="section">
      <p class="section-title">Imagens (${images.length})</p>
      <div class="img-grid">${imageCards}</div>
    </div>
    ` : ""}

    ${files.length > 0 ? `
    <div class="section">
      <p class="section-title">Arquivos (${files.length})</p>
      ${fileCards}
    </div>
    ` : ""}
  </div>

  <div class="lightbox" id="lb" onclick="this.classList.remove('active')">
    <button class="lightbox-close" onclick="event.stopPropagation();document.getElementById('lb').classList.remove('active')">&times;</button>
    <img id="lb-img" src="" alt="" onclick="event.stopPropagation()" />
  </div>

  <script>
    document.querySelectorAll('.img-card').forEach(card => {
      card.addEventListener('click', e => {
        e.preventDefault();
        document.getElementById('lb-img').src = card.querySelector('img').src;
        document.getElementById('lb').classList.add('active');
      });
    });
  </script>
</body>
</html>`;
}
