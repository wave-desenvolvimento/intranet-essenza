import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const nextParam = searchParams.get("next") ?? "/inicio";

  // Validate redirect — must be relative path, no protocol-relative
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/inicio";

  const supabase = await createClient();

  // Handle PKCE flow (code exchange)
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (shouldSetPassword(data.user, type)) {
        return NextResponse.redirect(`${origin}/reset-password`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Handle implicit flow (token_hash — used by invite, recovery, magic link)
  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as "invite" | "recovery" | "magiclink" | "signup" | "email_change" });
    if (!error) {
      if (shouldSetPassword(data.user, type)) {
        return NextResponse.redirect(`${origin}/reset-password`);
      }
      if (type === "recovery") {
        return NextResponse.redirect(`${origin}/reset-password`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}

function shouldSetPassword(user: { user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> } | null, type: string | null): boolean {
  if (!user) return false;
  if (type === "invite") return true;
  const providers = user.app_metadata?.providers;
  if (!user.user_metadata?.password_set && Array.isArray(providers) && providers.length === 1) return true;
  return false;
}
