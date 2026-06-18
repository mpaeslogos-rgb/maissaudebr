"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Users, Calendar, FileText, FlaskConical, DollarSign,
  Stethoscope, Settings, BarChart3, Package, HeartHandshake,
  ReceiptText, Activity, PenLine, BookOpen, TrendingUp, UserPlus,
  Command, ArrowRight, Loader2,
} from "lucide-react";
import { getPatients } from "@/lib/api";
import type { Patient } from "@/lib/types";

interface Action {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  href?: string;
  category: "pagina" | "paciente" | "acao";
}

const PAGE_ACTIONS: Action[] = [
  { id: "dashboard",    label: "Inicio",             icon: Command,        href: "/dashboard",     category: "pagina" },
  { id: "agenda",       label: "Agenda",             icon: Calendar,       href: "/agenda",        category: "pagina" },
  { id: "pacientes",    label: "Pacientes",          icon: Users,          href: "/pacientes",     category: "pagina" },
  { id: "prontuarios",  label: "Prontuarios",        icon: FileText,       href: "/prontuarios",   category: "pagina" },
  { id: "exames",       label: "Exames e Proced.",   icon: FlaskConical,   href: "/exames",        category: "pagina" },
  { id: "financeiro",   label: "Financeiro",         icon: DollarSign,     href: "/financeiro",    category: "pagina" },
  { id: "medicos",      label: "Medicos",            icon: Stethoscope,    href: "/medicos",       category: "pagina" },
  { id: "faturamento",  label: "Faturamento TISS",   icon: ReceiptText,    href: "/faturamento",   category: "pagina" },
  { id: "convenios",    label: "Convenios",          icon: HeartHandshake, href: "/convenios",     category: "pagina" },
  { id: "estoque",      label: "Estoque",            icon: Package,        href: "/estoque",       category: "pagina" },
  { id: "assinaturas",  label: "Assinatura Digital",  icon: PenLine,       href: "/assinaturas",   category: "pagina" },
  { id: "programas",    label: "Prog. Preventivos",  icon: Activity,       href: "/programas",     category: "pagina" },
  { id: "analytics",    label: "Analytics",          icon: TrendingUp,     href: "/analytics",     category: "pagina" },
  { id: "relatorios",   label: "Relatorios",         icon: BarChart3,      href: "/relatorios",    category: "pagina" },
  { id: "leads",        label: "Leads",              icon: UserPlus,       href: "/leads",         category: "pagina" },
  { id: "config",       label: "Configuracoes",      icon: Settings,       href: "/configuracoes", category: "pagina" },
  { id: "manual",       label: "Manual",             icon: BookOpen,       href: "/manual",        category: "pagina" },
];

const CATEGORY_LABELS: Record<string, string> = {
  paciente: "Pacientes",
  pagina: "Paginas",
  acao: "Acoes",
};

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setPatients([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const searchPatients = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setPatients([]); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await getPatients({ search: q, limit: 5 });
        setPatients(res.data);
      } catch {}
      finally { setSearching(false); }
    }, 300);
  }, []);

  function handleQueryChange(q: string) {
    setQuery(q);
    setSelected(0);
    searchPatients(q);
  }

  const q = query.toLowerCase().trim();

  const patientActions: Action[] = patients.map((p) => ({
    id: `patient-${p.id}`,
    label: p.fullName,
    description: p.cpf || p.phone,
    icon: Users,
    href: `/pacientes/${p.id}`,
    category: "paciente" as const,
  }));

  const pageResults = q
    ? PAGE_ACTIONS.filter(
        (a) => a.label.toLowerCase().includes(q) || a.id.includes(q)
      )
    : PAGE_ACTIONS.slice(0, 6);

  const allResults = [...patientActions, ...pageResults];

  function handleSelect(action: Action) {
    if (action.href) router.push(action.href);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((v) => Math.min(v + 1, allResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((v) => Math.max(v - 1, 0));
    } else if (e.key === "Enter" && allResults[selected]) {
      e.preventDefault();
      handleSelect(allResults[selected]);
    }
  }

  if (!open) return null;

  const grouped = allResults.reduce<Record<string, Action[]>>((acc, a) => {
    (acc[a.category] ??= []).push(a);
    return acc;
  }, {});

  let globalIndex = -1;

  return (
    <div className="fixed inset-0 z-[110] flex items-start justify-center pt-[15vh] bg-black/50 px-4" onClick={() => setOpen(false)}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar paciente, pagina ou acao..."
            className="flex-1 text-sm outline-none bg-transparent placeholder:text-slate-400"
          />
          {searching && <Loader2 size={16} className="animate-spin text-slate-400" />}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-100 rounded border border-slate-200">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto py-2">
          {allResults.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">
              {q ? "Nenhum resultado encontrado." : "Comece a digitar..."}
            </p>
          ) : (
            Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {CATEGORY_LABELS[cat] ?? cat}
                </p>
                {items.map((action) => {
                  globalIndex++;
                  const idx = globalIndex;
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      onClick={() => handleSelect(action)}
                      onMouseEnter={() => setSelected(idx)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        selected === idx
                          ? "bg-primary-50 text-primary-700"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <Icon size={16} className={selected === idx ? "text-primary-600" : "text-slate-400"} />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">{action.label}</span>
                        {action.description && (
                          <span className="text-xs text-slate-500 ml-2">{action.description}</span>
                        )}
                      </div>
                      <ArrowRight size={14} className="text-slate-300 shrink-0" />
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="px-4 py-2 border-t border-slate-100 flex items-center gap-4 text-[10px] text-slate-400">
          <span><kbd className="font-mono bg-slate-100 px-1 rounded">↑↓</kbd> navegar</span>
          <span><kbd className="font-mono bg-slate-100 px-1 rounded">Enter</kbd> selecionar</span>
          <span><kbd className="font-mono bg-slate-100 px-1 rounded">Esc</kbd> fechar</span>
        </div>
      </div>
    </div>
  );
}
