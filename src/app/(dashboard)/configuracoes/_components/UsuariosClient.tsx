"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  Pencil,
  Building2,
  ShieldCheck,
  ShieldAlert,
  Shield,
  UserX,
  UserCheck,
} from "lucide-react";
import { ROLE_LABELS } from "@/lib/auth/rbac";
import { formatDateBR } from "@/lib/utils";
import UsuarioDialog from "./UsuarioDialog";
import AssignEmpresasDialog from "./AssignEmpresasDialog";

type Empresa = { id: string; nome: string };

type UsuarioRow = {
  id: string;
  nome: string;
  email: string;
  role: "admin_grupo" | "gestor" | "visualizador";
  ativo: boolean;
  ultimoAcesso: string | null;
  criadoEm: string;
  empresaCount: number;
};

interface Props {
  usuarios: UsuarioRow[];
  empresas: Empresa[];
  currentUserId: string;
}

type DialogState =
  | { type: "create" }
  | { type: "edit"; usuario: UsuarioRow }
  | null;

type AssignState = {
  usuarioId: string;
  usuarioNome: string;
  usuarioRole: string;
  currentIds: string[];
} | null;

function RoleBadge({ role }: { role: UsuarioRow["role"] }) {
  const Icon =
    role === "admin_grupo"
      ? ShieldCheck
      : role === "gestor"
        ? Shield
        : ShieldAlert;
  const color =
    role === "admin_grupo"
      ? "bg-[color-mix(in_srgb,var(--color-mk-gold)_15%,white)] text-[var(--color-mk-gold-dark)] border border-[color-mix(in_srgb,var(--color-mk-gold)_25%,transparent)]"
      : role === "gestor"
        ? "bg-blue-50 text-blue-700 border border-blue-200"
        : "bg-[var(--color-muted)] text-[var(--color-mk-gray-dark)] border border-[var(--color-border)]";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}
    >
      <Icon className="h-3 w-3" />
      {ROLE_LABELS[role]}
    </span>
  );
}

