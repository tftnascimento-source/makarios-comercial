import type { SessionPayload } from "./session";

export type Role = "admin_grupo" | "gestor" | "visualizador";

const ROLE_RANK: Record<Role, number> = {
  admin_grupo: 3,
  gestor: 2,
  visualizador: 1,
};

export const ROLE_LABELS: Record<Role, string> = {
  admin_grupo: "Administrador do Grupo",
  gestor: "Gestor",
  visualizador: "Visualizador",
};

export function hasMinRole(session: SessionPayload, required: Role): boolean {
  const userRank = ROLE_RANK[session.role] ?? 0;
  const reqRank = ROLE_RANK[required] ?? 0;
  return userRank >= reqRank;
}

export function isAdminGrupo(session: SessionPayload): boolean {
  return session.role === "admin_grupo";
}
