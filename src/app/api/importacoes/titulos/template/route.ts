export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { buildWorkbook, xlsxResponse } from "@/lib/exports/excel";

const HEADER = [
  "empresa_cnpj_ou_nome",
  "sacado",
  "numero_doc",
  "data_emissao",
  "data_vencimento",
  "valor",
  "status",
  "data_pagamento",
];

const EXAMPLES = [
  ["Distribuidora Makários", "Supermercado Família Ltda",  "NF-1001", "01/04/2025", "01/05/2025",  1500.00, "aberto", ""],
  ["Distribuidora Makários", "Restaurante Bom Sabor ME",   "NF-1002", "05/04/2025", "05/06/2025",   890.50, "aberto", ""],
  ["Serviços Makários",      "Academia Força e Saúde",     "RC-055",  "10/03/2025", "10/04/2025",  2300.00, "pago",   "08/04/2025"],
  ["Distribuidora Makários", "Padaria Trigo de Ouro",      "NF-1003", "15/02/2025", "15/03/2025",   430.75, "vencido",""],
];

const INSTRUCTIONS = [
  ["INSTRUÇÕES DE PREENCHIMENTO"],
  [""],
  ["Campo",                "Obrigatório?", "Observação"],
  ["empresa_cnpj_ou_nome", "Sim",  "CNPJ formatado (00.000.000/0001-00) ou nome exato da empresa cadastrada"],
  ["sacado",               "Sim",  "Nome do devedor / cliente"],
  ["numero_doc",           "Não",  "Número do documento, nota ou fatura"],
  ["data_emissao",         "Sim",  "Formato: DD/MM/AAAA"],
  ["data_vencimento",      "Sim",  "Formato: DD/MM/AAAA"],
  ["valor",                "Sim",  "Valor em R$ (use ponto como separador decimal, ex: 1500.00)"],
  ["status",               "Não",  "aberto | pago | vencido | cancelado  (padrão: aberto)"],
  ["data_pagamento",       "Não",  "Obrigatório apenas quando status = pago. Formato: DD/MM/AAAA"],
  [""],
  ["DICAS"],
  ["• Salve o arquivo no formato .xlsx ou .csv antes de enviar"],
  ["• Não altere os nomes das colunas"],
  ["• Datas devem estar no formato DD/MM/AAAA"],
  ["• Valores decimais usam ponto (.) não vírgula (,)"],
  ["• Títulos com status 'pago' devem ter data_pagamento preenchida"],
];

export async function GET() {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const buf = buildWorkbook([
    { name: "Dados",        aoa: [HEADER, ...EXAMPLES] },
    { name: "Instruções",   aoa: INSTRUCTIONS },
  ]);

  return xlsxResponse(buf, "makarios-modelo-importacao-titulos.xlsx");
}
