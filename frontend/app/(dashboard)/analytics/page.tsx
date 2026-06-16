"use client";

import { useEffect, useState, useCallback } from "react";
import { apiGet } from "@/lib/api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { TrendingUp, TrendingDown, Users, DollarSign, Star, Activity, Target, AlertTriangle, CheckCircle } from "lucide-react";

const fmt  = (v: number) => v?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) ?? "—";
const pct  = (v: number | null) => v != null ? `${v}%` : "—";
const num  = (v: number) => v?.toLocaleString("pt-BR") ?? "—";

type Period = "month" | "quarter" | "year" | "custom";

interface UnitEconomics {
  periodo: { from: string; to: string };
  dre: {
    receitaBruta: number;
    deducoes: { glosas: number; estornos: number };
    receitaLiquida: number;
    csp: { total: number; repasses: number; materiais: number; examesTerceiros: number };
    resultadoBruto: number;
    margemBruta: number;
    despesasOperacionais: { total: number; porCategoria: Record<string, number> };
    ebitda: number;
    margemEbitda: number;
    resultadoLiquido: number;
    margemLiquida: number;
  };
  mix: { particular: number; convenio: number; assinatura: number; exames: number; tiss: number };
  unitEconomics: {
    totalPacientesAtivos: number;
    receitaPorPaciente: number;
    custoPorPaciente: number;
    margemPorPaciente: number;
    retencao30d: number | null;
    retencao60d: number | null;
    retencao90d: number | null;
    churnMensal: number | null;
    ticketMedioConsulta: number;
    totalConsultas: number;
    noShows: number;
    pacientesPorProfissional: number | null;
  };
  assinaturas: {
    mrr: number;
    totalAtivas: number;
    programas: {
      programId: string;
      nome: string;
      matriculasAtivas: number;
      mrr: number;
      receitaPeriodo: number;
      receitaPorPaciente: number;
    }[];
  };
  pilotos: {
    elegiveisCount: number;
    semProgramaCount: number;
    taxaConversaoElegiveis: number | null;
    adesaoCheckInsPct: number | null;
    checkInsTotal: number;
    checkInsConcluidos: number;
    completudeDadosPct: number | null;
    totalPacientesCadastrados: number;
    pacientesComFichaCompleta: number;
  };
  nps: { score: number | null; total: number };
}

const PIE_COLORS = ["#2D7D5A", "#5A9670", "#7FAE8C", "#A5C6AF", "#C9DDD0"];

