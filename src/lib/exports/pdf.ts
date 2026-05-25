/**
 * Server-side PDF generation helpers using jsPDF + jspdf-autotable.
 * Import only in API routes (Node.js only).
 *
 * autoTable must be called as: autoTable(doc, options)
 */
import { jsPDF } from "jspdf";
import autoTable, { type HAlignType } from "jspdf-autotable";

export type PdfColumn = {
  header: string;
  dataKey: string;
  width?: number;
  align?: HAlignType;
};

export type PdfRow = Record<string, string | number>;

const GOLD: [number, number, number]  = [184, 134, 11];
const DARK: [number, number, number]  = [10,  10,  10];
const BGLT: [number, number, number]  = [245, 245, 240];
const GRAY: [number, number, number]  = [120, 120, 120];

export function createPdf(landscape = false): jsPDF {
  return new jsPDF({
    orientation: landscape ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  });
}

export function drawHeader(doc: jsPDF, title: string, subtitle?: string): number {
  const pageW = doc.internal.pageSize.getWidth();

  // Brand stripe
  doc.setFillColor(...GOLD);
  doc.rect(0, 0, pageW, 12, "F");

  // Logo text
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("GRUPO MAKÁRIOS", 14, 8);
  doc.setFont("helvetica", "normal");
  doc.text("Gestão Comercial", 14 + doc.getTextWidth("GRUPO MAKÁRIOS") + 3, 8);

  // Date right-aligned
  const dateStr = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  doc.text(dateStr, pageW - 14, 8, { align: "right" });

  // Title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text(title, 14, 22);

  let y = 27;
  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY);
    doc.text(subtitle, 14, y);
    y += 6;
  }

  return y + 2;
}

export function drawTable(
  doc: jsPDF,
  columns: PdfColumn[],
  rows: PdfRow[],
  startY: number
): number {
  const head = [columns.map((c) => c.header)];
  const body = rows.map((r) => columns.map((c) => String(r[c.dataKey] ?? "")));

  const columnStyles: Record<number, { halign: HAlignType; cellWidth?: number }> = {};
  columns.forEach((c, i) => {
    columnStyles[i] = {
      halign: c.align ?? "left",
      ...(c.width !== undefined ? { cellWidth: c.width } : {}),
    };
  });

  const pageH = doc.internal.pageSize.getHeight();

  autoTable(doc, {
    startY,
    head,
    body,
    theme: "grid",
    headStyles: {
      fillColor: GOLD,
      textColor: [255, 255, 255] as [number, number, number],
      fontSize: 8,
      fontStyle: "bold",
      halign: "center",
    },
    bodyStyles: {
      fontSize: 8,
      textColor: DARK,
    },
    alternateRowStyles: {
      fillColor: BGLT,
    },
    columnStyles,
    margin: { left: 14, right: 14 },
    didDrawPage: ({ pageNumber }: { pageNumber: number }) => {
      doc.setFontSize(7);
      doc.setTextColor(...GRAY);
      const pw = doc.internal.pageSize.getWidth();
      doc.text(`Página ${pageNumber}`, pw / 2, pageH - 6, { align: "center" });
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((doc as any).lastAutoTable?.finalY ?? startY) as number;
}

export function pdfResponse(doc: jsPDF, filename: string): Response {
  const ab = doc.output("arraybuffer");
  return new Response(new Uint8Array(ab), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
