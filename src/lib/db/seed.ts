import { db } from "./index";
import {
  grupos,
  empresas,
  usuarios,
  empresaUsuarios,
  metas,
  faturamentos,
  titulos,
  clientes,
  notasFiscais,
  itensNfe,
  vendedores,
  regrasComissao,
  faixasComissao,
  metasVendedor,
  comissoes,
} from "./schema";
import { hashPassword } from "@/lib/utils/password";
import { eq } from "drizzle-orm";

// ─── IDs determinísticos ──────────────────────────────────────────────────────

const GRUPO_ID   = "00000000-0000-0000-0000-000000000001";
const EMPRESA_A  = "00000000-0000-0000-0000-000000000002"; // Distribuidora
const EMPRESA_B  = "00000000-0000-0000-0000-000000000003"; // Serviços
const EMPRESA_C  = "00000000-0000-0000-0000-000000000004"; // Tecnologia

const USER_ADMIN  = "00000000-0000-0000-0000-000000000010";
const USER_GESTOR = "00000000-0000-0000-0000-000000000011";
const USER_VIEW   = "00000000-0000-0000-0000-000000000012";
const USER_VEND   = "00000000-0000-0000-0000-000000000013"; // login do vendedor

// Regras
const REGRA_FLAT   = "00000000-0000-0000-0001-000000000001";
const REGRA_ESCAL  = "00000000-0000-0000-0001-000000000002";

// Vendedores
const VD_JOAO    = "00000000-0000-0000-0002-000000000001";
const VD_MARIA   = "00000000-0000-0000-0002-000000000002";
const VD_PEDRO   = "00000000-0000-0000-0002-000000000003";
const VD_ANA     = "00000000-0000-0000-0002-000000000004"; // EMPRESA_B

// Clientes
const CLI_IDS = [
  "10000000-0000-0000-0000-000000000001",
  "10000000-0000-0000-0000-000000000002",
  "10000000-0000-0000-0000-000000000003",
  "10000000-0000-0000-0000-000000000004",
  "10000000-0000-0000-0000-000000000005",
];

// ─── Seeded RNG ───────────────────────────────────────────────────────────────