function periodRange(period: Period, customFrom: string, customTo: string) {
  const now = new Date();
  if (period === "custom") return { from: customFrom, to: customTo };
  if (period === "month") {
    const f = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: f.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
  }
  if (period === "quarter") {
    const f = new Date(now); f.setMonth(f.getMonth() - 3);
    return { from: f.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
  }
  const f = new Date(now); f.setFullYear(f.getFullYear() - 1);
  return { from: f.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
}

function KpiCard({ label, value, sub, icon: Icon, trend, color }: {
  label: string; value: string; sub?: string; icon: React.ElementType;
  trend?: "up" | "down" | null; color?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`${color ?? "bg-primary-50"} p-2 rounded-lg`}>
          <Icon size={20} className={color ? "text-white" : "text-primary-600"} />
        </div>
      </div>
      {trend && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend === "up" ? "text-green-600" : "text-red-500"}`}>
          {trend === "up" ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {trend === "up" ? "Positivo" : "Atenção"}
        </div>
      )}
    </div>
  );
}

function DRERow({ label, value, indent = 0, bold = false, positive }: { label: string; value: number | null; indent?: number; bold?: boolean; positive?: boolean }) {
  const isNeg = value != null && value < 0;
  return (
    <tr className={`${bold ? "bg-gray-50" : ""} border-b border-gray-100`}>
      <td className={`py-2 text-sm text-gray-700 ${bold ? "font-semibold" : ""}`} style={{ paddingLeft: `${16 + indent * 20}px` }}>{label}</td>
      <td className={`py-2 text-sm text-right pr-4 ${bold ? "font-semibold" : ""} ${isNeg ? "text-red-600" : (positive === false ? "text-red-500" : "text-gray-900")}`}>
        {value != null ? fmt(value) : "—"}
      </td>
    </tr>
  );
}

export default function AnalyticsPage() {
  const [data, setData]             = useState<UnitEconomics | null>(null);
  const [loading, setLoading]       = useState(true);
  const [period, setPeriod]         = useState<Period>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo]     = useState("");
  const [activeTab, setActiveTab]   = useState<"kpis" | "dre" | "mix" | "piloto">("kpis");

  const load = useCallback(async () => {
    setLoading(true);
    const { from, to } = periodRange(period, customFrom, customTo);
    const d = await apiGet<UnitEconomics>(`/analytics/unit-economics?from=${from}&to=${to}`);
    setData(d);
    setLoading(false);
  }, [period, customFrom, customTo]);

  useEffect(() => { load(); }, [load]);

  const mixData = data ? [
    { name: "Particular",   value: data.mix.particular },
    { name: "Convênio",     value: data.mix.convenio },
    { name: "Assinatura",   value: data.mix.assinatura },
    { name: "Exames",       value: data.mix.exames },
    { name: "TISS",         value: data.mix.tiss },
  ].filter(d => d.value > 0) : [];

  const catData = data
    ? Object.entries(data.dre.despesasOperacionais.porCategoria)
        .map(([cat, val]) => ({ cat, val }))
        .sort((a, b) => b.val - a.val)
        .slice(0, 8)
    : [];

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics — Unit Economics</h1>
          <p className="text-sm text-gray-500 mt-1">DRE e KPIs do modelo preventivo +SaúdeBR</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {(["month", "quarter", "year", "custom"] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs rounded-lg border ${period === p ? "bg-primary-600 text-white border-primary-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
              {p === "month" ? "Este mês" : p === "quarter" ? "3 meses" : p === "year" ? "12 meses" : "Período"}
            </button>
          ))}
          {period === "custom" && (
            <>
              <input type="date" className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
              <input type="date" className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs" value={customTo}   onChange={e => setCustomTo(e.target.value)} />
              <button onClick={load} className="px-3 py-1.5 text-xs bg-primary-600 text-white rounded-lg">Buscar</button>
            </>
          )}
        </div>
      </div>

      {loading && <div className="text-center py-20 text-gray-400">Calculando...</div>}

      {!loading && data && (
        <>
          {/* KPI strip principal */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <KpiCard label="Receita Líquida"     value={fmt(data.dre.receitaLiquida)}     icon={DollarSign}  trend={data.dre.receitaLiquida > 0 ? "up" : "down"} />
            <KpiCard label="Margem Bruta"         value={pct(data.dre.margemBruta)}        icon={TrendingUp}  trend={data.dre.margemBruta > 30 ? "up" : "down"} />
            <KpiCard label="EBITDA"               value={fmt(data.dre.ebitda)}             icon={Activity}    trend={data.dre.ebitda > 0 ? "up" : "down"} />
            <KpiCard label="NPS"                  value={data.nps.score != null ? `${data.nps.score}` : "—"} sub={`${data.nps.total} respostas`} icon={Star} trend={data.nps.score != null ? (data.nps.score >= 50 ? "up" : "down") : null} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <KpiCard label="Pacientes Ativos"     value={num(data.unitEconomics.totalPacientesAtivos)} icon={Users} />
            <KpiCard label="Receita/Paciente"     value={fmt(data.unitEconomics.receitaPorPaciente)}   icon={DollarSign} />
            <KpiCard label="Retenção 90 dias"     value={pct(data.unitEconomics.retencao90d)}          icon={TrendingUp}  trend={data.unitEconomics.retencao90d != null ? (data.unitEconomics.retencao90d >= 60 ? "up" : "down") : null} />
            <KpiCard label="MRR Assinaturas"      value={fmt(data.assinaturas.mrr)}                   sub={`${data.assinaturas.totalAtivas} matrículas ativas`} icon={Activity} />
          </div>

          {/* KPI strip piloto */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <KpiCard label="Elegíveis s/ programa" value={`${data.pilotos.semProgramaCount}/${data.pilotos.elegiveisCount}`} sub="Pacientes c/ risco sem matrícula" icon={Target} trend={data.pilotos.taxaConversaoElegiveis != null ? (data.pilotos.taxaConversaoElegiveis >= 50 ? "up" : "down") : null} />
            <KpiCard label="Conversão elegíveis"   value={pct(data.pilotos.taxaConversaoElegiveis)} sub="Elegíveis com programa ativo" icon={CheckCircle} trend={data.pilotos.taxaConversaoElegiveis != null ? (data.pilotos.taxaConversaoElegiveis >= 50 ? "up" : "down") : null} />
            <KpiCard label="Adesão check-ins"      value={pct(data.pilotos.adesaoCheckInsPct)} sub={`${data.pilotos.checkInsConcluidos}/${data.pilotos.checkInsTotal} concluídos`} icon={CheckCircle} trend={data.pilotos.adesaoCheckInsPct != null ? (data.pilotos.adesaoCheckInsPct >= 70 ? "up" : "down") : null} />
            <KpiCard label="Completude de dados"   value={pct(data.pilotos.completudeDadosPct)} sub={`${data.pilotos.pacientesComFichaCompleta}/${data.pilotos.totalPacientesCadastrados} com ficha completa`} icon={AlertTriangle} trend={data.pilotos.completudeDadosPct != null ? (data.pilotos.completudeDadosPct >= 70 ? "up" : "down") : null} />
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 mb-6">
            {(["kpis", "dre", "mix", "piloto"] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === t ? "border-primary-600 text-primary-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                {t === "kpis" ? "Unit Economics" : t === "dre" ? "DRE" : t === "mix" ? "Mix de Receita" : "KPIs do Piloto"}
              </button>
            ))}
          </div>

          {/* Tab Unit Economics */}
          {activeTab === "kpis" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Custos por paciente */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Custo vs. Receita por Paciente</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={[
                    { name: "Receita/pac.", value: data.unitEconomics.receitaPorPaciente },
                    { name: "Custo/pac.",   value: data.unitEconomics.custoPorPaciente },
                    { name: "Margem/pac.",  value: data.unitEconomics.margemPorPaciente },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="value" fill="#2D7D5A" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Consultas e ocupação */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Atendimentos e Capacidade</h3>
                <div className="space-y-3">
                  {[
                    { label: "Total de consultas",         value: num(data.unitEconomics.totalConsultas) },
                    { label: "No-shows",                   value: num(data.unitEconomics.noShows) },
                    { label: "Ticket médio consulta",      value: fmt(data.unitEconomics.ticketMedioConsulta) },
                    { label: "Pacientes por profissional", value: data.unitEconomics.pacientesPorProfissional != null ? data.unitEconomics.pacientesPorProfissional.toString() : "—" },
                    { label: "Matrículas ativas",          value: num(data.assinaturas.totalAtivas) },
                    { label: "MRR",                        value: fmt(data.assinaturas.mrr) },
                    { label: "Churn mensal",               value: data.unitEconomics.churnMensal != null ? `${data.unitEconomics.churnMensal}%` : "—" },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                      <span className="text-sm text-gray-600">{row.label}</span>
                      <span className="text-sm font-semibold text-gray-900">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Programas — unit economics por programa */}
              {data.assinaturas.programas.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5 md:col-span-2">
                  <h3 className="font-semibold text-gray-900 mb-4">Unit Economics por Programa</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-gray-500 uppercase border-b border-gray-200">
                        <tr>
                          <th className="text-left py-2 pr-4">Programa</th>
                          <th className="text-right py-2 pr-4">Matrículas</th>
                          <th className="text-right py-2 pr-4">MRR</th>
                          <th className="text-right py-2 pr-4">Receita no período</th>
                          <th className="text-right py-2">Receita/Paciente</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.assinaturas.programas.map(p => (
                          <tr key={p.programId} className="hover:bg-gray-50">
                            <td className="py-2 pr-4 font-medium text-gray-900">{p.nome}</td>
                            <td className="py-2 pr-4 text-right text-gray-700">{p.matriculasAtivas}</td>
                            <td className="py-2 pr-4 text-right text-gray-700">{fmt(p.mrr)}</td>
                            <td className="py-2 pr-4 text-right text-gray-700">{fmt(p.receitaPeriodo)}</td>
                            <td className="py-2 text-right font-semibold text-primary-700">{fmt(p.receitaPorPaciente)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Despesas por categoria */}
              {catData.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5 md:col-span-2">
                  <h3 className="font-semibold text-gray-900 mb-4">Top Despesas Operacionais</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={catData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="cat" width={120} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => fmt(v)} />
                      <Bar dataKey="val" fill="#5A9670" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Tab DRE */}
          {activeTab === "dre" && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">DRE — Demonstração do Resultado</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(data.periodo.from).toLocaleDateString("pt-BR")} a {new Date(data.periodo.to).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <table className="w-full">
                <tbody>
                  <DRERow label="RECEITA BRUTA DE SERVIÇOS"    value={data.dre.receitaBruta}       bold />
                  <DRERow label="Glosas de convênio"            value={-data.dre.deducoes.glosas}   indent={1} positive={false} />
                  <DRERow label="Devoluções / Estornos"         value={-data.dre.deducoes.estornos} indent={1} positive={false} />
                  <DRERow label="RECEITA LÍQUIDA"               value={data.dre.receitaLiquida}     bold />
                  <DRERow label="CUSTO DOS SERVIÇOS (CSP)"      value={-data.dre.csp.total}         bold positive={false} />
                  <DRERow label="Repasses médicos"              value={-data.dre.csp.repasses}      indent={1} positive={false} />
                  <DRERow label="Materiais consumidos"          value={-data.dre.csp.materiais}     indent={1} positive={false} />
                  <DRERow label="Exames terceirizados"          value={-data.dre.csp.examesTerceiros} indent={1} positive={false} />
                  <DRERow label={`RESULTADO BRUTO — Margem ${pct(data.dre.margemBruta)}`} value={data.dre.resultadoBruto} bold />
                  <DRERow label="DESPESAS OPERACIONAIS"         value={-data.dre.despesasOperacionais.total} bold positive={false} />
                  {Object.entries(data.dre.despesasOperacionais.porCategoria).map(([cat, val]) => (
                    <DRERow key={cat} label={cat} value={-val} indent={1} positive={false} />
                  ))}
                  <DRERow label={`EBITDA — Margem ${pct(data.dre.margemEbitda)}`} value={data.dre.ebitda} bold />
                  <DRERow label={`RESULTADO LÍQUIDO — Margem ${pct(data.dre.margemLiquida)}`} value={data.dre.resultadoLiquido} bold />
                </tbody>
              </table>
            </div>
          )}

          {/* Tab Mix */}
          {activeTab === "mix" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Mix de Receita</h3>
                {mixData.length === 0
                  ? <p className="text-gray-400 text-center py-12">Sem dados de receita no período.</p>
                  : (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={mixData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {mixData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => fmt(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Detalhamento</h3>
                <div className="space-y-3">
                  {[
                    { label: "Particular",   val: data.mix.particular },
                    { label: "Convênio",     val: data.mix.convenio },
                    { label: "Assinaturas",  val: data.mix.assinatura },
                    { label: "Exames",       val: data.mix.exames },
                    { label: "TISS liquid.", val: data.mix.tiss },
                  ].map((row, i) => {
                    const total = Object.values(data.mix).reduce((a, b) => a + b, 0);
                    const pctVal = total > 0 ? (row.val / total) * 100 : 0;
                    return (
                      <div key={row.label}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-700 flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full inline-block" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                            {row.label}
                          </span>
                          <span className="font-medium">{fmt(row.val)} <span className="text-gray-400 font-normal">({pctVal.toFixed(0)}%)</span></span>
                        </div>
                        <div className="bg-gray-100 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full" style={{ width: `${pctVal}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Tab KPIs do Piloto */}
          {activeTab === "piloto" && (
            <div className="space-y-6">
              {/* Retenção */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Retenção de Pacientes</h3>
                <div className="grid grid-cols-3 gap-6">
                  {[
                    { label: "30 dias", val: data.unitEconomics.retencao30d, threshold: 70 },
                    { label: "60 dias", val: data.unitEconomics.retencao60d, threshold: 60 },
                    { label: "90 dias", val: data.unitEconomics.retencao90d, threshold: 50 },
                  ].map(r => (
                    <div key={r.label} className="text-center">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">{r.label}</p>
                      <div className="relative w-24 h-24 mx-auto">
                        <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                          <circle cx="18" cy="18" r="15.9" fill="none"
                            stroke={r.val == null ? "#e5e7eb" : r.val >= r.threshold ? "#2D7D5A" : "#ef4444"}
                            strokeWidth="3"
                            strokeDasharray={`${r.val ?? 0} 100`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className={`text-xl font-bold ${r.val == null ? "text-gray-300" : r.val >= r.threshold ? "text-green-700" : "text-red-600"}`}>
                            {r.val != null ? `${r.val}%` : "—"}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">Meta: {r.threshold}%</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 12 KPIs mínimos do piloto */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">12 KPIs Mínimos do Piloto (PREVIA-Digital § 6.10)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { label: "Pacientes elegíveis (c/ risco)", value: num(data.pilotos.elegiveisCount), ok: data.pilotos.elegiveisCount > 0 },
                    { label: "Taxa de conversão de elegíveis",  value: pct(data.pilotos.taxaConversaoElegiveis), ok: (data.pilotos.taxaConversaoElegiveis ?? 0) >= 30 },
                    { label: "Retenção em 90 dias",            value: pct(data.unitEconomics.retencao90d), ok: (data.unitEconomics.retencao90d ?? 0) >= 50 },
                    { label: "Adesão aos check-ins",           value: pct(data.pilotos.adesaoCheckInsPct), ok: (data.pilotos.adesaoCheckInsPct ?? 0) >= 70 },
                    { label: "Churn mensal",                   value: data.unitEconomics.churnMensal != null ? `${data.unitEconomics.churnMensal}%` : "—", ok: (data.unitEconomics.churnMensal ?? 100) < 10 },
                    { label: "Receita média por paciente",     value: fmt(data.unitEconomics.receitaPorPaciente), ok: data.unitEconomics.receitaPorPaciente > 0 },
                    { label: "Custo por paciente ativo",       value: fmt(data.unitEconomics.custoPorPaciente), ok: data.unitEconomics.custoPorPaciente > 0 },
                    { label: "Margem por paciente",            value: fmt(data.unitEconomics.margemPorPaciente), ok: data.unitEconomics.margemPorPaciente > 0 },
                    { label: "Pacientes por profissional",     value: data.unitEconomics.pacientesPorProfissional != null ? data.unitEconomics.pacientesPorProfissional.toString() : "—", ok: data.unitEconomics.pacientesPorProfissional != null },
                    { label: "NPS / Satisfação",               value: data.nps.score != null ? `${data.nps.score}` : "—", ok: (data.nps.score ?? -100) >= 0 },
                    { label: "Completude de dados no CRM",     value: pct(data.pilotos.completudeDadosPct), ok: (data.pilotos.completudeDadosPct ?? 0) >= 70 },
                    { label: "Tempo médio de resposta",        value: "Não rastreado", ok: false },
                  ].map((kpi, i) => (
                    <div key={i} className={`flex items-center justify-between p-3 rounded-lg border ${kpi.ok ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"}`}>
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${kpi.ok ? "bg-green-500 text-white" : "bg-gray-300 text-gray-600"}`}>
                          {i + 1}
                        </span>
                        <span className="text-sm text-gray-700">{kpi.label}</span>
                      </div>
                      <span className={`text-sm font-semibold ${kpi.ok ? "text-green-700" : "text-gray-500"}`}>{kpi.value}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-4">
                  KPIs verdes = meta atingida ou métrica disponível. Cinza = abaixo da meta ou não rastreado.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
