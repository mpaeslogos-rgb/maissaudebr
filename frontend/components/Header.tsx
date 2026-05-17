"use client";

import { Bell, Search, ChevronDown, LogOut, Menu } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getPatients } from "@/lib/api";
import type { Patient } from "@/lib/types";

const roleLabels: Record<string, string> = {
  ADMIN: "Administrador",
  DOCTOR: "Médico",
  RECEPTIONIST: "Recepcionista",
  PATIENT: "Paciente",
};

function getInitials(name: string): string {
  return name.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
}

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [showDrop, setShowDrop] = useState(false);

  useEffect(() => {
    if (search.trim().length < 2) {
      setResults([]);
      setShowDrop(false);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await getPatients({ search: search.trim(), limit: 6 });
        setResults(res.data);
        setShowDrop(res.data.length > 0);
      } catch {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  function handleSelect() {
    setSearch("");
    setShowDrop(false);
    setShowMobileSearch(false);
    router.push("/pacientes");
  }

  return (
    <header className="relative h-16 bg-white border-b border-surface-border px-4 md:px-6 flex items-center gap-3 shrink-0">
      {/* Hamburger — só mobile */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 hover:bg-cream-100 rounded-lg text-slate-600"
        aria-label="Abrir menu"
      >
        <Menu size={20} />
      </button>

      {/* Busca — desktop sempre visível, mobile expandível */}
      <div className="hidden md:flex flex-1 max-w-md relative">
        <div className="relative w-full">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => results.length > 0 && setShowDrop(true)}
            placeholder="Buscar paciente, consulta..."
            className="w-full pl-10 pr-4 py-2 bg-cream-50 border border-cream-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
          />
        </div>

        {showDrop && results.length > 0 && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => { setShowDrop(false); setSearch(""); }} />
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-cream-200 rounded-xl shadow-lg z-20 overflow-hidden">
              {results.map(p => (
                <button
                  key={p.id}
                  onClick={handleSelect}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-cream-50 text-left border-b border-cream-50 last:border-0"
                >
                  <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center shrink-0">
                    {p.fullName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800 truncate">{p.fullName}</div>
                    <div className="text-xs text-slate-400">{p.cpf}{p.phone ? ` · ${p.phone}` : ""}</div>
                  </div>
                </button>
              ))}
              <button
                onClick={handleSelect}
                className="w-full text-center text-xs text-primary-600 font-medium py-2.5 hover:bg-cream-50"
              >
                Ver todos os resultados em Pacientes →
              </button>
            </div>
          </>
        )}
      </div>

      {/* Botão de busca no mobile */}
      <button
        className="md:hidden p-2 hover:bg-cream-100 rounded-lg text-slate-600"
        onClick={() => setShowMobileSearch(v => !v)}
        aria-label="Buscar"
      >
        <Search size={20} />
      </button>

      {/* Spacer para empurrar ações para a direita no mobile */}
      <div className="flex-1 md:hidden" />

      {/* Ações à direita */}
      <div className="flex items-center gap-1 md:gap-3">
        <button className="relative p-2 hover:bg-cream-100 rounded-lg">
          <Bell size={20} className="text-slate-600" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-semantic-danger rounded-full" />
        </button>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 cursor-pointer hover:bg-cream-100 px-2 md:px-3 py-1.5 rounded-lg"
          >
            <div className="w-8 h-8 md:w-9 md:h-9 bg-primary-600 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0">
              {user ? getInitials(user.name) : "?"}
            </div>
            <div className="hidden md:block text-sm text-left">
              <div className="font-semibold text-slate-800">{user?.name ?? "Usuário"}</div>
              <div className="text-xs text-slate-500">{user ? (roleLabels[user.role] ?? user.role) : ""}</div>
            </div>
            <ChevronDown size={16} className="hidden md:block text-slate-400" />
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1">
                <button
                  onClick={() => { setShowMenu(false); logout(); }}
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

      {/* Barra de busca mobile expandida — dropdown abaixo do header */}
      {showMobileSearch && (
        <div className="md:hidden fixed top-16 left-0 right-0 bg-white border-b border-surface-border px-4 py-3 z-30 shadow-md">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => results.length > 0 && setShowDrop(true)}
              placeholder="Buscar paciente..."
              className="w-full pl-9 pr-4 py-2 bg-cream-50 border border-cream-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              autoFocus
            />
          </div>

          {showDrop && results.length > 0 && (
            <div className="mt-2 bg-white border border-cream-200 rounded-xl shadow-lg overflow-hidden">
              {results.map(p => (
                <button
                  key={p.id}
                  onClick={handleSelect}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-cream-50 text-left border-b border-cream-50 last:border-0"
                >
                  <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center shrink-0">
                    {p.fullName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800 truncate">{p.fullName}</div>
                    <div className="text-xs text-slate-400">{p.cpf}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
