import type { InferSelectModel } from "drizzle-orm";
import type {
  grupos,
  empresas,
  usuarios,
  empresaUsuarios,
  metas,
  faturamentos,
  titulos,
  importacoes,
} from "@/lib/db/schema";

export type Grupo = InferSelectModel<typeof grupos>;
export type Empresa = InferSelectModel<typeof empresas>;
export type Usuario = InferSelectModel<typeof usuarios>;
export type EmpresaUsuario = InferSelectModel<typeof empresaUsuarios>;
export type Meta = InferSelectModel<typeof metas>;
export type Faturamento = InferSelectModel<typeof faturamentos>;
export type Titulo = InferSelectModel<typeof titulos>;
export type Importacao = InferSelectModel<typeof importacoes>;
