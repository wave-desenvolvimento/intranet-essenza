import {
  Html, Head, Body, Container, Section, Text, Hr, Tailwind, Img,
} from "@react-email/components";

interface OrderItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface OrderEmailProps {
  franchiseName: string;
  orderId: string;
  items: OrderItem[];
  total: number;
  notes?: string;
  createdAt: string;
  createdBy: string;
}

OrderNotificationEmail.PreviewProps = {
  franchiseName: "Essenza Canela",
  orderId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  items: [
    { productName: "Difusor Bamboo 250ml", quantity: 12, unitPrice: 45.90, subtotal: 550.80 },
    { productName: "Vela Aromática Vanilla", quantity: 6, unitPrice: 38.50, subtotal: 231.00 },
    { productName: "Sachê Lavanda", quantity: 24, unitPrice: 12.90, subtotal: 309.60 },
  ],
  total: 1091.40,
  notes: "Entregar até sexta-feira. Preferência por envio via transportadora.",
  createdAt: new Date().toISOString(),
  createdBy: "Ana Paula Favero",
} satisfies OrderEmailProps;

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "/static";

export function OrderNotificationEmail({ franchiseName, orderId, items, total, notes, createdAt, createdBy }: OrderEmailProps) {
  return (
    <Html>
      <Head />
      <Tailwind>
        <Body className="bg-[#faf9f7] font-sans">
          <Container className="mx-auto max-w-[520px] px-4 py-8">
            <Section className="rounded-xl bg-white p-8 shadow-sm">
              <Img
                src={`${baseUrl}/logo.svg`}
                width="80"
                height="80"
                alt="Essenza"
                className="mx-auto mb-2"
              />
              <Text className="text-sm text-[#6b6b5e] text-center mb-4">
                Novo pedido recebido
              </Text>

              <Hr className="border-[#e8e5df] my-4" />

              <Text className="text-sm text-[#6b6b5e] mb-1">
                <strong className="text-[#18160f]">Franquia:</strong> {franchiseName}
              </Text>
              <Text className="text-sm text-[#6b6b5e] mb-1">
                <strong className="text-[#18160f]">Pedido:</strong> #{orderId.slice(0, 8)}
              </Text>
              <Text className="text-sm text-[#6b6b5e] mb-1">
                <strong className="text-[#18160f]">Solicitado por:</strong> {createdBy}
              </Text>
              <Text className="text-sm text-[#6b6b5e] mb-4">
                <strong className="text-[#18160f]">Data:</strong> {new Date(createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </Text>

              <Hr className="border-[#e8e5df] my-4" />

              {/* Items table */}
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "6px 0", fontSize: 11, color: "#9b9b8e", borderBottom: "1px solid #e8e5df" }}>Produto</th>
                    <th style={{ textAlign: "right", padding: "6px 0", fontSize: 11, color: "#9b9b8e", borderBottom: "1px solid #e8e5df" }}>Qtd</th>
                    <th style={{ textAlign: "right", padding: "6px 0", fontSize: 11, color: "#9b9b8e", borderBottom: "1px solid #e8e5df" }}>Unit.</th>
                    <th style={{ textAlign: "right", padding: "6px 0", fontSize: 11, color: "#9b9b8e", borderBottom: "1px solid #e8e5df" }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i}>
                      <td style={{ padding: "8px 0", fontSize: 13, color: "#18160f", borderBottom: "1px solid #f0ede8" }}>{item.productName}</td>
                      <td style={{ padding: "8px 0", fontSize: 13, color: "#6b6b5e", textAlign: "right", borderBottom: "1px solid #f0ede8" }}>{item.quantity}</td>
                      <td style={{ padding: "8px 0", fontSize: 13, color: "#6b6b5e", textAlign: "right", borderBottom: "1px solid #f0ede8" }}>R$ {item.unitPrice.toFixed(2)}</td>
                      <td style={{ padding: "8px 0", fontSize: 13, color: "#18160f", fontWeight: 600, textAlign: "right", borderBottom: "1px solid #f0ede8" }}>R$ {item.subtotal.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <Text className="text-right text-lg font-bold text-[#18160f] mt-4">
                Total: R$ {total.toFixed(2)}
              </Text>

              {notes && (
                <>
                  <Hr className="border-[#e8e5df] my-4" />
                  <Text className="text-sm text-[#6b6b5e]">
                    <strong className="text-[#18160f]">Observações:</strong> {notes}
                  </Text>
                </>
              )}

              <Hr className="border-[#e8e5df] my-4" />
              <Text className="text-[10px] text-[#9b9b8e] text-center">
                Enviado automaticamente pelo Hub Essenza
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export default OrderNotificationEmail;
