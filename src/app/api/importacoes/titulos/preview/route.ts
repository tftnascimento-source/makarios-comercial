export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import { empresas } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TituloStatus = "aberto" | "pago" | "vencido" | "cancelado";

export type TituloPreviewRow = {
  linhaIdx: number;
  empresaNome: string;
  empresaId: string;
  sacado: string;
  numeroDoc: string;
  dataEmissao: string;      // ISO
  dataVencimento: string;   // ISO
  dataPagamento: string | null; // ISO or null
  valor: number;
  status: TituloStatus;
  erros: string[];
};

export type TitulosPreviewResult = {
  titulos: TituloPreviewRow[];
  totalLinhas: number;
  totalValido: number;
  totalComErro: number;
  valorTotal: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDate(raw: unknown): Date | null {
  if (!raw) return null;
  if (typeof raw === "number") {
    const d = XLSX.SSF.parse_date_code(raw);
    if (d) return new Date(d.y, d.m - 1, d.d);
  }
  if (typeof raw === "string") {
    const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    const iso = new Date(raw);
    if (!isNaN(iso.getTime())) return iso;
  }
  return null;
}

function parseNum(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  return isNaN(n) ? null : n;
}

const VALID_STATUSES: TituloStatus[] = ["aberto", "pago", "vencido", "cancelado"];

function parseStatus(raw: unknown): TituloStatus {
  const s = String(raw ?? "").trim().toLowerCase();
  if ((VALID_STATUSES as string[]).includes(s)) return s as TituloStatus;
  return "aberto";
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const permittedIds = await getPermittedEmpresaIds(session);
  if (permittedIds.length === 0)
    return NextResponse.json({ error: "Sem empresas disponíveis" }, { status: 403 });

  const empresasRows = await db
    .select({ id: empresas.id, nome: empresas.nome, cnpj: empresas.cnpj })
    .from(empresas)
    .where(inArray(empresas.id, permittedIds));

  const byNome = new Map(empresasRows.map((e) => [e.nome.toLowerCase().trim(), e]));
  const byCnpj = new Map(
    empresasRows.filter((e) => e.cnpj).map((e) => [e.cnpj!.replace(/\D/g, ""), e])
  );

  function findEmpresa(raw: string) {
    const clean = raw.trim();
    const digits = clean.replace(/\D/g, "");
    if (digits.length === 14) return byCnpj.get(digits) ?? null;
    return byNome.get(clean.toLowerCase()) ?? null;
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buf, { type: "buffer", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]!];
  if (!ws) return NextResponse.json({ error: "Planilha vazia" }, { status: 400 });

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    header: 0,
    defval: "",
    raw: true,
  });

  const tituloRows: TituloPreviewRow[] = [];
  let linhaIdx = 2;

  for (const row of rows) {
    const erros: string[] = [];

    const empresaRaw   = String(row["empresa_cnpj_ou_nome"] ?? "").trim();
    const sacado       = String(row["sacado"] ?? "").trim();
    const numeroDoc    = String(row["numero_doc"] ?? "").trim();
    const emissaoRaw   = row["data_emissao"];
    const venctoRaw    = row["data_vencimento"];
    const pagtoRaw     = row["data_pagamento"];
    const valorRaw     = parseNum(row["valor"]);
    const statusRaw    = row["status"];

    if (!empresaRaw) erros.push("empresa_cnpj_ou_nome é obrigatório");
    if (!sacado) erros.push("sacado é obrigatório");
    if (valorRaw === null || valorRaw <= 0) erros.push("valor inválido (deve ser > 0)");

    const empresa = empresaRaw ? findEmpresa(empresaRaw) : null;
    if (empresaRaw && !empresa) erros.push(`Empresa "${empresaRaw}" não encontrada`);

    const dataEmissao  = parseDate(emissaoRaw);
    const dataVencto   = parseDate(venctoRaw);
    const dataPagto    = pagtoRaw ? parseDate(pagtoRaw) : null;

    if (!dataEmissao) erros.push("data_emissao inválida (use DD/MM/AAAA)");
    if (!dataVencto)  erros.push("data_vencimento inválida (use DD/MM/AAAA)");

    const status = parseStatus(statusRaw);
    if (status === "pago" && !dataPagto)
      erros.push("data_pagamento é obrigatória quando status = pago");

    if (dataEmissao && dataVencto && dataVencto < dataEmissao)
      erros.push("data_vencimento não pode ser anterior à data_emissao");

    tituloRows.push({
      linhaIdx,
      empresaNome:   empresa?.nome ?? empresaRaw,
      empresaId:     empresa?.id ?? "",
      sacado,
      numeroDoc,
      dataEmissao:   dataEmissao?.toISOString() ?? "",
      dataVencimento: dataVencto?.toISOString() ?? "",
      dataPagamento: dataPagto?.toISOString() ?? null,
      valor:         valorRaw ?? 0,
      status,
      erros,
    });

    linhaIdx++;
  }

  const totalValido   = tituloRows.filter((r) => r.erros.length === 0).length;
  const totalComErro  = tituloRows.filter((r) => r.erros.length > 0).length;
  const valorTotal    = tituloRows
    .filter((r) => r.erros.length === 0)
    .reduce((s, r) => s + r.valor, 0);

  const result: TitulosPreviewResult = {
    titulos: tituloRows,
    totalLinhas: rows.length,
    totalValido,
    totalComErro,
    valorTotal: Math.round(valorTotal * 100) / 100,
  };

  return NextResponse.json({ data: result });
}
