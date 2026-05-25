"use client";

import type React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Settings,
  TrendingUp,
  AlertCircle,
  Target,
  FileUp,
  Users,
  ShoppingCart,
  Package,
  PenLine,
  BadgeDollarSign,
  ClipboardList,
  UserCircle2,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, type Role } from "@/lib/auth/rbac";

const ROLE_RANK: Record<Role, number> = {
  admin_grupo: 3,
  gestor: 2,
  visualizador: 1,
};

type NavLink = {
  kind: "link";
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  minRole: Role;
  disabled?: boolean;
};

type NavSection = {
  kind: "section";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  minRole: Role;
  items: NavLink[];
};

type NavEntry = NavLink | NavSection;

const NAV: NavEntry[] = [
  {
    kind: "link",
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    minRole: "visualizador",
  },
  {
    kind: "link",
    href: "/minha-area",
    label: "Minha Área",
    icon: UserCircle2,
    minRole: "visualizador",
  },
  {
    kind: "link",
    href: "/empresas",
    label: "Empresas",
    icon: Building2,
    minRole: "visualizador",
  },
  // ── Vendas ───────────────────────────────────────────────────────────────
  {
    kind: "section",
    label: "Vendas",
    icon: ShoppingCart,
    minRole: "visualizador",
    items: [
      {
        kind: "link",
        href: "/importacoes",
        label: "Importar",
        icon: FileUp,
        minRole: "gestor",
      },
      {
        kind: "link",
        href: "/vendas/nova",
        label: "Nova Venda",
        icon: PenLine,
        minRole: "gestor",
      },
      {
        kind: "link",
        href: "/vendas/clientes",
        label: "Clientes",
        icon: Users,
        minRole: "visualizador",
      },
      {
        kind: "link",
        href: "/vendas/produtos",
        label: "Produtos",
        icon: Package,
        minRole: "visualizador",
      },
      {
        kind: "link",
        href: "/vendas/comissoes",
        label: "Comissões",
        icon: BadgeDollarSign,
        minRole: "visualizador",
      },
    ],
  },
  // ── Financeiro ───────────────────────────────────────────────────────────
  {
    kind: "link",
    href: "/metas",
    label: "Metas",
    icon: Target,
    minRole: "visualizador",
  },
  {
    kind: "link",
    href: "/faturamento",
    label: "Faturamento",
    icon: TrendingUp,
    minRole: "visualizador",
  },
  {
    kind: "link",
    href: "/relatorios",
    label: "Relatórios",
    icon: ClipboardList,
    minRole: "visualizador",
  },
  {
    kind: "link",
    href: "/inadimplencia",
    label: "Inadimplência",
    icon: AlertCircle,
    minRole: "visualizador",
  },
  // ── Admin ────────────────────────────────────────────────────────────────
  {
    kind: "link",
    href: "/usuarios",
    label: "Usuários",
    icon: Users,
    minRole: "admin_grupo",
  },
  {
    kind: "link",
    href: "/auditoria",
    label: "Auditoria",
    icon: ShieldCheck,
    minRole: "admin_grupo",
  },
  {
    kind: "link",
    href: "/configuracoes",
    label: "Configurações",
    icon: Settings,
    minRole: "admin_grupo",
  },
];

function NavLinkItem({ item, pathname, indent = false }: { item: NavLink; pathname: string; indent?: boolean }) {
  const Icon = item.icon;
  const isActive =
    pathname === item.href ||
    (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));

  if (item.disabled) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-[var(--color-mk-gray)] opacity-50 cursor-not-allowed",
          indent && "pl-8"
        )}
        title="Em breve"
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span>{item.label}</span>
        <span className="ml-auto text-[10px] bg-[var(--color-muted)] text-[var(--color-mk-gray)] px-1.5 py-0.5 rounded">
          Em breve
        </span>
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
        indent && "pl-8",
        isActive
          ? "bg-[color-mix(in_srgb,var(--color-mk-gold)_12%,transparent)] text-[var(--color-mk-gold-dark)]"
          : "text-[var(--color-mk-gray-dark)] hover:bg-[var(--color-muted)] hover:text-[var(--color-mk-black)]"
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", isActive && "text-[var(--color-mk-gold)]")} />
      <span>{item.label}</span>
    </Link>
  );
}

export default function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const userRank = ROLE_RANK[role] ?? 1;

  // Is any child of a section active?
  function sectionActive(section: NavSection) {
    return section.items.some(
      (item) =>
        pathname === item.href ||
        (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"))
    );
  }

  return (
    <aside className="w-60 bg-white border-r border-[var(--color-border)] flex flex-col shrink-0">
      {/* Brand header */}
      <div className="h-16 flex items-center px-5 border-b border-[var(--color-border)] gap-3">
        <div className="h-8 w-8 rounded-lg bg-[var(--color-mk-gold)] flex items-center justify-center shrink-0 shadow-sm">
          <span className="text-white font-bold text-sm">M</span>
        </div>
        <div className="min-w-0">
          <span className="font-semibold text-[var(--color-mk-black)] text-sm truncate block">
            Grupo Makários
          </span>
          <span className="text-xs text-[var(--color-mk-gray)] truncate block">
            Gestão Comercial
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV.filter((entry) => userRank >= ROLE_RANK[entry.minRole]).map((entry) => {
          if (entry.kind === "link") {
            return <NavLinkItem key={entry.href} item={entry} pathname={pathname} />;
          }

          // Section
          const visibleItems = entry.items.filter((i) => userRank >= ROLE_RANK[i.minRole]);
          if (visibleItems.length === 0) return null;
          const active = sectionActive(entry);
          const SectionIcon = entry.icon;

          return (
            <div key={entry.label}>
              {/* Section header — not clickable, just a label */}
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium select-none",
                  active
                    ? "text-[var(--color-mk-gold-dark)]"
                    : "text-[var(--color-mk-gray-dark)]"
                )}
              >
                <SectionIcon
                  className={cn("h-4 w-4 shrink-0", active && "text-[var(--color-mk-gold)]")}
                />
                <span>{entry.label}</span>
              </div>
              {/* Section children */}
              <div className="space-y-0.5">
                {visibleItems.map((item) => (
                  <NavLinkItem key={item.href} item={item} pathname={pathname} indent />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Role badge */}
      <div className="p-4 border-t border-[var(--color-border)]">
        <p className="text-xs text-[var(--color-mk-gray)]">{ROLE_LABELS[role]}</p>
      </div>
    </aside>
  );
}
