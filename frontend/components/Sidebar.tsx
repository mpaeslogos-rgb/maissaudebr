"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";
import type { UserRole } from "@/lib/types";

interface MenuItem {
  href: string
  label: string
  icon: React.ElementType
  roles?: UserRole[]
}

const menu: MenuItem[] = [
  { href: "/dashboard",     label: "Início",         icon: Home },
  { href: "/chats",         label: "Chats",          icon: MessageSquare,  roles: ['ADMIN', 'DOCTOR', 'RECEPTIONIST'] },
  { href: "/agenda",        label: "Agenda",         icon: Calendar,       roles: ['ADMIN', 'DOCTOR', 'RECEPTIONIST'] },
  { href: "/pacientes",     label: "Pacientes",      icon: Users,          roles: ['ADMIN', 'DOCTOR', 'RECEPTIONIST'] },
  { href: "/medicos",       label: "Médicos",        icon: Stethoscope,    roles: ['ADMIN', 'DOCTOR', 'RECEPTIONIST'] },
  { href: "/prontuarios",   label: "Prontuários",    icon: FileText,       roles: ['ADMIN', 'DOCTOR'] },
  { href: "/financeiro",    label: "Financeiro",     icon: DollarSign,     roles: ['ADMIN', 'RECEPTIONIST'] },
  { href: "/relatorios",    label: "Relatórios",     icon: BarChart3,      roles: ['ADMIN'] },
  { href: "/configuracoes", label: "Configurações",  icon: Settings,       roles: ['ADMIN'] },
  { href: "/admin/usuarios",    label: "Usuários",    icon: ShieldCheck,    roles: ['ADMIN'] },
  { href: "/admin/audit-logs", label: "Logs",         icon: ClipboardList,  roles: ['ADMIN'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { logout, user, hasRole } = useAuth();

  const visible = menu.filter(item =>
    !item.roles || hasRole(...item.roles)
  )

  return (
    <aside className="w-64 bg-white border-r border-surface-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-surface-border">
        <Logo size="md" />
      </div>

      {/* Navegação */}
      <nav className="flex-1 p-4 space-y-1">
        {visible.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                active
                  ? "bg-primary-50 text-primary-700 font-medium border-l-4 border-primary-600"
                  : "text-slate-600 hover:bg-cream-100"
              }`}
            >
              <Icon size={18} />
              <span className="text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Rodapé com usuário e logout */}
      <div className="p-4 border-t border-surface-border bg-cream-50">
        {user && (
          <div className="mb-3 px-3">
            <p className="text-xs font-medium text-slate-700 truncate">{user.name}</p>
            <p className="text-xs text-slate-400">{user.role}</p>
          </div>
        )}
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors mb-2"
        >
          <LogOut size={16} />
          Sair do sistema
        </button>
        <p className="text-xs text-slate-400 text-center">+SaúdeBR v1.0.0</p>
      </div>
    </aside>
  );
}
