import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  const allowed = [process.env.CRON_SECRET, process.env.SUPABASE_SERVICE_ROLE_KEY].filter(Boolean);
  if (!token || !allowed.includes(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: published } = await supabase
    .from("cms_items")
    .update({ status: "published" })
    .eq("status", "draft")
    .not("published_at", "is", null)
    .lte("published_at", new Date().toISOString())
    .select("id");

  const { data: expired } = await supabase
    .from("cms_items")
    .update({ status: "archived" })
    .eq("status", "published")
    .not("expires_at", "is", null)
    .lte("expires_at", new Date().toISOString())
    .select("id");

  return NextResponse.json({
    published: published?.length || 0,
    expired: expired?.length || 0,
    ranAt: new Date().toISOString(),
  });
}
