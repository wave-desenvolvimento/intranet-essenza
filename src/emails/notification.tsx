import {
  Html, Head, Body, Container, Section, Text, Button, Hr, Tailwind, Img,
} from "@react-email/components";

interface NotificationEmailProps {
  title: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footnote?: string;
}

NotificationEmail.PreviewProps = {
  title: "Nova pesquisa disponível",
  body: "A pesquisa \"Satisfação Q3 2026\" está aguardando sua resposta. Sua opinião é muito importante para a melhoria contínua da rede.",
  ctaLabel: "Responder pesquisa",
  ctaUrl: "https://intranet.emporioessenza.com.br/inicio",
  footnote: "Você recebeu este e-mail porque faz parte da rede Empório Essenza.",
} satisfies NotificationEmailProps;

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "/static";

export function NotificationEmail({ title, body, ctaLabel, ctaUrl, footnote }: NotificationEmailProps) {
  return (
    <Html>
      <Head />
      <Tailwind>
        <Body className="bg-[#faf9f7] font-sans">
          <Container className="mx-auto max-w-[480px] px-4 py-8">
            <Section className="rounded-xl bg-white p-8 shadow-sm">
              <Img
                src="https://intranet-essenza.vercel.app/_next/static/media/logo.0-7z6gznwvp2a.svg"
                width="80"
                height="80"
                alt="Empório Essenza"
                className="mx-auto mb-4"
              />

              <Hr className="border-[#e8e5df] my-4" />

              <Text className="text-lg font-bold text-[#18160f] mb-2">
                {title}
              </Text>

              <Text className="text-sm text-[#6b6b5e] leading-6 mb-4 whitespace-pre-line">
                {body}
              </Text>

              {ctaLabel && ctaUrl && (
                <Section className="text-center my-6">
                  <Button
                    href={ctaUrl}
                    className="rounded-lg bg-[#878a62] px-8 py-3 text-sm font-medium text-white"
                  >
                    {ctaLabel}
                  </Button>
                </Section>
              )}

              {ctaUrl && (
                <>
                  <Text className="text-xs text-[#9b9b8e] leading-5">
                    Se o botão não funcionar, copie e cole o link abaixo:
                  </Text>
                  <Text className="text-xs text-[#878a62] break-all">
                    {ctaUrl}
                  </Text>
                </>
              )}

              <Hr className="border-[#e8e5df] my-4" />

              {footnote && (
                <Text className="text-[10px] text-[#9b9b8e] text-center mb-1">
                  {footnote}
                </Text>
              )}
              <Text className="text-[10px] text-[#9b9b8e] text-center">
                © {new Date().getFullYear()} Empório Essenza Serra Gaúcha
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export default NotificationEmail;