function StatusDot({ ativo }: { ativo: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${
        ativo ? "text-green-700" : "text-[var(--color-mk-gray)]"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${ativo ? "bg-green-500" : "bg-[var(--color-mk-gray)]"}`}
      />
      {ativo ? "Ativo" : "Inativo"}
    </span>
  );
}

export default function UsuariosClient({
  usuarios: initialUsuarios,
  empresas,
  currentUserId,
}: Props) {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState(initialUsuarios);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [assign, setAssign] = useState<AssignState>(null);
  const [loadingAssign, setLoadingAssign] = useState<string | null>(null);

  const handleUserSaved = useCallback(
    (updated: UsuarioRow & { empresaCount?: number }) => {
      setUsuarios((prev) => {
        const idx = prev.findIndex((u) => u.id === updated.id);
        if (idx === -1) {
          // New user
          return [
            ...prev,
            { ...updated, empresaCount: updated.empresaCount ?? 0 },
          ];
        }
        // Updated user
        const next = [...prev];
        next[idx] = {
          ...next[idx]!,
          nome: updated.nome,
          email: updated.email,
          role: updated.role,
          ativo: updated.ativo,
        };
        return next;
      });
      setDialog(null);
      router.refresh();
    },
    [router]
  );

  async function openAssign(usuario: UsuarioRow) {
    setLoadingAssign(usuario.id);
    try {
      const res = await fetch(`/api/usuarios/${usuario.id}/empresas`);
      const json = (await res.json()) as { data: string[] };
      setAssign({
        usuarioId: usuario.id,
        usuarioNome: usuario.nome,
        usuarioRole: usuario.role,
        currentIds: json.data ?? [],
      });
    } finally {
      setLoadingAssign(null);
    }
  }

  function handleAssignSaved(ids: string[]) {
    setUsuarios((prev) =>
      prev.map((u) =>
        u.id === assign?.usuarioId ? { ...u, empresaCount: ids.length } : u
      )
    );
    setAssign(null);
  }

  async function toggleAtivo(usuario: UsuarioRow) {
    if (usuario.id === currentUserId) return; // guard
    const res = await fetch(`/api/usuarios/${usuario.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !usuario.ativo }),
    });
    if (res.ok) {
      setUsuarios((prev) =>
        prev.map((u) =>
          u.id === usuario.id ? { ...u, ativo: !u.ativo } : u
        )
      );
    }
  }

  return (
    <>
      {dialog && (
        <UsuarioDialog
          mode={
            dialog.type === "create"
              ? { type: "create" }
              : { type: "edit", usuario: dialog.usuario }
          }
          isSelf={dialog.type === "edit" && dialog.usuario.id === currentUserId}
          onClose={() => setDialog(null)}
          onSaved={handleUserSaved as never}
        />
      )}

      {assign && (
        <AssignEmpresasDialog
          usuarioId={assign.usuarioId}
          usuarioNome={assign.usuarioNome}
          usuarioRole={assign.usuarioRole}
          empresas={empresas}
          currentIds={assign.currentIds}
          onClose={() => setAssign(null)}
          onSaved={handleAssignSaved}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm text-[var(--color-mk-gray)]">
            {usuarios.length} usuário{usuarios.length !== 1 ? "s" : ""} no grupo
          </p>
        </div>
        <button
          onClick={() => setDialog({ type: "create" })}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-mk-gold)] hover:bg-[var(--color-mk-gold-dark)] text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          Convidar Usuário
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
              <th className="text-left px-5 py-3 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide">
                Usuário
              </th>
              <th className="text-left px-5 py-3 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide hidden md:table-cell">
                Perfil
              </th>
              <th className="text-center px-5 py-3 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide hidden lg:table-cell">
                Empresas
              </th>
              <th className="text-center px-5 py-3 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide hidden sm:table-cell">
                Status
              </th>
              <th className="text-left px-5 py-3 font-semibold text-[var(--color-mk-gray)] text-xs uppercase tracking-wide hidden xl:table-cell">
                Último acesso
              </th>
              <th className="px-5 py-3 w-32" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {usuarios.map((u) => {
              const isSelf = u.id === currentUserId;
              return (
                <tr
                  key={u.id}
                  className={`hover:bg-[var(--color-muted)] transition-colors ${!u.ativo ? "opacity-60" : ""}`}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-[color-mix(in_srgb,var(--color-mk-gold)_15%,white)] border border-[color-mix(in_srgb,var(--color-mk-gold)_20%,transparent)] flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-[var(--color-mk-gold-dark)]">
                          {u.nome.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-[var(--color-mk-black)] truncate">
                          {u.nome}
                          {isSelf && (
                            <span className="ml-1.5 text-xs text-[var(--color-mk-gray)] font-normal">
                              (você)
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-[var(--color-mk-gray)] truncate">
                          {u.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-5 py-3.5 text-center hidden lg:table-cell">
                    {u.role === "admin_grupo" ? (
                      <span className="text-xs text-[var(--color-mk-gray)]">Todas</span>
                    ) : (
                      <span className="text-sm font-medium text-[var(--color-mk-black)]">
                        {u.empresaCount}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-center hidden sm:table-cell">
                    <StatusDot ativo={u.ativo} />
                  </td>
                  <td className="px-5 py-3.5 text-xs text-[var(--color-mk-gray)] hidden xl:table-cell">
                    {u.ultimoAcesso ? formatDateBR(u.ultimoAcesso) : "Nunca"}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      {/* Edit */}
                      <button
                        onClick={() => setDialog({ type: "edit", usuario: u })}
                        className="p-1.5 rounded-md text-[var(--color-mk-gray)] hover:text-[var(--color-mk-gold)] hover:bg-[var(--color-muted)] transition-colors"
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>

                      {/* Assign empresas */}
                      <button
                        onClick={() => openAssign(u)}
                        disabled={loadingAssign === u.id}
                        className="p-1.5 rounded-md text-[var(--color-mk-gray)] hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-40"
                        title="Atribuir empresas"
                      >
                        <Building2 className="h-3.5 w-3.5" />
                      </button>

                      {/* Toggle ativo */}
                      {!isSelf && (
                        <button
                          onClick={() => toggleAtivo(u)}
                          className={`p-1.5 rounded-md transition-colors ${
                            u.ativo
                              ? "text-[var(--color-mk-gray)] hover:text-red-600 hover:bg-red-50"
                              : "text-[var(--color-mk-gray)] hover:text-green-600 hover:bg-green-50"
                          }`}
                          title={u.ativo ? "Desativar usuário" : "Reativar usuário"}
                        >
                          {u.ativo ? (
                            <UserX className="h-3.5 w-3.5" />
                          ) : (
                            <UserCheck className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
