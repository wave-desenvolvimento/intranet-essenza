import {
  Html, Head, Body, Container, Section, Text, Button, Hr, Tailwind, Img,
} from "@react-email/components";

interface NewCampaignEmailProps {
  campaignTitle: string;
  campaignDescription?: string;
  pageSlug: string;
  materialsCount: number;
}

NewCampaignEmail.PreviewProps = {
  campaignTitle: "Dia das Mães 2026",
  campaignDescription: "Materiais exclusivos para a campanha de Dia das Mães. Inclui posts para redes sociais, banners para loja e vídeo institucional.",
  pageSlug: "dia-das-maes-2026",
  materialsCount: 12,
} satisfies NewCampaignEmailProps;

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "/static";

export function NewCampaignEmail({ campaignTitle, campaignDescription, pageSlug, materialsCount }: NewCampaignEmailProps) {
  const campaignUrl = `${baseUrl}/pagina/${pageSlug}`;

  return (
    <Html>
      <Head />
      <Tailwind>
        <Body className="bg-[#faf9f7] font-sans">
          <Container className="mx-auto max-w-[480px] px-4 py-8">
            <Section className="rounded-xl bg-white p-8 shadow-sm">
              <Img
                src={`${baseUrl}/logo.svg`}
                width="80"
                height="80"
                alt="Essenza"
                className="mx-auto mb-4"
              />

              <Hr className="border-[#e8e5df] my-4" />

              <Text className="text-lg font-bold text-[#18160f] mb-1">
                Nova campanha disponível
              </Text>

              <Text className="text-base text-[#878a62] font-semibold mb-2">
                {campaignTitle}
              </Text>

              {campaignDescription && (
                <Text className="text-sm text-[#6b6b5e] leading-6 mb-2">
                  {campaignDescription}
                </Text>
              )}

              <Text className="text-sm text-[#6b6b5e] mb-4">
                <strong className="text-[#18160f]">{materialsCount}</strong>{" "}
                {materialsCount === 1 ? "material disponível" : "materiais disponíveis"} para download.
              </Text>

              <Section className="text-center my-6">
                <Button
                  href={campaignUrl}
                  className="rounded-lg bg-[#878a62] px-8 py-3 text-sm font-medium text-white"
                >
                  Ver campanha
                </Button>
              </Section>

              <Text className="text-xs text-[#9b9b8e] leading-5">
                Se o botão não funcionar, copie e cole o link abaixo no seu navegador:
              </Text>
              <Text className="text-xs text-[#878a62] break-all">
                {campaignUrl}
              </Text>

              <Hr className="border-[#e8e5df] my-4" />

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

export default NewCampaignEmail;
