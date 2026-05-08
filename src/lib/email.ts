import { Resend } from "resend";

let _resend: Resend | null = null;

export function getResend() {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) return null;
    _resend = new Resend(key);
  }
  return _resend;
}

export const FROM_EMAIL = process.env.EMAIL_FROM || "Essenza Hub <noreply@emporioessenza.com.br>";
