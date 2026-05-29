export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { hasMinRole } from "@/lib/auth/rbac";
import { getPermittedEmpresaIds } from "@/lib/auth/getPermittedEmpresaIds";
import { db } from "@/lib/db";
import { titulos, empresas } from "@/lib/db/schema";
import { eq, inArray, and, or, sql } from "drizzle-orm";
import { sendMail, isEmailConfigured } from "@/lib/email";
import { agingBucket } from "@/lib/utils";

const BUCKET_LABELS: Record<string, string> = {
  "1-30":  "1–30 dias",
  "31-60": "31–60 dias",
  "61-90": "61–90 dias",
  "+90":   "Acima de 90 dias",
};

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export async function POST() {
  // Auth — gestor ou superior
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  if (!hasMinRole(session, "gestor")) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  if (!isEmailConfigured()) {
    return NextResponse.json(
      {
        error: "E-mail não configurado no servidor.",
        code: "EMAIL_NOT_CONFIGURED",
        hint: "Defina SMTP_HOST, SMTP_USER, SMTP_PASS e ALERT_EMAIL_TO no arquivo .env.",
      },
      { status: 503 }
    );
  }

  const ids = await getPermittedEmpresaIds(session);
  if (ids.length === 0) {
    return NextResponse.json({ error: "Sem dados" }, { status: 404 });
  }

  // Buscar títulos vencidos
  const rows = await db
    .select({
      empresaNome:     empresas.nome,
      sacado:          titulos.sacado,
      numeroDoc:       titulos.numeroDoc,
      valor:           titulos.valor,
      dataVencimento:  titulos.dataVencimento,
      diasVencido: sql<number>`
        GREATEST(EXTRACT(DAY FROM NOW() - ${titulos.dataVencimento})::int, 1)
      `,
    })
    .from(titulos)
    .innerJoin(empresas, eq(titulos.empresaId, empresas.id))
    .where(
      and(
        inArray(titulos.empresaId, ids),
        or(eq(titulos.status, "aberto"), eq(titulos.status, "vencido")),
        sql`${titulos.dataVencimento} < NOW()`
      )
    )
    .orderBy(sql`${titulos.dataVencimento} ASC`);

  if (rows.length === 0) {
    return NextResponse.json({
      ok: true,
      sent: false,
      message: "Nenhum título vencido — alerta não enviado.",
    });
  }

  // Aging summary
  const buckets: Record<string, { count: number; total: number }> = {
    "1-30":  { count: 0, total: 0 },
    "31-60": { count: 0, total: 0 },
    "61-90": { count: 0, total: 0 },
    "+90":   { count: 0, total: 0 },
  };
  let totalVencido = 0;

  for (const r of rows) {
    const b = agingBucket(r.diasVencido);
    buckets[b]!.count++;
    buckets[b]!.total += Number(r.valor);
    totalVencido += Number(r.valor);
  }

  // Build HTML
  const dateStr = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
    timeZone: "America/Sao_Paulo",
  });

  const summaryRows = Object.entries(buckets)
    .filter(([, v]) => v.count > 0)
    .map(([b, v]) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${BUCKET_LABELS[b] ?? b}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${v.count}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${fmtBRL(v.total)}</td>
      </tr>`)
    .join("");

  const detailRows = rows.slice(0, 20).map((r) => `
    <tr>
      <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;">${r.empresaNome}</td>
      <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;">${r.sacado}</td>
      <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:12px;">${r.numeroDoc ?? "—"}</td>
      <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${fmtBRL(Number(r.valor))}</td>
      <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${fmtDate(r.dataVencimento)}</td>
      <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;text-align:center;color:#dc2626;font-weight:600;">${r.diasVencido}d</td>
    </tr>`).join("");

  const moreNote = rows.length > 20
    ? `<p style="font-size:12px;color:#6b7280;margin:8px 0 0;">… e mais ${rows.length - 20} títulos. Acesse o sistema para o relatório completo.</p>`
    : "";

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 0;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr>
          <td style="background:#b8860b;padding:18px 28px;">
            <span style="color:#fff;font-size:15px;font-weight:700;letter-spacing:.5px;">GRUPO MAKÁRIOS</span>
            <span style="color:rgba(255,255,255,.75);font-size:13px;margin-left:8px;">Gestão Comercial</span>
          </td>
        </tr>

        <!-- Title -->
        <tr>
          <td style="padding:28px 28px 0;">
            <h1 style="margin:0;font-size:20px;color:#0a0a0a;">⚠️ Alerta de Inadimplência</h1>
            <p style="margin:6px 0 0;color:#6b7280;font-size:13px;">${dateStr} · ${rows.length} título${rows.length !== 1 ? "s" : ""} vencido${rows.length !== 1 ? "s" : ""} · Total: <strong style="color:#dc2626;">${fmtBRL(totalVencido)}</strong></p>
          </td>
        </tr>

        <!-- Summary table -->
        <tr>
          <td style="padding:20px 28px 0;">
            <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:.5px;">Resumo por Faixa de Atraso</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;font-size:13px;">
              <thead>
                <tr style="background:#f3f4f6;">
                  <th style="padding:9px 12px;text-align:left;color:#6b7280;font-weight:600;">Faixa</th>
                  <th style="padding:9px 12px;text-align:center;color:#6b7280;font-weight:600;">Qtd.</th>
                  <th style="padding:9px 12px;text-align:right;color:#6b7280;font-weight:600;">Total</th>
                </tr>
              </thead>
              <tbody>${summaryRows}</tbody>
            </table>
          </td>
        </tr>

        <!-- Detail table -->
        <tr>
          <td style="padding:20px 28px 0;">
            <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:.5px;">Títulos Vencidos${rows.length > 20 ? " (primeiros 20)" : ""}</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;font-size:12px;">
              <thead>
                <tr style="background:#f3f4f6;">
                  <th style="padding:8px 12px;text-align:left;color:#6b7280;font-weight:600;">Empresa</th>
                  <th style="padding:8px 12px;text-align:left;color:#6b7280;font-weight:600;">Sacado</th>
                  <th style="padding:8px 12px;text-align:left;color:#6b7280;font-weight:600;">Nº Doc</th>
                  <th style="padding:8px 12px;text-align:right;color:#6b7280;font-weight:600;">Valor</th>
                  <th style="padding:8px 12px;text-align:center;color:#6b7280;font-weight:600;">Vencimento</th>
                  <th style="padding:8px 12px;text-align:center;color:#6b7280;font-weight:600;">Atraso</th>
                </tr>
              </thead>
              <tbody>${detailRows}</tbody>
            </table>
            ${moreNote}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:28px;border-top:1px solid #e5e7eb;margin-top:24px;">
            <p style="margin:0;font-size:11px;color:#9ca3af;">
              Este e-mail foi enviado automaticamente pelo sistema Grupo Makários Gestão Comercial.<br>
              Disparado por: ${session.nome} (${session.email})
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const recipients = (process.env["ALERT_EMAIL_TO"] ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  await sendMail({
    to: recipients,
    subject: `⚠️ Inadimplência — ${rows.length} título${rows.length !== 1 ? "s" : ""} vencido${rows.length !== 1 ? "s" : ""} · ${fmtBRL(totalVencido)}`,
    html,
    text: `Alerta de inadimplência — ${rows.length} títulos vencidos — Total: ${fmtBRL(totalVencido)}\nAcesse o sistema para o relatório completo.`,
  });

  return NextResponse.json({
    ok: true,
    sent: true,
    recipients,
    titulosVencidos: rows.length,
    totalVencido,
  });
}