let rngSeed = 42;
function rand() {
  rngSeed = (rngSeed * 1664525 + 1013904223) & 0xffffffff;
  return ((rngSeed >>> 0) / 0xffffffff);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function periodo(monthsAgo: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - monthsAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Populando banco de dados Makários...\n");

  const [adminHash, gestorHash, viewHash, vendHash] = await Promise.all([
    hashPassword("Admin@123"),
    hashPassword("Gestor@123"),
    hashPassword("View@123"),
    hashPassword("Vend@123"),
  ]);

  // ── 1. Grupo ────────────────────────────────────────────────────────────────
  console.log("1. Grupo...");
  await db.insert(grupos).values({
    id: GRUPO_ID, nome: "Grupo Makários", cnpj: "00.000.000/0001-00",
  }).onConflictDoNothing();

  // ── 2. Empresas ─────────────────────────────────────────────────────────────
  console.log("2. Empresas...");
  await db.insert(empresas).values([
    { id: EMPRESA_A, grupoId: GRUPO_ID, nome: "Makários Distribuidora Ltda", cnpj: "11.111.111/0001-11", segmento: "Distribuição",  responsavel: "Carlos Mendes" },
    { id: EMPRESA_B, grupoId: GRUPO_ID, nome: "Makários Serviços S.A.",      cnpj: "22.222.222/0001-22", segmento: "Serviços",       responsavel: "Ana Lima"      },
    { id: EMPRESA_C, grupoId: GRUPO_ID, nome: "Makários Tecnologia ME",      cnpj: "33.333.333/0001-33", segmento: "Tecnologia",     responsavel: "Pedro Costa"   },
  ]).onConflictDoNothing();

  // ── 3. Usuários ─────────────────────────────────────────────────────────────
  console.log("3. Usuários...");
  await db.insert(usuarios).values([
    { id: USER_ADMIN,  grupoId: GRUPO_ID, nome: "Admin Makários",   email: "admin@makarios.com.br",   senhaHash: adminHash,  role: "admin_grupo"  },
    { id: USER_GESTOR, grupoId: GRUPO_ID, nome: "Carlos Gestor",    email: "gestor@makarios.com.br",  senhaHash: gestorHash, role: "gestor"       },
    { id: USER_VIEW,   grupoId: GRUPO_ID, nome: "Ana Visualizador", email: "view@makarios.com.br",    senhaHash: viewHash,   role: "visualizador" },
    { id: USER_VEND,   grupoId: GRUPO_ID, nome: "João Vendedor",    email: "joao@makarios.com.br",    senhaHash: vendHash,   role: "visualizador" },
  ]).onConflictDoNothing();

  // ── 4. RBAC ─────────────────────────────────────────────────────────────────
  console.log("4. RBAC...");
  await db.insert(empresaUsuarios).values([
    { empresaId: EMPRESA_A, usuarioId: USER_GESTOR },
    { empresaId: EMPRESA_B, usuarioId: USER_GESTOR },
    { empresaId: EMPRESA_A, usuarioId: USER_VIEW   },
    { empresaId: EMPRESA_A, usuarioId: USER_VEND   },
  ]).onConflictDoNothing();

  // ── 5. Regras de comissão ───────────────────────────────────────────────────
  console.log("5. Regras de comissão...");
  await db.insert(regrasComissao).values([
    { id: REGRA_FLAT,  empresaId: EMPRESA_A, nome: "Comissão Flat 5%",     tipo: "flat",       ativa: true },
    { id: REGRA_ESCAL, empresaId: EMPRESA_A, nome: "Comissão Escalonada",  tipo: "escalonado", ativa: true },
  ]).onConflictDoNothing();

  // Faixas — flat: uma única faixa 5%
  // Faixas — escalonado: 3 faixas por volume
  await db.insert(faixasComissao).values([
    // Flat
    { regraId: REGRA_FLAT,  valorMinimo: "0",        valorMaximo: null,      percentual: "5.00", ordem: 0 },
    // Escalonado
    { regraId: REGRA_ESCAL, valorMinimo: "0",        valorMaximo: "50000",   percentual: "3.00", ordem: 0 },
    { regraId: REGRA_ESCAL, valorMinimo: "50000",    valorMaximo: "150000",  percentual: "5.50", ordem: 1 },
    { regraId: REGRA_ESCAL, valorMinimo: "150000",   valorMaximo: null,      percentual: "8.00", ordem: 2 },
  ]).onConflictDoNothing();

  // ── 6. Vendedores ───────────────────────────────────────────────────────────
  console.log("6. Vendedores...");
  await db.insert(vendedores).values([
    {
      id: VD_JOAO,  empresaId: EMPRESA_A,
      nome: "João Silva",    email: "joao@makarios.com.br",
      documento: "111.111.111-11", regraComissaoId: REGRA_ESCAL, ativo: true,
    },
    {
      id: VD_MARIA, empresaId: EMPRESA_A,
      nome: "Maria Santos",  email: "maria@makarios.com.br",
      documento: "222.222.222-22", regraComissaoId: REGRA_ESCAL, ativo: true,
    },
    {
      id: VD_PEDRO, empresaId: EMPRESA_A,
      nome: "Pedro Alves",   email: "pedro@makarios.com.br",
      documento: "333.333.333-33", regraComissaoId: REGRA_FLAT,  ativo: true,
    },
    {
      id: VD_ANA,   empresaId: EMPRESA_B,
      nome: "Ana Costa",     email: "ana@makarios.com.br",
      documento: "444.444.444-44", regraComissaoId: null, ativo: true,
    },
  ]).onConflictDoNothing();

  // ── 7. Clientes (vinculados a vendedores) ───────────────────────────────────
  console.log("7. Clientes...");
  const CLIENTES_SEED = [
    { id: CLI_IDS[0]!, empresaId: EMPRESA_A, documento: "12.345.678/0001-01", nome: "Supermercado Familia Ltda",  vendedorId: VD_JOAO  },
    { id: CLI_IDS[1]!, empresaId: EMPRESA_A, documento: "23.456.789/0001-02", nome: "Restaurante Bom Sabor ME",   vendedorId: VD_JOAO  },
    { id: CLI_IDS[2]!, empresaId: EMPRESA_A, documento: "34.567.890/0001-03", nome: "Padaria Central Eireli",     vendedorId: VD_MARIA },
    { id: CLI_IDS[3]!, empresaId: EMPRESA_A, documento: "45.678.901/0001-04", nome: "Mercadinho São João Ltda",   vendedorId: VD_MARIA },
    { id: CLI_IDS[4]!, empresaId: EMPRESA_A, documento: "56.789.012/0001-05", nome: "Atacadão Norte Comércio",    vendedorId: VD_PEDRO },
  ];

  for (const c of CLIENTES_SEED) {
    await db.insert(clientes).values(c).onConflictDoNothing();
    // Update vendedorId in case cliente already existed from previous seed
    await db.update(clientes)
      .set({ vendedorId: c.vendedorId })
      .where(eq(clientes.id, c.id));
  }

  // ── 8. Faturamento + metas de empresa (6 meses) ────────────────────────────
  console.log("8. Faturamentos e metas de empresa...");
  const empresasList = [
    { id: EMPRESA_A, base: 850_000 },
    { id: EMPRESA_B, base: 420_000 },
    { id: EMPRESA_C, base: 210_000 },
  ];

  for (let i = 5; i >= 0; i--) {
    const p = periodo(i);
    for (const emp of empresasList) {
      const noise  = 1 + (rand() * 0.3 - 0.15);
      const bruto  = Math.round(emp.base * noise);
      const liquido = Math.round(bruto * 0.88);
      await db.insert(faturamentos).values({ empresaId: emp.id, periodo: p, valorBruto: String(bruto), valorLiquido: String(liquido) }).onConflictDoNothing();
      await db.insert(metas).values({ empresaId: emp.id, periodo: p, valorMeta: String(Math.round(emp.base * 1.1)) }).onConflictDoNothing();
    }
  }

  // ── 9. Títulos (20 por empresa) ─────────────────────────────────────────────
  console.log("9. Títulos...");
  const sacados = ["Alpha Comércio Ltda", "Beta Indústria S.A.", "Gamma Serviços ME", "Delta Atacado Ltda", "Epsilon Varejo S.A."];
  const diasOffsets = [-95,-85,-75,-65,-55,-45,-35,-25,-20,-15,-10,-5,-2,0,5,10,15,20,30,45];
  const hoje = new Date();

  for (const emp of empresasList) {
    for (let t = 0; t < 20; t++) {
      const sacado     = sacados[t % sacados.length]!;
      const valor      = (rand() * 45_000 + 5_000).toFixed(2);
      const diasOffset = diasOffsets[t] ?? (-t * 5);

      const venc = new Date(hoje);
      venc.setDate(venc.getDate() + diasOffset);
      const emissao = new Date(venc);
      emissao.setDate(emissao.getDate() - 30);

      const isVencido = diasOffset < 0;
      const status: "aberto" | "vencido" | "pago" = isVencido
        ? rand() > 0.35 ? "vencido" : "pago"
        : "aberto";

      await db.insert(titulos).values({
        empresaId: emp.id, sacado, valor,
        dataEmissao: emissao, dataVencimento: venc, status,
        dataPagamento: status === "pago" ? new Date() : null,
        numeroDoc: `DOC-${emp.id.slice(-4).toUpperCase()}-${String(t + 1).padStart(3, "0")}`,
      }).onConflictDoNothing();
    }
  }

  // ── 10. Notas Fiscais + Itens NF-e (Curva ABC) ─────────────────────────────
  console.log("10. Notas fiscais e itens NF-e...");
  const PRODUTOS = [
    { cProd: "OL001", xProd: "Óleo de Soja 900ml",         vUn: 6.90  },
    { cProd: "AR001", xProd: "Arroz Agulhinha 5kg",         vUn: 22.50 },
    { cProd: "FJ001", xProd: "Feijão Carioca 1kg",          vUn: 8.70  },
    { cProd: "FA001", xProd: "Farinha de Trigo 1kg",        vUn: 4.50  },
    { cProd: "AC001", xProd: "Açúcar Cristal 2kg",          vUn: 7.80  },
    { cProd: "SA001", xProd: "Sal Refinado 1kg",            vUn: 2.90  },
    { cProd: "MA001", xProd: "Macarrão Espaguete 500g",     vUn: 3.80  },
    { cProd: "LE001", xProd: "Leite Integral 1L",           vUn: 5.20  },
    { cProd: "CA001", xProd: "Café Torrado e Moído 250g",   vUn: 12.90 },
    { cProd: "MO001", xProd: "Molho de Tomate 340g",        vUn: 3.50  },
    { cProd: "SE001", xProd: "Sardinha em Lata 125g",       vUn: 4.20  },
    { cProd: "AZ001", xProd: "Azeite Extra Virgem 500ml",   vUn: 28.00 },
    { cProd: "VI001", xProd: "Vinagre de Álcool 750ml",     vUn: 3.20  },
    { cProd: "BI001", xProd: "Biscoito Cream Cracker 400g", vUn: 5.60  },
  ] as const;

  // Perfil de compras por cliente (quantidades por produto)
  const QTDS: Record<string, number[]> = {
    [CLI_IDS[0]!]: [120, 80, 60, 40, 35, 20, 50, 90, 30, 25, 15, 10, 8, 20],
    [CLI_IDS[1]!]: [40, 30, 50, 20, 15, 10, 30, 40, 60, 15, 10, 5, 4, 8],
    [CLI_IDS[2]!]: [60, 50, 30, 60, 20, 15, 40, 60, 50, 20, 8, 6, 5, 12],
    [CLI_IDS[3]!]: [80, 60, 45, 30, 25, 20, 35, 70, 40, 18, 12, 8, 6, 15],
    [CLI_IDS[4]!]: [200, 150, 100, 80, 60, 50, 90, 140, 80, 40, 25, 15, 10, 30],
  };

  let notaSeq = 1000;

  for (const cli of CLIENTES_SEED) {
    for (let m = 5; m >= 0; m--) {
      const emissaoDate = new Date(hoje.getFullYear(), hoje.getMonth() - m, 15);
      const p = `${emissaoDate.getFullYear()}-${String(emissaoDate.getMonth() + 1).padStart(2, "0")}`;
      notaSeq++;
      const chave = `${notaSeq}`.padStart(44, "0");

      const qtds  = QTDS[cli.id] ?? QTDS[CLI_IDS[0]!]!;
      const itens = PRODUTOS.map((prod, i) => ({
        cProd: prod.cProd, xProd: prod.xProd,
        qCom: qtds[i] ?? 10, vUnCom: prod.vUn,
        vProd: (qtds[i] ?? 10) * prod.vUn,
      }));
      const valorTotal = itens.reduce((s, it) => s + it.vProd, 0);

      const [nota] = await db.insert(notasFiscais).values({
        empresaId: EMPRESA_A, clienteId: cli.id,
        numero: String(notaSeq), serie: "1", chaveNfe: chave,
        dhEmissao: emissaoDate, periodo: p,
        valorProdutos: valorTotal.toFixed(2),
        valorDesconto: "0.00",
        valorTotal: valorTotal.toFixed(2),
      }).onConflictDoNothing().returning();

      if (!nota) continue;

      await db.insert(itensNfe).values(
        itens.map((it) => ({
          notaFiscalId: nota.id, empresaId: EMPRESA_A, clienteId: cli.id,
          cProd: it.cProd, xProd: it.xProd,
          qCom: it.qCom.toFixed(4), vUnCom: it.vUnCom.toFixed(4),
          vProd: it.vProd.toFixed(2), periodo: p,
        }))
      ).onConflictDoNothing();
    }
  }

  // ── 11. Metas por vendedor (6 meses) ────────────────────────────────────────
  console.log("11. Metas por vendedor...");

  // Calcular volume real de vendas por vendedor por período (usando QTDS acima)
  // João → clientes 0 + 1; Maria → clientes 2 + 3; Pedro → cliente 4
  const totalPorCliente: Record<string, number> = {};
  for (const [cliId, qtds] of Object.entries(QTDS)) {
    totalPorCliente[cliId] = PRODUTOS.reduce((s, p, i) => s + (qtds[i] ?? 10) * p.vUn, 0);
  }

  const vendMetas: { vendedorId: string; empresaId: string; base: number }[] = [
    { vendedorId: VD_JOAO,  empresaId: EMPRESA_A, base: (totalPorCliente[CLI_IDS[0]!] ?? 0) + (totalPorCliente[CLI_IDS[1]!] ?? 0) },
    { vendedorId: VD_MARIA, empresaId: EMPRESA_A, base: (totalPorCliente[CLI_IDS[2]!] ?? 0) + (totalPorCliente[CLI_IDS[3]!] ?? 0) },
    { vendedorId: VD_PEDRO, empresaId: EMPRESA_A, base:  totalPorCliente[CLI_IDS[4]!] ?? 0 },
  ];

  for (let m = 5; m >= 0; m--) {
    const p = periodo(m);
    for (const vm of vendMetas) {
      const meta = Math.round(vm.base * 1.1); // meta 10% acima da base
      await db.insert(metasVendedor)
        .values({ vendedorId: vm.vendedorId, empresaId: vm.empresaId, periodo: p, valorMeta: String(meta) })
        .onConflictDoNothing();
    }
  }

  // ── 12. Comissões calculadas (últimos 6 meses) ──────────────────────────────
  console.log("12. Comissões...");

  // Vendas reais por vendedor por mês = totalPorCliente * qtd_notas (1 nota/mês)
  // João e Maria → regra escalonada; Pedro → flat 5%
  for (let m = 5; m >= 0; m--) {
    const p = periodo(m);

    for (const vm of vendMetas) {
      const totalVendas = vm.base; // 1 nota por mês por cliente

      // Calcular comissão conforme regra
      let percentual: number;
      let faixaDesc: string;
      let regraId: string;

      if (vm.vendedorId === VD_PEDRO) {
        // Flat 5%
        percentual = 5.0;
        faixaDesc  = "Flat 5%";
        regraId    = REGRA_FLAT;
      } else {
        // Escalonado
        regraId = REGRA_ESCAL;
        if (totalVendas <= 50_000) {
          percentual = 3.0; faixaDesc = "Até R$ 50.000 → 3%";
        } else if (totalVendas <= 150_000) {
          percentual = 5.5; faixaDesc = "R$ 50.000–150.000 → 5,5%";
        } else {
          percentual = 8.0; faixaDesc = "Acima de R$ 150.000 → 8%";
        }
      }

      const valorComissao = totalVendas * (percentual / 100);

      // Último mês: calculada; 2 meses atrás: aprovada; demais: paga
      const status: "calculada" | "aprovada" | "paga" =
        m === 0 ? "calculada" : m === 1 ? "aprovada" : "paga";

      await db.insert(comissoes).values({
        empresaId:          EMPRESA_A,
        vendedorId:         vm.vendedorId,
        regraComissaoId:    regraId,
        periodo:            p,
        totalVendas:        String(totalVendas.toFixed(2)),
        faixaDescricao:     faixaDesc,
        percentualAplicado: String(percentual.toFixed(2)),
        valorComissao:      String(valorComissao.toFixed(2)),
        status,
      }).onConflictDoNothing();
    }
  }

  // ── Resumo ──────────────────────────────────────────────────────────────────
  console.log("\n✅ Seed concluído!\n");
  console.log("Credenciais de acesso:");
  console.log("  admin@makarios.com.br  / Admin@123   → admin_grupo  (todas as 3 empresas + auditoria)");
  console.log("  gestor@makarios.com.br / Gestor@123  → gestor       (Distribuidora + Serviços)");
  console.log("  view@makarios.com.br   / View@123    → visualizador (Distribuidora)");
  console.log("  joao@makarios.com.br   / Vend@123    → visualizador (Distribuidora, vinculado ao vendedor João Silva)");
  console.log("\nVendedores criados (EMPRESA_A — Distribuidora):");
  console.log("  João Silva  → regra escalonada (3/5,5/8%) → clientes: Supermercado + Restaurante");
  console.log("  Maria Santos→ regra escalonada (3/5,5/8%) → clientes: Padaria + Mercadinho");
  console.log("  Pedro Alves → regra flat 5%              → cliente: Atacadão");

  process.exit(0);
}

main().catch((err) => {
  console.error("Erro no seed:", err);
  process.exit(1);
});
