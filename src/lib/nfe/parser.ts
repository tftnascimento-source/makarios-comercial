import { XMLParser } from "fast-xml-parser";

// ─── Tipos de saída do parser ─────────────────────────────────────────────────

export interface NFeItem {
  nItem: number;
  cProd: string;
  xProd: string;
  qCom: number;
  vUnCom: number;
  vProd: number;
}

export interface NfeDuplicata {
  nDup: string;
  dVenc: string; // "YYYY-MM-DD"
  vDup: number;
}

export interface NFeData {
  /** Número da NF */
  nNF: string;
  /** Série */
  serie: string;
  /** Modelo: 55 = NF-e, 65 = NFC-e */
  mod: string;
  /** Data/hora de emissão ISO 8601 */
  dhEmi: string;
  /** Chave de acesso (44 dígitos) */
  chNFe: string;
  emitente: {
    cnpj: string;
    nome: string;
    uf: string;
  };
  destinatario: {
    /** CNPJ ou CPF */
    documento: string;
    nome: string;
  };
  totais: {
    vProd: number;
    vDesc: number;
    vNF: number;
    vICMS: number;
  };
  itens: NFeItem[];
  /** Duplicatas (parcelas de cobrança) — pode estar vazio */
  duplicatas: NfeDuplicata[];
}

// ─── Parser ───────────────────────────────────────────────────────────────────

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: true,
  trimValues: true,
  parseAttributeValue: true,
});

export class NFeParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NFeParseError";
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeNum(v: unknown): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function safeStr(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

export function parseNFeXml(xmlContent: string): NFeData {
  let parsed: Record<string, unknown>;
  try {
    parsed = xmlParser.parse(xmlContent) as Record<string, unknown>;
  } catch {
    throw new NFeParseError("XML inválido ou malformado.");
  }

  // Suporta os envelopes: nfeProc > NFe, ou diretamente NFe, ou nfeProc direto
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const root = (parsed["nfeProc"] ?? parsed["NFe"] ?? parsed) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nfe = (root["NFe"] ?? root) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inf = nfe?.["infNFe"] as any;

  if (!inf) {
    throw new NFeParseError(
      "Estrutura de NF-e não reconhecida. Certifique-se de enviar um arquivo XML de NF-e válido."
    );
  }

  // Chave de acesso — pode estar no atributo Id (remove prefixo "NFe")
  const chNFe = safeStr(inf["@_Id"]).replace(/^NFe/, "");

  // Identificação
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ide = (inf["ide"] ?? {}) as any;
  const nNF = safeStr(ide["nNF"]);
  const serie = safeStr(ide["serie"]);
  const mod = safeStr(ide["mod"]);
  const dhEmi = safeStr(ide["dhEmi"] || ide["dEmi"]);

  if (!nNF || !dhEmi) {
    throw new NFeParseError("NF-e sem número ou data de emissão.");
  }

  // Emitente
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const emit = (inf["emit"] ?? {}) as any;
  const emitCNPJ = safeStr(emit["CNPJ"] || emit["CPF"]).replace(/\D/g, "");
  const emitNome = safeStr(emit["xNome"] || emit["xFant"]);
  const emitUF = safeStr(emit["enderEmit"]?.["UF"] ?? "");

  // Destinatário
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dest = (inf["dest"] ?? {}) as any;
  const destDoc = safeStr(dest["CNPJ"] || dest["CPF"]).replace(/\D/g, "");
  const destNome = safeStr(dest["xNome"]);

  // Totais
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const icmsTot = (inf["total"]?.["ICMSTot"] ?? {}) as any;
  const totais = {
    vProd: safeNum(icmsTot["vProd"]),
    vDesc: safeNum(icmsTot["vDesc"]),
    vNF: safeNum(icmsTot["vNF"]),
    vICMS: safeNum(icmsTot["vICMS"]),
  };

  if (totais.vNF === 0) {
    throw new NFeParseError("NF-e com valor total zero.");
  }

  // Itens
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detRaw = inf["det"] as any;
  const detArr = Array.isArray(detRaw) ? detRaw : detRaw ? [detRaw] : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itens: NFeItem[] = detArr.map((d: any, idx: number) => {
    const prod = d["prod"] ?? {};
    return {
      nItem: safeNum(d["@_nItem"] ?? idx + 1),
      cProd: safeStr(prod["cProd"]),
      xProd: safeStr(prod["xProd"]),
      qCom: safeNum(prod["qCom"]),
      vUnCom: safeNum(prod["vUnCom"]),
      vProd: safeNum(prod["vProd"]),
    };
  });

  // Duplicatas / cobranças
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cobr = (inf["cobr"] ?? {}) as any;
  const dupRaw = cobr["dup"];
  const dupArr = Array.isArray(dupRaw) ? dupRaw : dupRaw ? [dupRaw] : [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const duplicatas: NfeDuplicata[] = dupArr.map((d: any) => ({
    nDup: safeStr(d["nDup"]),
    dVenc: safeStr(d["dVenc"]), // YYYY-MM-DD
    vDup: safeNum(d["vDup"]),
  }));

  return {
    nNF,
    serie,
    mod,
    dhEmi,
    chNFe,
    emitente: { cnpj: emitCNPJ, nome: emitNome, uf: emitUF },
    destinatario: { documento: destDoc, nome: destNome },
    totais,
    itens,
    duplicatas,
  };
}
