import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import { empresas } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlanilhaPreviewItem = {
  descricao: string;
  codigo: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
};

export type PlanilhaPreviewNota = {
  /** Row index from spreadsheet (1-based) where this group starts */
  linhaInicio: number;
  empresaNome: string;
  empresaId: string;
  clienteNome: string;
  clienteDocumento: string;
  numeroNota: string;
  dataEmissao: string; // ISO
  periodo: string;     // YYYY-MM
  itens: PlanilhaPreviewItem[];
  valorTotal: number;
  erros: string[];
};

export type PlanilhaPreviewResult = {
  notas: PlanilhaPreviewNota[];
  totalLinhas: number;
  totalNotas: number;
  totalItens: number;
  totalErros: number;
  novosClientes: string[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDate(raw: unknown): Date | null {
  if (!raw) return null;
  // If Excel serial number
  if (typeof raw === "number") {
    // Excel date serial
    const d = XLSX.SSF.parse_date_code(raw);
    if (d) return new Date(d.y, d.m - 1, d.d);
  }
  if (typeof raw === "string") {
    // DD/MM/YYYY
    const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    // YYYY-MM-DD
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

function periodoFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function groupKey(empresa: string, cliente: string, doc: string, nota: string, data: string) {
  return `${empresa}||${cliente}||${doc}||${nota}||${data}`;
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

  // Build lookup maps
  const byNome = new Map(empresasRows.map((e) => [e.nome.toLowerCase().trim(), e]));
  const byCnpj = new Map(
    empresasRows
      .filter((e) => e.cnpj)
      .map((e) => [e.cnpj!.replace(/\D/g, ""), e])
  );

  function findEmpresa(raw: string) {
    if (!raw) return null;
    const clean = raw.trim();
    const digits = clean.replace(/\D/g, "");
    if (digits.length === 14) return byCnpj.get(digits) ?? null;
    return byNome.get(clean.toLowerCase()) ?? null;
  }

  // Parse multipart
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

  // Map rows into grouped notas
  const groups = new Map<string, PlanilhaPreviewNota>();
  const novosClientesSet = new Set<string>();
  let linhaIdx = 2; // 1-based, row 1 = header

  for (const row of rows) {
    const erros: string[] = [];

    const empresaRaw = String(row["empresa_cnpj_ou_nome"] ?? "").trim();
    const clienteNome = String(row["cliente_nome"] ?? "").trim();
    const clienteDoc = String(row["cliente_documento"] ?? "").trim();
    const numeroNota = String(row["numero_nota"] ?? "").trim();
    const dataRaw = row["data_emissao"];
    const codigo = String(row["codigo_produto"] ?? "").trim();
    const descricao = String(row["descricao_produto"] ?? "").trim();
    const qtdRaw = parseNum(row["quantidade"]);
    const vUnRaw = parseNum(row["valor_unitario"]);

    // Validations
    if (!empresaRaw) erros.push("empresa_cnpj_ou_nome é obrigatório");
    if (!clienteNome) erros.push("cliente_nome é obrigatório");
    if (!descricao) erros.push("descricao_produto é obrigatório");
    if (qtdRaw === null || qtdRaw <= 0) erros.push("quantidade inválida");
    if (vUnRaw === null || vUnRaw < 0) erros.push("valor_unitario inválido");

    const empresa = empresaRaw ? findEmpresa(empresaRaw) : null;
    if (empresaRaw && !empresa) erros.push(`Empresa "${empresaRaw}" não encontrada`);

    const dataEmissao = parseDate(dataRaw);
    if (!dataEmissao) erros.push("data_emissao inválida (use DD/MM/AAAA)");

    const key = groupKey(
      empresa?.id ?? empresaRaw,
      clienteNome.toLowerCase(),
      clienteDoc,
      numeroNota,
      dataEmissao?.toISOString().slice(0, 10) ?? String(dataRaw)
    );

    if (!groups.has(key)) {
      const newCliente = clienteNome && !erros.some((e) => e.includes("cliente")) ? clienteNome : "";
      if (newCliente) novosClientesSet.add(`${clienteNome}${clienteDoc ? ` (${clienteDoc})` : ""}`);

      groups.set(key, {
        linhaInicio: linhaIdx,
        empresaNome: empresa?.nome ?? empresaRaw,
        empresaId: empresa?.id ?? "",
        clienteNome,
        clienteDocumento: clienteDoc,
        numeroNota: numeroNota || `PLAN-${linhaIdx}`,
        dataEmissao: dataEmissao?.toISOString() ?? "",
        periodo: dataEmissao ? periodoFromDate(dataEmissao) : "",
        itens: [],
        valorTotal: 0,
        erros: [],
      });
    }

    const nota = groups.get(key)!;

    // Propagate per-nota errors (empresa/date) only once
    if (erros.some((e) => e.includes("Empresa") || e.includes("empresa") || e.includes("data"))) {
      for (const e of erros) {
        if (!nota.erros.includes(e)) nota.erros.push(e);
      }
    }

    if (qtdRaw !== null && vUnRaw !== null) {
      const valorTotal = Math.round(qtdRaw * vUnRaw * 100) / 100;
      nota.itens.push({
        descricao: descricao || "—",
        codigo,
        quantidade: qtdRaw,
        valorUnitario: vUnRaw,
        valorTotal,
      });
      nota.valorTotal += valorTotal;
      nota.valorTotal = Math.round(nota.valorTotal * 100) / 100;
    } else {
      const itemErrors = erros.filter(
        (e) => e.includes("quantidade") || e.includes("valor") || e.includes("descricao")
      );
      for (const e of itemErrors) {
        if (!nota.erros.includes(`Linha ${linhaIdx}: ${e}`))
          nota.erros.push(`Linha ${linhaIdx}: ${e}`);
      }
    }

    linhaIdx++;
  }

  const notas = [...groups.values()];
  const totalErros = notas.reduce((s, n) => s + n.erros.length, 0);

  const result: PlanilhaPreviewResult = {
    notas,
    totalLinhas: rows.length,
    totalNotas: notas.length,
    totalItens: notas.reduce((s, n) => s + n.itens.length, 0),
    totalErros,
    novosClientes: [...novosClientesSet],
  };

  return NextResponse.json({ data: result });
}
