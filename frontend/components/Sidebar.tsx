"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "./Logo";
import { useAuth } from "@/contexts/AuthContext";
import {
  Home,
  MessageSquare,
  Calendar,
  Users,
  DollarSign,
  BarChart3,
  Settings,
  FileText,
  LogOut,
  Stethoscope,
  ShieldCheck,
  ClipboardList,
  BookOpen,
  X,
  UserPlus,
  FlaskConical,
  Package,
  HeartHandshake,
  ReceiptText,
  Activity,
  TrendingUp,
  PenLine,
  ChevronDown,
} from "lucide-react";
import type { UserRole } from "@/lib/types";

interface MenuItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles?: UserRole[];
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    label: "",
    items: [
      { href: "/dashboard", label: "Inicio", icon: Home },
    ],
  },
  {
    label: "Atendimento",
    items: [
      { href: "/agenda",       label: "Agenda",          icon: Calendar,      roles: ["ADMIN", "DOCTOR", "RECEPTIONIST"] },
      { href: "/prontuarios",  label: "Prontuarios",     icon: FileText,      roles: ["ADMIN", "DOCTOR"] },
      { href: "/exames",       label: "Exames e Proced.", icon: FlaskConical, roles: ["ADMIN", "DOCTOR", "RECEPTIONIST"] },
      { href: "/assinaturas",  label: "Assin. Digital",  icon: PenLine,       roles: ["ADMIN", "DOCTOR"] },
      { href: "/chats",        label: "Chats",           icon: MessageSquare, roles: ["ADMIN", "DOCTOR", "RECEPTIONIST"] },
    ],
  },
  {
    label: "Pacientes",
    items: [
      { href: "/pacientes",  label: "Cadastro",          icon: Users,          roles: ["ADMIN", "DOCTOR", "RECEPTIONIST"] },
      { href: "/leads",       label: "Leads",             icon: UserPlus,       roles: ["ADMIN", "RECEPTIONIST"] },
      { href: "/programas",   label: "Prog. Preventivos", icon: Activity,       roles: ["ADMIN", "DOCTOR", "RECEPTIONIST"] },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { href: "/financeiro",  label: "Fluxo de Caixa",    icon: DollarSign,    roles: ["ADMIN", "RECEPTIONIST"] },
      { href: "/faturamento", label: "Faturamento TISS",  icon: ReceiptText,   roles: ["ADMIN", "RECEPTIONIST"] },
      { href: "/convenios",   label: "Convenios",         icon: HeartHandshake, roles: ["ADMIN", "RECEPTIONIST"] },
      { href: "/analytics",   label: "Analytics",         icon: TrendingUp,    roles: ["ADMIN"] },
    ],
  },
  {
    label: "Administracao",
    items: [
      { href: "/medicos",       label: "Medicos",        icon: Stethoscope,   roles: ["ADMIN", "DOCTOR", "RECEPTIONIST"] },
      { href: "/estoque",       label: "Estoque",        icon: Package,       roles: ["ADMIN", "RECEPTIONIST"] },
      { href: "/configuracoes", label: "Configuracoes",  icon: Settings,      roles: ["ADMIN"] },
      { href: "/admin/usuarios",   label: "Usuarios",    icon: ShieldCheck,   roles: ["ADMIN"] },
      { href: "/admin/audit-logs", label: "Logs",        icon: ClipboardList, roles: ["ADMIN"] },
      { href: "/relatorios",    label: "Relatorios",     icon: BarChart3,     roles: ["ADMIN"] },
    ],
  },
  {
    label: "",
    items: [
      { href: "/manual", label: "Manual", icon: BookOpen },
    ],
  },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { logout, user, hasRole } = useAuth();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function toggleGroup(label: string) {
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  function isGroupActive(group: MenuGroup): boolean {
    return group.items.some((item) => pathname.startsWith(item.href));
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-surface-border flex flex-col
          transform transition-transform duration-300 ease-in-out
          lg:relative lg:translate-x-0 lg:z-auto lg:flex lg:shrink-0
          ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <div className="p-5 border-b border-surface-border flex items-center justify-between">
          <Logo size="md" />
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 text-slate-500 hover:text-slate-600 hover:bg-cream-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-3 overflow-y-auto">
          {menuGroups.map((group, gi) => {
            const visibleItems = group.items.filter(
              (item) => !item.roles || hasRole(...item.roles)
            );
            if (visibleItems.length === 0) return null;

            const hasLabel = !!group.label;
            const isCollapsed = hasLabel && collapsed[group.label] && !isGroupActive(group);

            return (
              <div key={gi} className={hasLabel ? "mt-4 first:mt-0" : ""}>
                {hasLabel && (
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className="w-full flex items-center justify-between px-3 py-1.5 mb-1 group"
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 group-hover:text-slate-600 transition-colors">
                      {group.label}
                    </span>
                    <ChevronDown
                      size={12}
                      className={`text-slate-300 group-hover:text-slate-500 transition-transform duration-200 ${
                        isCollapsed ? "-rotate-90" : ""
                      }`}
                    />
                  </button>
                )}

                {!isCollapsed &&
                  visibleItems.map((item) => {
                    const Icon = item.icon;
                    const active = pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm ${
                          active
                            ? "bg-primary-50 text-primary-700 font-medium border-l-3 border-primary-600"
                            : "text-slate-600 hover:bg-cream-100 hover:text-slate-800"
                        }`}
                      >
                        <Icon size={17} className={active ? "text-primary-600" : "text-slate-500"} />
                        {item.label}
                      </Link>
                    );
                  })}
              </div>
            );
          })}
        </nav>

        <div className="px-3 py-3 border-t border-surface-border bg-cream-50">
          {user && (
            <div className="mb-2 px-3">
              <p className="text-xs font-medium text-slate-700 truncate">{user.name}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">{user.role}</p>
            </div>
          )}
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={15} />
            Sair do sistema
          </button>
          <p className="text-[10px] text-slate-500 text-center mt-2">
            {process.env.NEXT_PUBLIC_CLINIC_NAME || "+SaudeBR"} v1.0.0
          </p>
        </div>
      </aside>
    </>
  );
}
