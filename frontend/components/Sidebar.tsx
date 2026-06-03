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
  BookOpen,
  X,
  UserPlus,
  FlaskConical,
  Package,
  HeartHandshake,
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
  { href: "/leads",         label: "Leads",          icon: UserPlus,       roles: ['ADMIN', 'RECEPTIONIST'] },
  { href: "/medicos",       label: "Médicos",        icon: Stethoscope,    roles: ['ADMIN', 'DOCTOR', 'RECEPTIONIST'] },
  { href: "/prontuarios",   label: "Prontuários",    icon: FileText,       roles: ['ADMIN', 'DOCTOR'] },
  { href: "/exames",        label: "Exames",         icon: FlaskConical,   roles: ['ADMIN', 'DOCTOR', 'RECEPTIONIST'] },
  { href: "/estoque",       label: "Estoque",        icon: Package,        roles: ['ADMIN', 'RECEPTIONIST'] },
  { href: "/convenios",     label: "Convênios",      icon: HeartHandshake, roles: ['ADMIN', 'RECEPTIONIST'] },
  { href: "/financeiro",    label: "Financeiro",     icon: DollarSign,     roles: ['ADMIN', 'RECEPTIONIST'] },
  { href: "/relatorios",    label: "Relatórios",     icon: BarChart3,      roles: ['ADMIN'] },
  { href: "/configuracoes", label: "Configurações",  icon: Settings,       roles: ['ADMIN'] },
  { href: "/admin/usuarios",    label: "Usuários",    icon: ShieldCheck,    roles: ['ADMIN'] },
  { href: "/admin/audit-logs", label: "Logs",         icon: ClipboardList,  roles: ['ADMIN'] },
  { href: "/manual",           label: "Manual",        icon: BookOpen },
];

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { logout, user, hasRole } = useAuth();

  const visible = menu.filter(item =>
    !item.roles || hasRole(...item.roles)
  )

  return (
    <>
      {/* Overlay escuro no mobile quando sidebar aberta */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-surface-border flex flex-col
        transform transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0 lg:z-auto lg:flex lg:shrink-0
        ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo + botão fechar no mobile */}
        <div className="p-5 border-b border-surface-border flex items-center justify-between">
          <Logo size="md" />
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 text-slate-400 hover:text-slate-600 hover:bg-cream-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navegação */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {visible.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
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
          <p className="text-xs text-slate-400 text-center">
            {process.env.NEXT_PUBLIC_CLINIC_NAME || "+SaúdeBR"} v1.0.0
          </p>
        </div>
      </aside>
    </>
  );
}
