import * as XLSX from "xlsx";

export async function GET() {
  const wb = XLSX.utils.book_new();

  // --- Aba 1: Franquias ---
  const franchiseHeaders = [
    "nome *", "segmento *", "cnpj", "responsavel", "cidade", "estado",
    "endereco", "bairro", "cep", "telefone", "whatsapp", "email",
    "instagram", "facebook", "tiktok", "website", "horario_funcionamento",
  ];
  const franchiseExample = [
    "Essenza Gramado", "franquia", "12.345.678/0001-90", "Maria Silva",
    "Gramado", "RS", "Rua Coberta, 100", "Centro", "95670-000",
    "(54) 3286-1234", "5554999001122", "gramado@essenza.com.br",
    "@essenza.gramado", "/essenzagramado", "@essenza.gramado",
    "essenzagramado.com.br", "Seg-Sáb 9h-19h",
  ];
  const franchiseNotes = [
    "Obrigatório", "franquia ou multimarca_pdv", "", "",
    "", "Sigla UF (2 letras)", "", "", "", "", "Número com DDI (ex: 5554...)",
    "", "Com @", "", "Com @", "", "",
  ];
  const franchiseData = [franchiseHeaders, franchiseNotes, franchiseExample];
  const wsFranchises = XLSX.utils.aoa_to_sheet(franchiseData);

  // Column widths
  wsFranchises["!cols"] = franchiseHeaders.map((h) => ({ wch: Math.max(h.length + 2, 18) }));

  XLSX.utils.book_append_sheet(wb, wsFranchises, "Franquias");

  // --- Aba 2: Usuários ---
  const userHeaders = [
    "nome_completo *", "email *", "franquia *", "role",
    "admin_franquia",
  ];
  const userExample = [
    "Maria Silva", "maria@essenza.com.br", "Essenza Gramado",
    "Admin Franquia", "sim",
  ];
  const userNotes = [
    "Obrigatório", "Obrigatório (receberá convite)", "Nome exato da franquia (deve existir na aba Franquias ou já cadastrada)",
    "Nome do role (ex: Owner, Admin Franquia, Usuário Franquia)", "sim ou não",
  ];
  const userData = [userHeaders, userNotes, userExample];
  const wsUsers = XLSX.utils.aoa_to_sheet(userData);
  wsUsers["!cols"] = userHeaders.map((h) => ({ wch: Math.max(h.length + 2, 25) }));

  XLSX.utils.book_append_sheet(wb, wsUsers, "Usuários");

  // --- Aba 3: Instruções ---
  const instructions = [
    ["Instruções de Preenchimento"],
    [""],
    ["1. Preencha a aba 'Franquias' com os dados de cada franquia."],
    ["2. Preencha a aba 'Usuários' com os usuários de cada franquia."],
    ["3. A coluna 'franquia' na aba de usuários deve conter o nome exato da franquia."],
    ["4. Campos marcados com * são obrigatórios."],
    ["5. A linha 2 (cinza) contém explicações — remova-a antes de importar."],
    ["6. A linha 3 é um exemplo — remova-a também."],
    ["7. Segmentos válidos: franquia, multimarca_pdv"],
    ["8. Roles disponíveis: Owner, Operacional Matriz, Comercial Matriz, Admin Franquia, Usuário Franquia, Visualizador"],
    ["9. admin_franquia: 'sim' permite o usuário gerenciar outros da mesma franquia."],
    [""],
    ["Ao fazer upload, o sistema criará as franquias e enviará convites por email para cada usuário."],
  ];
  const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
  wsInstructions["!cols"] = [{ wch: 90 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, "Instruções");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo-franquias-usuarios.xlsx"',
    },
  });
}
