// components/Header.tsx
// Nome e role do usuário vêm do AuthContext (não mais hardcoded)

"use client";

import { Bell, Search, ChevronDown, LogOut } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

// Traduz o role em inglês para português
const roleLabels: Record<string, string> = {
  ADMIN: "Administrador",
  DOCTOR: "Médico",
  RECEPTIONIST: "Recepcionista",
  PATIENT: "Paciente",
};

// Gera as iniciais do nome para o avatar (ex: "Carlos Silva" → "CS")
function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function Header() {
  const { user, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);

  return (
    <header className="h-16 bg-white border-b border-surface-border px-6 flex items-center justify-between">
      {/* Busca */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Buscar paciente, consulta..."
            className="w-full pl-10 pr-4 py-2 bg-cream-50 border border-cream-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Ações à direita */}
      <div className="flex items-center gap-4">
        {/* Notificações */}
        <button className="relative p-2 hover:bg-cream-100 rounded-lg">
          <Bell size={20} className="text-slate-600" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-semantic-danger rounded-full" />
        </button>

        {/* Menu do usuário */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-3 cursor-pointer hover:bg-cream-100 px-3 py-1.5 rounded-lg"
          >
            {/* Avatar com iniciais */}
            <div className="w-9 h-9 bg-primary-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
              {user ? getInitials(user.name) : "?"}
            </div>

            {/* Nome e role */}
            <div className="text-sm text-left">
              <div className="font-semibold text-slate-800">
                {user?.name ?? "Usuário"}
              </div>
              <div className="text-xs text-slate-500">
                {user ? (roleLabels[user.role] ?? user.role) : ""}
              </div>
            </div>

            <ChevronDown size={16} className="text-slate-400" />
          </button>

          {/* Dropdown de logout */}
          {showMenu && (
            <>
              {/* Overlay invisível para fechar ao clicar fora */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />

              <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={16} />
                  Sair do sistema
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}