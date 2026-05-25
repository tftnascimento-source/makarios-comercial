import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { hasMinRole } from "@/lib/auth/rbac";
import { parseNFeXml, NFeParseError } from "@/lib/nfe/parser";
import { db } from "@/lib/db";
import { empresas } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

function cnpjToFormatted(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 14) return raw;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json(
      { error: "Não autenticado", code: "UNAUTHENTICATED" },
      { status: 401 }
    );
  }

  if (!hasMinRole(session, "gestor")) {
    return NextResponse.json(
      { error: "Acesso negado", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Requisição inválida", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  const files = formData.getAll("files") as File[];
  if (files.length === 0) {
    return NextResponse.json(
      { error: "Nenhum arquivo enviado", code: "NO_FILES" },
      { status: 400 }
    );
  }

  const previews = await Promise.all(
    files.map(async (file) => {
      if (!file.name.toLowerCase().endsWith(".xml")) {
        return { arquivo: file.name, valido: false, erro: "Apenas .xml aceito" };
      }
      if (file.size > 2 * 1024 * 1024) {
        return { arquivo: file.name, valido: false, erro: "Arquivo maior que 2 MB" };
      }

      try {
        const nfe = parseNFeXml(await file.text());
        const cnpjFormatado = cnpjToFormatted(nfe.emitente.cnpj);

        const empresa = await db.query.empresas.findFirst({
          where: and(
            eq(empresas.grupoId, session.grupoId),
            eq(empresas.cnpj, cnpjFormatado)
          ),
        });

        const emissaoDate = new Date(nfe.dhEmi);
        const periodo = `${emissaoDate.getUTCFullYear()}-${String(emissaoDate.getUTCMonth() + 1).padStart(2, "0")}`;

        return {
          arquivo: file.name,
          valido: true,
          empresaEncontrada: !!empresa,
          empresa: empresa?.nome ?? null,
          cnpjEmitente: cnpjFormatado,
          nf: {
            numero: nfe.nNF,
            serie: nfe.serie,
            modelo: nfe.mod === "55" ? "NF-e" : nfe.mod === "65" ? "NFC-e" : `Mod. ${nfe.mod}`,
            dhEmi: nfe.dhEmi,
            periodo,
            valorProdutos: nfe.totais.vProd,
            valorDesconto: nfe.totais.vDesc,
            valorTotal: nfe.totais.vNF,
            emitente: nfe.emitente.nome,
            destinatario: nfe.destinatario.nome,
            totalItens: nfe.itens.length,
            duplicatas: nfe.duplicatas.map((d) => ({
              numero: d.nDup,
              vencimento: d.dVenc,
              valor: d.vDup,
            })),
          },
        };
      } catch (err) {
        const msg =
          err instanceof NFeParseError ? err.message : "XML inválido";
        return { arquivo: file.name, valido: false, erro: msg };
      }
    })
  );

  return NextResponse.json({ data: previews });
}
