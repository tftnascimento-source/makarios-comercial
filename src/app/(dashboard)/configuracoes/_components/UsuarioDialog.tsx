"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UsuarioCreateSchema, UsuarioUpdateSchema } from "@/lib/validations/usuario";
import { X, Loader2, Eye, EyeOff } from "lucide-react";
import { ROLE_LABELS } from "@/lib/auth/rbac";

type CreateForm = z.output<typeof UsuarioCreateSchema>;
type UpdateForm = z.output<typeof UsuarioUpdateSchema>;

type UsuarioRow = {
  id: string;
  nome: string;
  email: string;
  role: "admin_grupo" | "gestor" | "visualizador";
  ativo: boolean;
};

type Mode =
  | { type: "create" }
  | { type: "edit"; usuario: UsuarioRow };

interface Props {
  mode: Mode;
  isSelf: boolean;
  onClose: () => void;
  onSaved: (u: UsuarioRow) => void;
}

const ROLES: ("admin_grupo" | "gestor" | "visualizador")[] = [
  "admin_grupo",
  "gestor",
  "visualizador",
];

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--color-mk-gray-dark)] mb-1.5">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 focus:border-[var(--color-mk-gold)]";

export default function UsuarioDialog({ mode, isSelf, onClose, onSaved }: Props) {
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSenha, setShowSenha] = useState(false);

  const createForm = useForm<CreateForm>({
    resolver: zodResolver(UsuarioCreateSchema) as never,
    defaultValues: { nome: "", email: "", senha: "", role: "visualizador" },
  });

  const editForm = useForm<UpdateForm>({
    resolver: zodResolver(UsuarioUpdateSchema) as never,
    defaultValues:
      mode.type === "edit"
        ? { nome: mode.usuario.nome, role: mode.usuario.role, ativo: mode.usuario.ativo }
        : {},
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  async function handleCreate(data: CreateForm) {
    setServerError("");
    setLoading(true);
    try {
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = (await res.json()) as { error?: string; data?: UsuarioRow & { empresaCount: number } };
      if (!res.ok) { setServerError(json.error ?? "Erro ao criar usuário."); return; }
      onSaved(json.data!);
    } finally {
      setLoading(false);
    }
  }

  async function handleEdit(data: UpdateForm) {
    if (mode.type !== "edit") return;
    setServerError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/usuarios/${mode.usuario.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = (await res.json()) as { error?: string; data?: UsuarioRow };
      if (!res.ok) { setServerError(json.error ?? "Erro ao atualizar usuário."); return; }
      onSaved(json.data!);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-base font-semibold text-[var(--color-mk-black)]">
            {mode.type === "create" ? "Convidar Usuário" : "Editar Usuário"}
          </h2>
          <button
            onClick={onClose}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-[var(--color-mk-gray)] hover:bg-[var(--color-muted)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          {serverError && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {serverError}
            </div>
          )}

          {mode.type === "create" ? (
            <form
              onSubmit={createForm.handleSubmit(handleCreate as never)}
              className="space-y-4"
            >
              <Field label="Nome" error={createForm.formState.errors.nome?.message}>
                <input
                  {...createForm.register("nome")}
                  placeholder="Nome completo"
                  className={inputCls}
                />
              </Field>

              <Field label="E-mail" error={createForm.formState.errors.email?.message}>
                <input
                  {...createForm.register("email")}
                  type="email"
                  placeholder="email@exemplo.com"
                  className={inputCls}
                />
              </Field>

              <Field
                label="Senha inicial"
                error={createForm.formState.errors.senha?.message}
              >
                <div className="relative">
                  <input
                    {...createForm.register("senha")}
                    type={showSenha ? "text" : "password"}
                    placeholder="Mínimo 8 caracteres"
                    className={inputCls + " pr-10"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSenha((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-mk-gray)] hover:text-[var(--color-mk-black)]"
                  >
                    {showSenha ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </Field>

              <Field label="Perfil" error={createForm.formState.errors.role?.message}>
                <select {...createForm.register("role")} className={inputCls}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </Field>

              <p className="text-xs text-[var(--color-mk-gray)] -mt-1">
                O usuário poderá alterar a senha no primeiro acesso.
              </p>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium text-[var(--color-mk-gray-dark)] hover:bg-[var(--color-muted)] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 rounded-lg bg-[var(--color-mk-gold)] hover:bg-[var(--color-mk-gold-dark)] text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Criar Usuário
                </button>
              </div>
            </form>
          ) : (
            <form
              onSubmit={editForm.handleSubmit(handleEdit as never)}
              className="space-y-4"
            >
              <div className="rounded-lg bg-[var(--color-muted)] px-4 py-3">
                <p className="text-xs text-[var(--color-mk-gray)]">E-mail</p>
                <p className="text-sm font-medium text-[var(--color-mk-black)] mt-0.5">
                  {mode.usuario.email}
                </p>
              </div>

              <Field label="Nome" error={editForm.formState.errors.nome?.message}>
                <input
                  {...editForm.register("nome")}
                  className={inputCls}
                />
              </Field>

              <Field label="Perfil" error={editForm.formState.errors.role?.message}>
                <select {...editForm.register("role")} className={inputCls}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </Field>

              {!isSelf && (
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="ativo"
                    {...editForm.register("ativo")}
                    className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-mk-gold)]"
                  />
                  <label
                    htmlFor="ativo"
                    className="text-sm text-[var(--color-mk-black)] select-none cursor-pointer"
                  >
                    Usuário ativo
                  </label>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium text-[var(--color-mk-gray-dark)] hover:bg-[var(--color-muted)] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 rounded-lg bg-[var(--color-mk-gold)] hover:bg-[var(--color-mk-gold-dark)] text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Salvar
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
