"use client";

import { useState, useMemo } from "react";
import {
  Users, Plus, Pencil, KeyRound, Building2, ToggleLeft, ToggleRight,
  ChevronRight, Shield, Eye, Loader2, Search, CheckCircle2, Clock,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = "admin_grupo" | "gestor" | "visualizador";

type UsuarioRow = {
  id: string;
  nome: string;
  email: string;
  role: Role;
  ativo: boolean;
  ultimoAcesso: string | null;
  criadoEm: string;
  empresaCount: number;
  empresaIds: string[];
};

type Empresa = { id: string; nome: string };

interface Props {
  usuarios: UsuarioRow[];
  empresas: Empresa[];
  currentUserId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<Role, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  admin_grupo:   { label: "Admin",       color: "bg-amber-100 text-amber-800 border-amber-200",  icon: Shield },
  gestor:        { label: "Gestor",      color: "bg-blue-100 text-blue-800 border-blue-200",     icon: CheckCircle2 },
  visualizador:  { label: "Visualizador",color: "bg-gray-100 text-gray-700 border-gray-200",     icon: Eye },
};

function RoleBadge({ role }: { role: Role }) {
  const cfg = ROLE_CONFIG[role];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${cfg.color}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDatetime(iso: string | null) {
  if (!iso) return "Nunca";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UsuariosClient({ usuarios: initialUsuarios, empresas, currentUserId }: Props) {
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>(initialUsuarios);
  const [search, setSearch]     = useState("");
  const [filtroRole, setFiltroRole] = useState<"todos" | Role>("todos");
  const [filtroAtivo, setFiltroAtivo] = useState<"todos" | "ativo" | "inativo">("todos");

  // ── Dialogs ──
  type DialogMode =
    | { type: "create" }
    | { type: "edit";        usuario: UsuarioRow }
    | { type: "reset-senha"; usuario: UsuarioRow }
    | { type: "empresas";    usuario: UsuarioRow };

  const [dialog, setDialog]   = useState<DialogMode | null>(null);
  const [saving, setSaving]   = useState(false);
  const [saveError, setSaveError] = useState("");

  // ── Create/Edit form ──
  const [form, setForm] = useState({ nome: "", email: "", senha: "", role: "visualizador" as Role });

  // ── Reset senha form ──
  const [resetSenha, setResetSenha] = useState({ nova: "", confirma: "" });
  const [showSenha, setShowSenha]   = useState(false);

  // ── Empresas assignment ──
  const [selectedEmpresas, setSelectedEmpresas] = useState<string[]>([]);

  function openCreate() {
    setForm({ nome: "", email: "", senha: "", role: "visualizador" });
    setSaveError("");
    setDialog({ type: "create" });
  }

  function openEdit(u: UsuarioRow) {
    setForm({ nome: u.nome, email: u.email, senha: "", role: u.role });
    setSaveError("");
    setDialog({ type: "edit", usuario: u });
  }

  function openResetSenha(u: UsuarioRow) {
    setResetSenha({ nova: "", confirma: "" });
    setShowSenha(false);
    setSaveError("");
    setDialog({ type: "reset-senha", usuario: u });
  }

  function openEmpresas(u: UsuarioRow) {
    setSelectedEmpresas(u.empresaIds);
    setSaveError("");
    setDialog({ type: "empresas", usuario: u });
  }

  function closeDialog() {
    setDialog(null);
    setSaveError("");
  }

  // ── Filter ──
  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter((u) => {
      if (filtroRole !== "todos" && u.role !== filtroRole) return false;
      if (filtroAtivo === "ativo"   && !u.ativo) return false;
      if (filtroAtivo === "inativo" &&  u.ativo) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!u.nome.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [usuarios, search, filtroRole, filtroAtivo]);

  // ── Save handlers ──────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!form.nome || !form.email || !form.senha) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/usuarios", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ nome: form.nome, email: form.email, senha: form.senha, role: form.role }),
      });
      const json = (await res.json()) as { data?: UsuarioRow; error?: string };
      if (!res.ok) { setSaveError(json.error ?? "Erro ao criar usuário"); return; }
      const novo = { ...json.data!, empresaIds: [], empresaCount: 0 };
      setUsuarios((prev) => [...prev, novo]);
      // If gestor/visualizador, go straight to empresa assignment
      if (form.role !== "admin_grupo") {
        setSelectedEmpresas([]);
        setDialog({ type: "empresas", usuario: novo });
      } else {
        closeDialog();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit() {
    if (dialog?.type !== "edit") return;
    setSaving(true);
    setSaveError("");
    try {
      const body: Record<string, unknown> = {};
      if (form.nome !== dialog.usuario.nome) body.nome = form.nome;
      if (form.role !== dialog.usuario.role) body.role = form.role;

      const res = await fetch(`/api/usuarios/${dialog.usuario.id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const json = (await res.json()) as { data?: Partial<UsuarioRow>; error?: string };
      if (!res.ok) { setSaveError(json.error ?? "Erro ao atualizar"); return; }
      setUsuarios((prev) => prev.map((u) =>
        u.id === dialog.usuario.id ? { ...u, ...(json.data ?? {}) } : u
      ));
      // If role changed to gestor/visualizador, open empresa assignment
      const newRole = (json.data?.role ?? dialog.usuario.role) as Role;
      if (newRole !== "admin_grupo" && form.role !== dialog.usuario.role) {
        const updated = usuarios.find((u) => u.id === dialog.usuario.id)!;
        setSelectedEmpresas(updated.empresaIds);
        setDialog({ type: "empresas", usuario: { ...updated, role: newRole } });
      } else {
        closeDialog();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleAtivo(u: UsuarioRow) {
    if (u.id === currentUserId) return; // can't deactivate self
    setSaving(true);
    try {
      const res = await fetch(`/api/usuarios/${u.id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ativo: !u.ativo }),
      });
      if (res.ok) {
        setUsuarios((prev) => prev.map((x) => x.id === u.id ? { ...x, ativo: !x.ativo } : x));
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleResetSenha() {
    if (dialog?.type !== "reset-senha") return;
    if (resetSenha.nova !== resetSenha.confirma) { setSaveError("As senhas não coincidem"); return; }
    if (resetSenha.nova.length < 8) { setSaveError("Senha deve ter pelo menos 8 caracteres"); return; }
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch(`/api/usuarios/${dialog.usuario.id}/reset-senha`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ novaSenha: resetSenha.nova }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) { setSaveError(json.error ?? "Erro ao redefinir senha"); return; }
      closeDialog();
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEmpresas() {
    if (dialog?.type !== "empresas") return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch(`/api/usuarios/${dialog.usuario.id}/empresas`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ empresaIds: selectedEmpresas }),
      });
      const json = (await res.json()) as { data?: { empresaIds: string[] }; error?: string };
      if (!res.ok) { setSaveError(json.error ?? "Erro ao salvar"); return; }
      setUsuarios((prev) => prev.map((u) =>
        u.id === dialog.usuario.id
          ? { ...u, empresaIds: json.data!.empresaIds, empresaCount: json.data!.empresaIds.length }
          : u
      ));
      closeDialog();
    } finally {
      setSaving(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm text-[var(--color-mk-gray)]">
        <span>Admin</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-[var(--color-mk-black)]">Usuários</span>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-mk-black)]">Usuários</h1>
          <p className="text-sm text-[var(--color-mk-gray)] mt-0.5">
            Gerencie os usuários do grupo e seus acessos por empresa.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-mk-gold)] hover:bg-[var(--color-mk-gold-dark)] text-white text-sm font-semibold transition-colors"
        >
          <Plus className="h-4 w-4" />
          Novo Usuário
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-mk-gray)]" />
          <input
            type="text"
            placeholder="Buscar por nome ou e-mail…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 focus:border-[var(--color-mk-gold)]"
          />
        </div>
        <select
          value={filtroRole}
          onChange={(e) => setFiltroRole(e.target.value as typeof filtroRole)}
          className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 focus:border-[var(--color-mk-gold)]"
        >
          <option value="todos">Todos os perfis</option>
          <option value="admin_grupo">Admin</option>
          <option value="gestor">Gestor</option>
          <option value="visualizador">Visualizador</option>
        </select>
        <select
          value={filtroAtivo}
          onChange={(e) => setFiltroAtivo(e.target.value as typeof filtroAtivo)}
          className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 focus:border-[var(--color-mk-gold)]"
        >
          <option value="todos">Todos os status</option>
          <option value="ativo">Somente ativos</option>
          <option value="inativo">Somente inativos</option>
        </select>
        <span className="text-xs text-[var(--color-mk-gray)] ml-auto">
          {usuariosFiltrados.length} usuário{usuariosFiltrados.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
        {usuariosFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-10 w-10 text-[var(--color-mk-gray)] mb-3 opacity-40" />
            <p className="text-sm font-medium text-[var(--color-mk-gray-dark)]">Nenhum usuário encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-muted)] border-b border-[var(--color-border)]">
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Usuário</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Perfil</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Empresas</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide hidden md:table-cell">Último acesso</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide hidden lg:table-cell">Criado em</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-[var(--color-mk-gray)] uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 w-28" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {usuariosFiltrados.map((u) => {
                  const isSelf = u.id === currentUserId;
                  return (
                    <tr key={u.id} className={`hover:bg-[var(--color-muted)]/40 transition-colors ${!u.ativo ? "opacity-60" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-[color-mix(in_srgb,var(--color-mk-gold)_15%,white)] flex items-center justify-center shrink-0 border border-[color-mix(in_srgb,var(--color-mk-gold)_25%,transparent)]">
                            <span className="text-xs font-bold text-[var(--color-mk-gold-dark)]">
                              {u.nome.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-[var(--color-mk-black)] truncate">
                              {u.nome}
                              {isSelf && (
                                <span className="ml-2 text-[10px] bg-[var(--color-muted)] text-[var(--color-mk-gray)] px-1.5 py-0.5 rounded font-normal">
                                  você
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-[var(--color-mk-gray)] truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {u.role === "admin_grupo" ? (
                          <span className="text-xs text-[var(--color-mk-gray)] italic">todas</span>
                        ) : (
                          <button
                            onClick={() => openEmpresas(u)}
                            className="inline-flex items-center gap-1 text-xs text-[var(--color-mk-gold-dark)] hover:underline font-medium"
                            title="Gerenciar acessos"
                          >
                            <Building2 className="h-3.5 w-3.5" />
                            {u.empresaCount === 0 ? "nenhuma" : `${u.empresaCount}`}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--color-mk-gray-dark)] hidden md:table-cell">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-[var(--color-mk-gray)] shrink-0" />
                          {formatDatetime(u.ultimoAcesso)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--color-mk-gray)] hidden lg:table-cell">
                        {formatDate(u.criadoEm)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleAtivo(u)}
                          disabled={isSelf || saving}
                          title={isSelf ? "Não é possível desativar sua própria conta" : u.ativo ? "Desativar" : "Ativar"}
                          className="disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                        >
                          {u.ativo
                            ? <ToggleRight className="h-6 w-6 text-green-500 hover:text-green-600" />
                            : <ToggleLeft  className="h-6 w-6 text-gray-400 hover:text-gray-500" />
                          }
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => openEdit(u)}
                            className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--color-mk-gray)] hover:bg-[var(--color-muted)] hover:text-[var(--color-mk-black)] transition-colors"
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => openResetSenha(u)}
                            className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--color-mk-gray)] hover:bg-amber-50 hover:text-amber-600 transition-colors"
                            title="Redefinir senha"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => openEmpresas(u)}
                            disabled={u.role === "admin_grupo"}
                            className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--color-mk-gray)] hover:bg-[var(--color-muted)] hover:text-[var(--color-mk-black)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title={u.role === "admin_grupo" ? "Admin acessa todas as empresas" : "Gerenciar empresas"}
                          >
                            <Building2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────────────────────── */}

      {/* Create / Edit */}
      {(dialog?.type === "create" || dialog?.type === "edit") && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeDialog(); }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
              <h2 className="text-base font-semibold text-[var(--color-mk-black)]">
                {dialog.type === "create" ? "Novo Usuário" : "Editar Usuário"}
              </h2>
              <button onClick={closeDialog} className="h-7 w-7 rounded-lg flex items-center justify-center text-[var(--color-mk-gray)] hover:bg-[var(--color-muted)]">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-xs font-medium text-[var(--color-mk-gray-dark)] mb-1.5">
                  Nome completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex: Maria Silva"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 focus:border-[var(--color-mk-gold)]"
                />
              </div>

              {/* Email (somente create) */}
              {dialog.type === "create" && (
                <div>
                  <label className="block text-xs font-medium text-[var(--color-mk-gray-dark)] mb-1.5">
                    E-mail <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="usuario@empresa.com.br"
                    className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 focus:border-[var(--color-mk-gold)]"
                  />
                </div>
              )}

              {/* Senha (somente create) */}
              {dialog.type === "create" && (
                <div>
                  <label className="block text-xs font-medium text-[var(--color-mk-gray-dark)] mb-1.5">
                    Senha <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={form.senha}
                    onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 focus:border-[var(--color-mk-gold)]"
                  />
                </div>
              )}

              {/* Role */}
              <div>
                <label className="block text-xs font-medium text-[var(--color-mk-gray-dark)] mb-1.5">
                  Perfil de acesso <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 focus:border-[var(--color-mk-gold)]"
                >
                  <option value="admin_grupo">Admin do Grupo — acessa tudo</option>
                  <option value="gestor">Gestor — pode editar, por empresa</option>
                  <option value="visualizador">Visualizador — somente leitura, por empresa</option>
                </select>
                {form.role !== "admin_grupo" && (
                  <p className="text-xs text-[var(--color-mk-gray)] mt-1.5">
                    No próximo passo você definirá quais empresas este usuário pode acessar.
                  </p>
                )}
              </div>

              {saveError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={closeDialog} className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium text-[var(--color-mk-gray-dark)] hover:bg-[var(--color-muted)]">
                  Cancelar
                </button>
                <button
                  onClick={dialog.type === "create" ? handleCreate : handleEdit}
                  disabled={saving || !form.nome || (dialog.type === "create" && (!form.email || !form.senha))}
                  className="flex-1 px-4 py-2 rounded-lg bg-[var(--color-mk-gold)] hover:bg-[var(--color-mk-gold-dark)] text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {dialog.type === "create" ? "Criar Usuário" : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Senha */}
      {dialog?.type === "reset-senha" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeDialog(); }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
              <div>
                <h2 className="text-base font-semibold text-[var(--color-mk-black)]">Redefinir Senha</h2>
                <p className="text-xs text-[var(--color-mk-gray)] mt-0.5">{dialog.usuario.nome}</p>
              </div>
              <button onClick={closeDialog} className="h-7 w-7 rounded-lg flex items-center justify-center text-[var(--color-mk-gray)] hover:bg-[var(--color-muted)]">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--color-mk-gray-dark)] mb-1.5">Nova senha</label>
                <div className="relative">
                  <input
                    type={showSenha ? "text" : "password"}
                    value={resetSenha.nova}
                    onChange={(e) => setResetSenha((s) => ({ ...s, nova: e.target.value }))}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full pr-10 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 focus:border-[var(--color-mk-gold)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSenha((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-mk-gray)] hover:text-[var(--color-mk-black)]"
                  >
                    {showSenha ? <Eye className="h-4 w-4" /> : <Eye className="h-4 w-4 opacity-50" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-mk-gray-dark)] mb-1.5">Confirmar nova senha</label>
                <input
                  type={showSenha ? "text" : "password"}
                  value={resetSenha.confirma}
                  onChange={(e) => setResetSenha((s) => ({ ...s, confirma: e.target.value }))}
                  placeholder="Repita a senha"
                  className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-[var(--color-mk-black)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mk-gold)]/30 ${
                    resetSenha.confirma && resetSenha.nova !== resetSenha.confirma
                      ? "border-red-400 focus:border-red-400"
                      : "border-[var(--color-border)] focus:border-[var(--color-mk-gold)]"
                  }`}
                />
                {resetSenha.confirma && resetSenha.nova !== resetSenha.confirma && (
                  <p className="text-xs text-red-600 mt-1">As senhas não coincidem</p>
                )}
              </div>

              {saveError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={closeDialog} className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium text-[var(--color-mk-gray-dark)] hover:bg-[var(--color-muted)]">
                  Cancelar
                </button>
                <button
                  onClick={handleResetSenha}
                  disabled={saving || !resetSenha.nova || resetSenha.nova !== resetSenha.confirma}
                  className="flex-1 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Redefinir senha
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empresas */}
      {dialog?.type === "empresas" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeDialog(); }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
              <div>
                <h2 className="text-base font-semibold text-[var(--color-mk-black)]">Acesso a Empresas</h2>
                <p className="text-xs text-[var(--color-mk-gray)] mt-0.5">{dialog.usuario.nome}</p>
              </div>
              <button onClick={closeDialog} className="h-7 w-7 rounded-lg flex items-center justify-center text-[var(--color-mk-gray)] hover:bg-[var(--color-muted)]">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-xs text-[var(--color-mk-gray-dark)]">
                Selecione as empresas que <strong>{dialog.usuario.nome}</strong> poderá visualizar:
              </p>

              {empresas.length === 0 ? (
                <p className="text-sm text-[var(--color-mk-gray)] italic text-center py-4">Nenhuma empresa cadastrada</p>
              ) : (
                <div className="space-y-2">
                  {/* Selecionar todas */}
                  <label className="flex items-center gap-3 px-3 py-2 rounded-lg border border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-muted)] transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedEmpresas.length === empresas.length}
                      onChange={(e) => setSelectedEmpresas(e.target.checked ? empresas.map((e) => e.id) : [])}
                      className="h-4 w-4 rounded accent-[var(--color-mk-gold)]"
                    />
                    <span className="text-sm font-medium text-[var(--color-mk-gray-dark)]">Todas as empresas</span>
                  </label>
                  <div className="border-t border-[var(--color-border)] pt-2 space-y-1.5">
                    {empresas.map((emp) => (
                      <label key={emp.id} className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-[var(--color-muted)] transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedEmpresas.includes(emp.id)}
                          onChange={(e) => {
                            setSelectedEmpresas((prev) =>
                              e.target.checked ? [...prev, emp.id] : prev.filter((id) => id !== emp.id)
                            );
                          }}
                          className="h-4 w-4 rounded accent-[var(--color-mk-gold)]"
                        />
                        <span className="text-sm text-[var(--color-mk-black)]">{emp.nome}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {saveError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={closeDialog} className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium text-[var(--color-mk-gray-dark)] hover:bg-[var(--color-muted)]">
                  Cancelar
                </button>
                <button
                  onClick={handleSaveEmpresas}
                  disabled={saving}
                  className="flex-1 px-4 py-2 rounded-lg bg-[var(--color-mk-gold)] hover:bg-[var(--color-mk-gold-dark)] text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Salvar acesso
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
