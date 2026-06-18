"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowUpRight, ArrowDownRight, Wallet, TrendingUp, AlertCircle,
  Plus, X, Loader2, CheckCircle2, Clock, AlertTriangle, RefreshCw,
  ChevronDown, ChevronUp, DollarSign, Trash2, Stethoscope,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Line, ComposedChart, Legend,
} from "recharts";
import {
  getPayments, getAccountsPayable, createAccountPayable,
  payPayment, payAccountPayable, deleteAccountPayable, getCashflow,
  type CashflowData,
} from "@/lib/api";
import type { Payment, AccountPayable } from "@/lib/types";
import { useConfirm } from "@/components/ConfirmModal";

// ─── Formatadores ─────────────────────────────────────────────────────────────

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const MONTH_LABEL: Record<string, string> = {
  "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr",
  "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
};

function fmtMonth(key: string) {
  const [year, month] = key.split("-");
  return `${MONTH_LABEL[month] ?? month}/${year.slice(2)}`;
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, variant = "neutral", small = false,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; variant?: "positive" | "negative" | "neutral" | "warning";
  small?: boolean;
}) {
  const colors = {
    positive: "border-green-200 bg-green-50 text-green-700",
    negative: "border-red-200 bg-red-50 text-red-700",
    warning:  "border-amber-200 bg-amber-50 text-amber-700",
    neutral:  "border-slate-200 bg-white text-primary-700",
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[variant]}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
          <p className={`font-black font-mono mt-1 ${small ? "text-lg" : "text-2xl"}`}>{value}</p>
          {sub && <p className="text-xs opacity-70 mt-0.5">{sub}</p>}
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center opacity-80 ${colors[variant]}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "cashflow",   label: "Fluxo de Caixa" },
  { id: "receivable", label: "A Receber" },
  { id: "payable",    label: "A Pagar" },
];

// ─── Página principal ─────────────────────────────────────────────────────────

export default function FinanceiroPage() {
  const confirm = useConfirm()
  const [tab, setTab]             = useState("cashflow");
  const [payments, setPayments]   = useState<Payment[]>([]);
  const [payables, setPayables]   = useState<AccountPayable[]>([]);
  const [cashflow, setCashflow]   = useState<CashflowData | null>(null);
  const [months, setMonths]       = useState(12);
  const [loading, setLoading]     = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [resPayments, resPayables, resCashflow] = await Promise.all([
        getPayments({ take: 100 }),
        getAccountsPayable({ take: 100 }),
        getCashflow(months),
      ]);
      setPayments(resPayments.data);
      setPayables(resPayables.data);
      setCashflow(resCashflow);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [months]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <Loader2 className="animate-spin mr-2" size={20} />
        Carregando dados financeiros…
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Financeiro</h1>
          <p className="text-sm text-slate-500">Fluxo de caixa, recebimentos e despesas</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/financeiro/conciliacao-medicos"
            className="flex items-center gap-2 px-4 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
          >
            <Stethoscope size={14} /> Conciliar Médicos
          </Link>
          <button
            onClick={fetchAll}
            className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded-lg text-sm hover:bg-slate-50"
          >
            <RefreshCw size={14} /> Atualizar
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? "border-primary-600 text-primary-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "cashflow"   && cashflow && (
        <FluxoCaixa cashflow={cashflow} months={months} onMonthsChange={m => setMonths(m)} />
      )}
      {tab === "receivable" && (
        <ContasReceber payments={payments} onRefresh={fetchAll} />
      )}
      {tab === "payable" && (
        <ContasPagar payables={payables} onRefresh={fetchAll} />
      )}
    </div>
  );
}

// ─── Fluxo de Caixa ──────────────────────────────────────────────────────────

