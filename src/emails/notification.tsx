import {
  Html, Head, Body, Container, Section, Text, Button, Hr, Tailwind, Img, Row, Column,
} from "@react-email/components";

interface NotificationEmailProps {
  title: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footnote?: string;
}

NotificationEmail.PreviewProps = {
  title: "Novo conteúdo disponível",
  body: "Um novo material foi publicado em Fotos.\nAcesse o Hub para conferir.",
  ctaLabel: "Ver conteúdo",
  ctaUrl: "https://intranet.emporioessenza.com.br/pagina/biblioteca",
} satisfies NotificationEmailProps;

const LOGO_URL = "https://intranet-essenza.vercel.app/_next/static/media/logo.0-7z6gznwvp2a.svg";

export function NotificationEmail({ title, body, ctaLabel, ctaUrl, footnote }: NotificationEmailProps) {
  return (
    <Html>
      <Head />
      <Tailwind>
        <Body className="bg-[#f5f4f0] font-sans" style={{ margin: 0, padding: 0 }}>
          <Container className="mx-auto max-w-[520px] py-10 px-4">
            {/* Logo header */}
            <Section className="text-center mb-6">
              <Img
                src={LOGO_URL}
                width="100"
                height="100"
                alt="Empório Essenza"
                className="mx-auto"
              />
            </Section>

            {/* Card principal */}
            <Section
              className="bg-white rounded-2xl px-10 py-8"
              style={{ border: "1px solid #e8e5df" }}
            >
              <Text
                className="text-[22px] font-bold leading-tight mb-1"
                style={{ color: "#18160f" }}
              >
                {title}
              </Text>

              <Hr className="my-5" style={{ borderColor: "#e8e5df" }} />

              {body.split("\n").map((line, i) => (
                <Text
                  key={i}
                  className="text-[15px] leading-7 m-0"
                  style={{ color: "#4a4a42", marginBottom: line === "" ? "12px" : "4px" }}
                >
                  {line || "\u00A0"}
                </Text>
              ))}

              {ctaLabel && ctaUrl && (
                <Section className="text-center mt-8 mb-4">
                  <Button
                    href={ctaUrl}
                    className="rounded-xl px-10 py-4 text-[14px] font-semibold text-white"
                    style={{ backgroundColor: "#878a62" }}
                  >
                    {ctaLabel}
                  </Button>
                </Section>
              )}
            </Section>

            {/* Footer */}
            <Section className="mt-6 text-center">
              {footnote && (
                <Text className="text-[11px] mb-2" style={{ color: "#9b9b8e" }}>
                  {footnote}
                </Text>
              )}
              <Text className="text-[11px] m-0" style={{ color: "#b5b5a8" }}>
                Emporio Essenza Serra Gaucha
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export default NotificationEmail;
