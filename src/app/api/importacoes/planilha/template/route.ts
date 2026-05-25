import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { buildWorkbook, xlsxResponse } from "@/lib/exports/excel";

const HEADER = [
  "empresa_cnpj_ou_nome",
  "cliente_nome",
  "cliente_documento",
  "numero_nota",
  "data_emissao",
  "codigo_produto",
  "descricao_produto",
  "quantidade",
  "valor_unitario",
];

const EXAMPLES = [
  ["Distribuidora Makários", "Supermercado Família Ltda", "12.345.678/0001-90", "1001", "15/05/2025", "OL001", "Óleo de Soja 900ml", 50, 6.90],
  ["Distribuidora Makários", "Supermercado Família Ltda", "12.345.678/0001-90", "1001", "15/05/2025", "AR001", "Arroz Agulhinha 5kg", 20, 22.50],
  ["Distribuidora Makários", "Restaurante Bom Sabor ME",  "98.765.432/0001-11", "1002", "16/05/2025", "AC001", "Açúcar Cristal 5kg",  30, 14.90],
];

const INSTRUCTIONS = [
  ["INSTRUÇÕES DE PREENCHIMENTO"],
  [""],
  ["Campo", "Obrigatório?", "Observação"],
  ["empresa_cnpj_ou_nome", "Sim", "CNPJ formatado (00.000.000/0001-00) ou nome exato da empresa cadastrada"],
  ["cliente_nome",          "Sim", "Razão social ou nome do cliente"],
  ["cliente_documento",     "Não", "CNPJ ou CPF formatado (00.000.000/0001-00 ou 000.000.000-00)"],
  ["numero_nota",           "Não", "Número da nota/pedido. Linhas com mesmo número+empresa+cliente+data são agrupadas em uma nota"],
  ["data_emissao",          "Sim", "Formato: DD/MM/AAAA"],
  ["codigo_produto",        "Não", "Código interno do produto"],
  ["descricao_produto",     "Sim", "Nome/descrição do produto ou serviço"],
  ["quantidade",            "Sim", "Número (use ponto como separador decimal, ex: 2.5)"],
  ["valor_unitario",        "Sim", "Valor em R$ (use ponto como separador decimal, ex: 15.90)"],
  [""],
  ["DICAS"],
  ["• Salve o arquivo no formato .xlsx ou .csv antes de enviar"],
  ["• Não altere os nomes das colunas"],
  ["• Datas devem estar no formato DD/MM/AAAA"],
  ["• Valores decimais usam ponto (.) não vírgula (,)"],
];

export async function GET() {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const buf = buildWorkbook([
    {
      name: "Dados",
      aoa: [HEADER, ...EXAMPLES],
    },
    {
      name: "Instruções",
      aoa: INSTRUCTIONS,
    },
  ]);

  return xlsxResponse(buf, "makarios-modelo-importacao-planilha.xlsx");
}
