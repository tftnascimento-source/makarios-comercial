"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { LogOut, Bell, AlertTriangle, CheckCircle2, Target, X, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { Alerta } from "@/app/api/alertas/route";

interface HeaderProps {
  user: { nome: string; email: string; role: string };
}

// ─── Alert config ─────────────────────────────────────────────────────────────

const ALERTA_ICON = {
  inadimplencia: AlertTriangle,
  comissao:      CheckCircle2,
  meta:          Target,
};

const ALERTA_COLOR = {
  critical: {
    icon:   "text-red-500",
    bg:     "bg-red-50",
    border: "border-red-100",
    badge:  "bg-red-500",
    dot:    "bg-red-500",
  },
  warning: {
    icon:   "text-amber-500",
    bg:     "bg-amber-50",
    border: "border-amber-100",
    badge:  "bg-amber-500",
    dot:    "bg-amber-400",
  },
} as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function Header({ user }: HeaderProps) {
  const router = useRouter();
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  // ── Fetch alerts ──────────────────────────────────────────────────────────
  const fetchAlertas = useCallback(async () => {
    try {
      const res = await fetch("/api/alertas");
      if (!res.ok) return;
      const json = (await res.json()) as { data: { alertas: Alerta[]; totalCount: number } };
      setAlertas(json.data.alertas);
      setTotalCount(json.data.totalCount);
    } catch {
      // fail silently — alerts are non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAlertas();
    // Refresh every 5 minutes
    const interval = setInterval(() => void fetchAlertas(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAlertas]);

  // ── Close on outside click ────────────────────────────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // ── Close on Escape ───────────────────────────────────────────────────────
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const hasCritical = alertas.some((a) => a.nivel === "critical");

  return (
    <header className="h-16 bg-white border-b border-[var(--color-border)] flex items-center justify-end px-6 gap-3 shrink-0">

      {/* ── Bell button ────────────────────────────────────────────────────── */}
      <div className="relative" ref={panelRef}>
        <button
          onClick={() => setOpen((v) => !v)}
          className={`relative h-9 w-9 rounded-xl flex items-center justify-center transition-colors ${
            open
              ? "bg-[var(--color-muted)] text-[var(--color-mk-black)]"
              : "text-[var(--color-mk-gray)] hover:bg-[var(--color-muted)] hover:text-[var(--color-mk-black)]"
          }`}
          title="Notificações"
          aria-label="Abrir painel de notificações"
        >
          <Bell className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />

          {/* Badge */}
          {!loading && totalCount > 0 && (
            <span
              className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none ${
                hasCritical ? "bg-red-500" : "bg-amber-500"
              }`}
            >
              {totalCount > 9 ? "9+" : totalCount}
            </span>
          )}
        </button>

        {/* ── Dropdown panel ─────────────────────────────────────────────────── */}
        {open && (
          <div className="absolute right-0 top-full mt-2 w-[360px] bg-white rounded-2xl border border-[var(--color-border)] shadow-xl z-50 overflow-hidden">
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-[var(--color-mk-gold)]" />
                <span className="text-sm font-semibold text-[var(--color-mk-black)]">Notificações</span>
                {totalCount > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white ${hasCritical ? "bg-red-500" : "bg-amber-500"}`}>
                    {totalCount}
                  </span>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="h-6 w-6 rounded-lg flex items-center justify-center text-[var(--color-mk-gray)] hover:bg-[var(--color-muted)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Alert list */}
            <div className="max-h-[380px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="h-5 w-5 rounded-full border-2 border-[var(--color-mk-gold)] border-t-transparent animate-spin" />
                </div>
              ) : alertas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                  <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center mb-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </div>
                  <p className="text-sm font-medium text-[var(--color-mk-black)]">Tudo em ordem</p>
                  <p className="text-xs text-[var(--color-mk-gray)] mt-1">Nenhum alerta ativo no momento</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--color-border)]">
                  {alertas.map((alerta, i) => {
                    const Icon = ALERTA_ICON[alerta.tipo];
                    const colors = ALERTA_COLOR[alerta.nivel];
                    const href = alerta.href;

                    return (
                      <Link
                        key={i}
                        href={href}
                        onClick={() => setOpen(false)}
                        className={`flex items-start gap-3 px-4 py-3 hover:bg-[var(--color-muted)]/60 transition-colors group`}
                      >
                        {/* Icon */}
                        <div className={`h-8 w-8 rounded-lg shrink-0 flex items-center justify-center mt-0.5 ${colors.bg} border ${colors.border}`}>
                          <Icon className={`h-4 w-4 ${colors.icon}`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-semibold text-[var(--color-mk-black)] leading-snug">
                              {alerta.titulo}
                            </p>
                            <span className={`h-2 w-2 rounded-full shrink-0 mt-1 ${colors.dot}`} />
                          </div>
                          <p className="text-xs text-[var(--color-mk-gray)] mt-0.5 truncate">
                            {alerta.descricao}
                          </p>
                        </div>

                        <ChevronRight className="h-3.5 w-3.5 text-[var(--color-mk-gray)] shrink-0 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {alertas.length > 0 && (
              <div className="border-t border-[var(--color-border)] px-4 py-2.5 flex items-center justify-between">
                <p className="text-xs text-[var(--color-mk-gray)]">
                  Atualizado agora
                </p>
                <button
                  onClick={() => { void fetchAlertas(); }}
                  className="text-xs text-[var(--color-mk-gold)] hover:text-[var(--color-mk-gold-dark)] font-medium"
                >
                  Atualizar
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── User info ────────────────────────────────────────────────────────── */}
      <div className="text-right">
        <p className="text-sm font-medium text-[var(--color-mk-black)]">{user.nome}</p>
        <p className="text-xs text-[var(--color-mk-gray)]">{user.email}</p>
      </div>

      <div className="h-8 w-8 rounded-full bg-[color-mix(in_srgb,var(--color-mk-gold)_15%,white)] border border-[color-mix(in_srgb,var(--color-mk-gold)_30%,transparent)] flex items-center justify-center shrink-0">
        <span className="text-[var(--color-mk-gold-dark)] font-bold text-sm">
          {user.nome.charAt(0).toUpperCase()}
        </span>
      </div>

      <button
        onClick={handleLogout}
        title="Sair"
        className="flex items-center gap-1.5 text-xs text-[var(--color-mk-gray)] hover:text-[var(--color-mk-black)] transition-colors px-2 py-1.5 rounded-lg hover:bg-[var(--color-muted)] cursor-pointer"
      >
        <LogOut className="h-3.5 w-3.5" />
        Sair
      </button>
    </header>
  );
}