function FluxoCaixa({
  cashflow, months, onMonthsChange,
}: {
  cashflow: CashflowData;
  months: number;
  onMonthsChange: (m: number) => void;
}) {
  const { current: c, totals, months: monthData } = cashflow;

  const chartData = monthData.map(m => ({
    name:          fmtMonth(m.month),
    Recebido:      +((m.entradas ?? 0).toFixed(2)),
    "A Receber":   +((m.projecaoEntradas ?? 0).toFixed(2)),
    Pago:          +((m.saidas ?? 0).toFixed(2)),
    "A Pagar":     +((m.projecaoSaidas ?? 0).toFixed(2)),
    Saldo:         +((m.saldo ?? 0).toFixed(2)),
  }));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Saldo Realizado (período)"
          value={BRL(totals.saldo)}
          sub={`${months} meses`}
          icon={Wallet}
          variant={totals.saldo >= 0 ? "positive" : "negative"}
        />
        <KpiCard
          label="Mês Atual — Saldo"
          value={BRL(c.thisMonthSaldo)}
          sub={`${BRL(c.thisMonthEntradas)} entrada · ${BRL(c.thisMonthSaidas)} saída`}
          icon={TrendingUp}
          variant={c.thisMonthSaldo >= 0 ? "positive" : "negative"}
          small
        />
        <KpiCard
          label="A Receber (pendente)"
          value={BRL(c.pendingEntradas)}
          sub={`${c.pendingEntradasCount} cobranças`}
          icon={ArrowUpRight}
          variant="neutral"
          small
        />
        <KpiCard
          label="A Pagar (pendente)"
          value={BRL(c.pendingSaidas)}
          sub={`${c.pendingSaidasCount} despesas`}
          icon={ArrowDownRight}
          variant="neutral"
          small
        />
      </div>

      {/* Alertas vencidos */}
      {(c.overdueEntradasCount > 0 || c.overdueSaidasCount > 0) && (
        <div className="flex flex-wrap gap-3">
          {c.overdueEntradasCount > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm text-amber-800">
              <AlertTriangle size={15} />
              <span>
                <strong>{c.overdueEntradasCount}</strong> recebimento{c.overdueEntradasCount > 1 ? 's' : ''} vencido{c.overdueEntradasCount > 1 ? 's' : ''} — {BRL(c.overdueEntradas)}
              </span>
            </div>
          )}
          {c.overdueSaidasCount > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-800">
              <AlertCircle size={15} />
              <span>
                <strong>{c.overdueSaidasCount}</strong> despesa{c.overdueSaidasCount > 1 ? 's' : ''} vencida{c.overdueSaidasCount > 1 ? 's' : ''} — {BRL(c.overdueSaidas)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Gráfico */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800">Evolução mensal</h3>
          <select
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
            value={months}
            onChange={e => onMonthsChange(Number(e.target.value))}
          >
            <option value={3}>3 meses</option>
            <option value={6}>6 meses</option>
            <option value={12}>12 meses</option>
            <option value={24}>24 meses</option>
          </select>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 12, bottom: 0, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis
              tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`}
              tick={{ fontSize: 11 }}
              width={52}
            />
            <Tooltip
              formatter={(v: number, name: string) => [BRL(v), name]}
              labelStyle={{ fontWeight: 600 }}
            />
            <Legend iconType="circle" iconSize={8} />
            <Bar dataKey="Recebido"    fill="#16a34a" radius={[3, 3, 0, 0]} barSize={10} />
            <Bar dataKey="A Receber"  fill="#86efac" radius={[3, 3, 0, 0]} barSize={10} />
            <Bar dataKey="Pago"       fill="#dc2626" radius={[3, 3, 0, 0]} barSize={10} />
            <Bar dataKey="A Pagar"    fill="#fca5a5" radius={[3, 3, 0, 0]} barSize={10} />
            <Line type="monotone" dataKey="Saldo" stroke="#2563eb" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Projeção 30 dias */}
      {(c.upcoming30EntradasCount > 0 || c.upcoming30SaidasCount > 0) && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-4">Próximos 30 dias</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-700 mb-1">
                <ArrowUpRight size={16} />
                <span className="text-sm font-semibold">A Receber</span>
              </div>
              <p className="text-2xl font-black font-mono text-green-800">{BRL(c.upcoming30Entradas)}</p>
              <p className="text-xs text-green-700 mt-0.5">{c.upcoming30EntradasCount} cobrança{c.upcoming30EntradasCount !== 1 ? 's' : ''} prevista{c.upcoming30EntradasCount !== 1 ? 's' : ''}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-700 mb-1">
                <ArrowDownRight size={16} />
                <span className="text-sm font-semibold">A Pagar</span>
              </div>
              <p className="text-2xl font-black font-mono text-red-800">{BRL(c.upcoming30Saidas)}</p>
              <p className="text-xs text-red-700 mt-0.5">{c.upcoming30SaidasCount} despesa{c.upcoming30SaidasCount !== 1 ? 's' : ''} prevista{c.upcoming30SaidasCount !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between">
            <span className="text-sm text-slate-600 font-medium">Saldo projetado (30 dias)</span>
            <span className={`font-black font-mono text-lg ${
              c.upcoming30Entradas - c.upcoming30Saidas >= 0 ? 'text-green-700' : 'text-red-700'
            }`}>
              {BRL(c.upcoming30Entradas - c.upcoming30Saidas)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Contas a Receber ─────────────────────────────────────────────────────────

const STATUS_PAYMENT = {
  PAID:      { label: "Recebido",     cls: "bg-green-100 text-green-700" },
  PENDING:   { label: "Pendente",    cls: "bg-amber-100 text-amber-700" },
  OVERDUE:   { label: "Vencido",     cls: "bg-red-100 text-red-700" },
  CANCELLED: { label: "Cancelado",   cls: "bg-slate-100 text-slate-500" },
  REFUNDED:  { label: "Estornado",   cls: "bg-blue-100 text-blue-700" },
} as const;

const METHOD_LABEL: Record<string, string> = {
  CASH: "Dinheiro", CREDIT_CARD: "Crédito", DEBIT_CARD: "Débito",
  PIX: "PIX", BANK_TRANSFER: "Transf.", HEALTH_INSURANCE: "Convênio",
};

function ContasReceber({ payments, onRefresh }: { payments: Payment[]; onRefresh: () => void }) {
  const [filter, setFilter]   = useState("all");
  const [paying, setPaying]   = useState<string | null>(null);

  const filtered = filter === "all" ? payments : payments.filter(p => p.status === filter);

  async function handlePay(id: string) {
    setPaying(id);
    try {
      await payPayment(id, {});
      onRefresh();
    } finally {
      setPaying(null);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Filtros */}
      <div className="flex gap-2 p-4 border-b border-slate-100 flex-wrap">
        {["all", "PENDING", "OVERDUE", "PAID", "CANCELLED"].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === f
                ? "bg-primary-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f === "all" ? "Todos" : STATUS_PAYMENT[f as keyof typeof STATUS_PAYMENT]?.label ?? f}
            {f !== "all" && (
              <span className="ml-1 opacity-70">
                ({payments.filter(p => p.status === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Paciente</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Vencimento</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Método</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Valor</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500 text-sm">
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : filtered.map(p => {
              const isOverdue = p.status === "PENDING" && new Date(p.dueDate) < new Date();
              const s = STATUS_PAYMENT[p.status as keyof typeof STATUS_PAYMENT];
              return (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {(p.patient as any)?.fullName ?? "Avulso"}
                  </td>
                  <td className={`px-4 py-3 font-mono text-sm ${isOverdue ? "text-red-600 font-semibold" : "text-slate-600"}`}>
                    {new Date(p.dueDate).toLocaleDateString("pt-BR")}
                    {isOverdue && <span className="ml-1 text-xs">⚠</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {METHOD_LABEL[p.method ?? ""] ?? p.method ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-primary-700">
                    {BRL(Number(p.amount))}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s?.cls ?? ""}`}>
                      {s?.label ?? p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {(p.status === "PENDING" || p.status === "OVERDUE") && (
                      <button
                        onClick={() => handlePay(p.id)}
                        disabled={paying === p.id}
                        className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                      >
                        {paying === p.id ? <Loader2 size={12} className="animate-spin inline" /> : "Receber"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Contas a Pagar ───────────────────────────────────────────────────────────

const STATUS_PAYABLE = {
  PAID:      { label: "Pago",      cls: "bg-green-100 text-green-700" },
  PENDING:   { label: "Pendente",  cls: "bg-amber-100 text-amber-700" },
  OVERDUE:   { label: "Vencido",   cls: "bg-red-100 text-red-700" },
  CANCELLED: { label: "Cancelado", cls: "bg-slate-100 text-slate-500" },
} as const;

function ContasPagar({ payables, onRefresh }: { payables: AccountPayable[]; onRefresh: () => void }) {
  const confirm = useConfirm()
  const [filter,      setFilter]      = useState("all");
  const [showForm,    setShowForm]    = useState(false);
  const [paying,      setPaying]      = useState<string | null>(null);
  const [deleting,    setDeleting]    = useState<string | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [formError,   setFormError]   = useState("");

  const [description, setDescription] = useState("");
  const [supplier,    setSupplier]    = useState("");
  const [amount,      setAmount]      = useState("");
  const [dueDate,     setDueDate]     = useState("");
  const [category,    setCategory]    = useState("Outros");

  const filtered = filter === "all" ? payables : payables.filter(p => p.status === filter);

  async function handlePay(id: string) {
    setPaying(id);
    try {
      await payAccountPayable(id);
      onRefresh();
    } finally {
      setPaying(null);
    }
  }

  async function handleDelete(id: string) {
    if (!await confirm({ title: 'Cancelar despesa', message: 'Cancelar esta conta a pagar?', confirmLabel: 'Sim, cancelar', variant: 'danger' })) return;
    setDeleting(id);
    try {
      await deleteAccountPayable(id);
      onRefresh();
    } finally {
      setDeleting(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!description || !amount || !dueDate) {
      setFormError("Preencha descrição, valor e data de vencimento.");
      return;
    }
    setSaving(true);
    try {
      await createAccountPayable({
        description, supplier: supplier || undefined,
        amount: parseFloat(amount.replace(",", ".")),
        dueDate: new Date(dueDate).toISOString(), category,
      });
      setDescription(""); setSupplier(""); setAmount(""); setDueDate(""); setShowForm(false);
      onRefresh();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setFormError(e?.message ?? "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Barra de ações */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          {["all", "PENDING", "OVERDUE", "PAID", "CANCELLED"].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === f ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f === "all" ? "Todos" : STATUS_PAYABLE[f as keyof typeof STATUS_PAYABLE]?.label ?? f}
              {f !== "all" && (
                <span className="ml-1 opacity-70">({payables.filter(p => p.status === f).length})</span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
        >
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? "Fechar" : "Nova Despesa"}
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <DollarSign size={16} className="text-primary-600" />
            Cadastrar Nova Despesa
          </h4>
          {formError && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-4">{formError}</p>
          )}
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Descrição *</label>
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Aluguel sala" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Categoria</label>
                <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={category} onChange={e => setCategory(e.target.value)}>
                  {["Aluguel","Energia","Internet","Pessoal","Material","Equipamentos","Impostos","Marketing","Outros"].map(c => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Fornecedor</label>
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Ex: Copel" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Valor (R$) *</label>
                <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Vencimento *</label>
                <input type="date" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50">Cancelar</button>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {saving ? "Salvando…" : "Confirmar Lançamento"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Descrição / Fornecedor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Categoria</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Vencimento</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Valor</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500 text-sm">Nenhuma despesa encontrada.</td>
                </tr>
              ) : filtered.map(item => {
                const isOverdue = item.status === "PENDING" && new Date(item.dueDate) < new Date();
                const s = STATUS_PAYABLE[(item.status === "PENDING" && isOverdue ? "OVERDUE" : item.status) as keyof typeof STATUS_PAYABLE]
                  ?? STATUS_PAYABLE[item.status as keyof typeof STATUS_PAYABLE];
                return (
                  <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{item.description}</p>
                      {item.supplier && <p className="text-xs text-slate-500">{item.supplier}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                        {item.category ?? "—"}
                      </span>
                    </td>
                    <td className={`px-4 py-3 font-mono text-sm ${isOverdue ? "text-red-600 font-semibold" : "text-slate-600"}`}>
                      {new Date(item.dueDate).toLocaleDateString("pt-BR")}
                      {isOverdue && <span className="ml-1 text-xs">⚠</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-red-700">
                      {BRL(Number(item.amount))}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s?.cls ?? ""}`}>
                        {s?.label ?? item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {(item.status === "PENDING" || item.status === "OVERDUE") && (
                          <button
                            onClick={() => handlePay(item.id)}
                            disabled={paying === item.id || deleting === item.id}
                            className="text-xs px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium"
                          >
                            {paying === item.id ? <Loader2 size={12} className="animate-spin inline" /> : "Pagar"}
                          </button>
                        )}
                        {item.status !== "CANCELLED" && (
                          <button
                            onClick={() => handleDelete(item.id)}
                            disabled={deleting === item.id || paying === item.id}
                            title="Cancelar conta"
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50 transition-colors"
                          >
                            {deleting === item.id
                              ? <Loader2 size={14} className="animate-spin" />
                              : <Trash2 size={14} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
