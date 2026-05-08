import {
  Html, Head, Body, Container, Section, Text, Button, Hr, Tailwind, Img,
} from "@react-email/components";

interface InviteUserEmailProps {
  userName: string;
  franchiseName: string;
  inviteUrl: string;
}

InviteUserEmail.PreviewProps = {
  userName: "Maria Silva",
  franchiseName: "Essenza Gramado",
  inviteUrl: "https://intranet.emporioessenza.com.br/auth/callback?next=/inicio",
} satisfies InviteUserEmailProps;

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "/static";

export function InviteUserEmail({ userName, franchiseName, inviteUrl }: InviteUserEmailProps) {
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

              <Text className="text-base text-[#18160f] mb-2">
                Olá{userName ? `, ${userName}` : ""}!
              </Text>

              <Text className="text-sm text-[#6b6b5e] leading-6">
                Você foi convidado para acessar o Hub de Marca da{" "}
                <strong className="text-[#18160f]">{franchiseName}</strong>.
                Neste hub você encontrará materiais de campanha, identidade visual,
                treinamentos e tudo que precisa para sua loja.
              </Text>

              <Section className="text-center my-6">
                <Button
                  href={inviteUrl}
                  className="rounded-lg bg-[#878a62] px-8 py-3 text-sm font-medium text-white"
                >
                  Acessar o Hub
                </Button>
              </Section>

              <Text className="text-xs text-[#9b9b8e] leading-5">
                Se o botão não funcionar, copie e cole o link abaixo no seu navegador:
              </Text>
              <Text className="text-xs text-[#878a62] break-all">
                {inviteUrl}
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

export default InviteUserEmail;
