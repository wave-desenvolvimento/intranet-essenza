import { notFound } from "next/navigation";
import { z } from "zod";
import { BrandLogo } from "@/components/layout/brand-logo";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "./print-button";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" });

export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.guid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: certificate } = await supabase
    .from("course_certificates")
    .select("id, user_name, training_title, issued_at")
    .eq("id", id)
    .maybeSingle();
  if (!certificate) notFound();

  return (
    <main className="certificate-page flex min-h-dvh flex-col items-center justify-center gap-6 bg-brand-cream p-6 font-sans print:bg-white print:p-0">
      <article className="flex aspect-[297/210] w-full max-w-5xl flex-col items-center justify-center gap-6 border-8 border-double border-brand-olive bg-white p-8 text-center md:p-16">
        <BrandLogo width={160} height={75} />
        <h1 className="text-2xl font-semibold tracking-wide text-brand-olive md:text-4xl">Certificado de conclusão</h1>
        <p className="text-sm text-ink-500 md:text-base">Certificamos que</p>
        <p className="text-xl font-semibold text-ink-900 md:text-3xl">{certificate.user_name}</p>
        <p className="text-sm text-ink-500 md:text-base">
          concluiu o treinamento <strong className="text-ink-900">{certificate.training_title}</strong>
          <br />
          em {dateFormat.format(new Date(certificate.issued_at))}.
        </p>
        <p className="text-[10px] text-ink-400">Código {certificate.id}</p>
      </article>
      <PrintButton />
    </main>
  );
}
