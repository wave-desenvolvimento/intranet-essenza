"use server";

import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/permissions";

interface ImportResult {
  franchisesCreated: number;
  usersInvited: number;
  errors: string[];
}

export async function importFranchisesFromXlsx(formData: FormData): Promise<ImportResult | { error: string }> {
  const p = await requirePermission("franquias", "create");
  if (p.error) return p;

  const file = formData.get("file") as File;
  if (!file) return { error: "Nenhum arquivo enviado." };

  const buffer = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buffer, { type: "buffer" });

  const result: ImportResult = { franchisesCreated: 0, usersInvited: 0, errors: [] };
  const supabase = await createClient();
  const admin = createAdminClient();

  // --- Parse Franquias ---
  const franchiseSheet = wb.Sheets["Franquias"];
  const franchiseRows: Record<string, string>[] = franchiseSheet
    ? XLSX.utils.sheet_to_json(franchiseSheet, { defval: "" })
    : [];

  // Map franchise name → id for user linking
  const franchiseMap = new Map<string, string>();

  // Load existing franchises
  const { data: existing } = await supabase.from("franchises").select("id, name");
  for (const f of existing || []) {
    franchiseMap.set(f.name.toLowerCase().trim(), f.id);
  }

  for (let i = 0; i < franchiseRows.length; i++) {
    const row = franchiseRows[i];
    const name = (row["nome *"] || "").trim();
    if (!name) continue;

    // Skip if already exists
    if (franchiseMap.has(name.toLowerCase())) continue;

    const segment = (row["segmento *"] || "franquia").trim();
    if (!["franquia", "multimarca_pdv"].includes(segment)) {
      result.errors.push(`Linha ${i + 2} (Franquias): segmento inválido "${segment}"`);
      continue;
    }

    const { data: created, error } = await supabase.from("franchises").insert({
      name,
      segment,
      cnpj: row["cnpj"] || null,
      manager_name: row["responsavel"] || null,
      city: row["cidade"] || null,
      state: row["estado"] || null,
      address: row["endereco"] || null,
      neighborhood: row["bairro"] || null,
      cep: row["cep"] || null,
      phone: row["telefone"] || null,
      whatsapp: row["whatsapp"] || null,
      email: row["email"] || null,
      instagram: row["instagram"] || null,
      facebook: row["facebook"] || null,
      tiktok: row["tiktok"] || null,
      website: row["website"] || null,
      opening_hours: row["horario_funcionamento"] || null,
    }).select("id").single();

    if (error) {
      result.errors.push(`Linha ${i + 2} (Franquias): ${error.message}`);
    } else if (created) {
      franchiseMap.set(name.toLowerCase(), created.id);
      result.franchisesCreated++;
    }
  }

  // --- Parse Usuários ---
  const userSheet = wb.Sheets["Usuários"];
  const userRows: Record<string, string>[] = userSheet
    ? XLSX.utils.sheet_to_json(userSheet, { defval: "" })
    : [];

  // Load roles
  const { data: roles } = await supabase.from("roles").select("id, name");
  const roleMap = new Map<string, string>();
  for (const r of roles || []) {
    roleMap.set(r.name.toLowerCase().trim(), r.id);
  }

  for (let i = 0; i < userRows.length; i++) {
    const row = userRows[i];
    const fullName = (row["nome_completo *"] || "").trim();
    const email = (row["email *"] || "").trim();
    const franchiseName = (row["franquia *"] || "").trim();
    const roleName = (row["role"] || "").trim();
    const isAdmin = (row["admin_franquia"] || "").toLowerCase().trim() === "sim";

    if (!fullName || !email) continue;

    const franchiseId = franchiseMap.get(franchiseName.toLowerCase());
    if (!franchiseId) {
      result.errors.push(`Linha ${i + 2} (Usuários): franquia "${franchiseName}" não encontrada`);
      continue;
    }

    // Invite user
    const { data: userData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback?next=/inicio`,
    });

    if (inviteError) {
      if (inviteError.message.includes("already")) {
        result.errors.push(`Linha ${i + 2} (Usuários): ${email} já cadastrado`);
      } else {
        result.errors.push(`Linha ${i + 2} (Usuários): ${inviteError.message}`);
      }
      continue;
    }

    const userId = userData.user.id;

    // Update profile
    await supabase.from("profiles").update({
      full_name: fullName,
      franchise_id: franchiseId,
      is_franchise_admin: isAdmin,
    }).eq("id", userId);

    // Assign role
    if (roleName) {
      const roleId = roleMap.get(roleName.toLowerCase());
      if (roleId) {
        await supabase.from("user_roles").insert({ user_id: userId, role_id: roleId });
      } else {
        result.errors.push(`Linha ${i + 2} (Usuários): role "${roleName}" não encontrado`);
      }
    }

    result.usersInvited++;
  }

  revalidatePath("/franquias");
  revalidatePath("/usuarios");
  return result;
}
