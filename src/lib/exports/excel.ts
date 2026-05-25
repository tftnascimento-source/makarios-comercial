/**
 * Server-side Excel generation helpers using SheetJS (xlsx).
 * Import only in API routes (Node.js only).
 */
import * as XLSX from "xlsx";

export function buildWorkbook(
  sheets: { name: string; aoa: unknown[][] }[]
): Uint8Array {
  const wb = XLSX.utils.book_new();
  for (const { name, aoa } of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  // Convert Node Buffer → Uint8Array so it's valid BodyInit
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

export function xlsxResponse(data: Uint8Array, filename: string): Response {
  return new Response(data.buffer as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
