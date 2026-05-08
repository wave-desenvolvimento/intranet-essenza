import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/inicio";

  // Validate redirect — must be relative path, no protocol-relative
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/inicio";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Invited users (no password set) must define their password first
      const isInvite = data.user?.app_metadata?.providers?.length === 1
        && !data.user?.user_metadata?.password_set;
      const createdAt = new Date(data.user?.created_at ?? 0);
      const confirmedAt = new Date(data.user?.confirmed_at ?? 0);
      const isFirstLogin = Math.abs(confirmedAt.getTime() - createdAt.getTime()) < 60_000
        || !data.user?.last_sign_in_at
        || data.user.last_sign_in_at === data.user.confirmed_at;

      if (isInvite && isFirstLogin) {
        return NextResponse.redirect(`${origin}/reset-password`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
