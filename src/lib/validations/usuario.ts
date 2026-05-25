import { z } from "zod";

export const UsuarioCreateSchema = z.object({
  nome: z.string().min(2, "Nome muito curto").max(255),
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(8, "Senha deve ter pelo menos 8 caracteres"),
  role: z.enum(["admin_grupo", "gestor", "visualizador"]),
});

export const UsuarioUpdateSchema = z.object({
  nome: z.string().min(2, "Nome muito curto").max(255).optional(),
  role: z.enum(["admin_grupo", "gestor", "visualizador"]).optional(),
  ativo: z.boolean().optional(),
});

export const UsuarioEmpresasSchema = z.object({
  empresaIds: z.array(
    z.string().regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    )
  ),
});

export type UsuarioCreateInput = z.infer<typeof UsuarioCreateSchema>;
export type UsuarioUpdateInput = z.infer<typeof UsuarioUpdateSchema>;
export type UsuarioEmpresasInput = z.infer<typeof UsuarioEmpresasSchema>;
