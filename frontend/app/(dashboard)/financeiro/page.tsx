"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  ArrowUpRight, ArrowDownRight, Wallet, TrendingUp, AlertCircle, 
  Download, ChevronDown, ChevronRight, CheckCircle, Clock, 
  Plus, CheckCircle2, Search, X, Loader2
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Line, ComposedChart 
} from "recharts";
import { getPayments, getAccountsPayable, createAccountPayable } from "@/lib/api";
import { Payment, AccountPayable } from "@/lib/types";

const TABS = [
  { id: "cashflow",   label: "💰 Fluxo de Caixa" },
  { id: "receivable", label: "📥 A Receber (Pacientes)" },
  { id: "payable",    label: "📤 A Pagar (Despesas)" },
];

export default function FinanceiroPage() {
  const [tab, setTab] = useState("cashflow");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [payables, setPayables] = useState<AccountPayable[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resPayments, resPayables] = await Promise.all([
        getPayments({ limit: 500 }),
        getAccountsPayable({ limit: 500 })
      ]);
      setPayments(resPayments.data);
      setPayables(resPayables.data);
    } catch (error) {
      console.error("Erro ao carregar dados financeiros:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500 animate-pulse flex items-center gap-2">
          <Loader2 className="animate-spin" /> Carregando dados financeiros...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">💰 Financeiro</h1>
          <p className="text-slate-500 text-sm">Gestão financeira integrada ao banco de dados</p>
        </div>
        <button onClick={fetchData} className="btn-outline text-xs py-1">
          Atualizar Sincronização
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.id
                ? "bg-primary-600 text-white shadow-sm"
                : "bg-white text-slate-600 hover:bg-cream-100 border border-surface-border"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "cashflow"   && <FluxoCaixa payments={payments} payables={payables} />}
      {tab === "receivable" && <ContasReceber payments={payments} />}
      {tab === "payable"    && <ContasPagar payables={payables} onRefresh={fetchData} />}
    </div>
  );
}

// ============================================
// 💰 FLUXO DE CAIXA
// ============================================

function FluxoCaixa({ payments, payables }: { payments: Payment[], payables: AccountPayable[] }) {
  const stats = useMemo(() => {
    const totalIn = payments
      .filter(p => p.status === 'PAID')
      .reduce((acc, p) => acc + Number(p.amount), 0);
    
    const totalOut = payables
      .filter(p => p.status === 'PAID')
      .reduce((acc, p) => acc + Number(p.amount), 0);

    const pendingIn = payments
      .filter(p => p.status === 'PENDING')
      .reduce((acc, p) => acc + Number(p.amount), 0);

    return { totalIn, totalOut, balance: totalIn - totalOut, pendingIn };
  }, [payments, payables]);

  const chartData = [
    { name: 'Recebido', valor: stats.totalIn, fill: '#1B5E3F' },
    { name: 'Pago', valor: stats.totalOut, fill: '#C53030' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <BalanceCard title="Saldo em Caixa" value={stats.balance} icon={Wallet} color="primary" />
        <BalanceCard title="Total Recebido" value={stats.totalIn} icon={ArrowUpRight} color="success" />
        <BalanceCard title="Total Pago" value={stats.totalOut} icon={ArrowDownRight} color="danger" />
        <BalanceCard title="A Receber (Pendente)" value={stats.pendingIn} icon={TrendingUp} color="primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-bold text-slate-800 mb-6">Comparativo de Caixa (Realizado)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(v) => `R$${v}`} />
              <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString('pt-BR')}`} />
              <Bar dataKey="valor" radius={[4, 4, 0, 0]} barSize={60} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="font-bold text-slate-800 mb-4">Alertas do Sistema 🔔</h3>
          <div className="space-y-3">
            {payables.filter(p => p.status === 'PENDING').length > 0 && (
              <Alert 
                type="warning" 
                title={`${payables.filter(p => p.status === 'PENDING').length} despesas pendentes`} 
                detail="Acesse a aba 'A Pagar' para gerenciar os vencimentos." 
              />
            )}
            <Alert type="primary" title="Dados Protegidos" detail="Todas as transações são salvas com criptografia e log de auditoria." />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 📥 CONTAS A RECEBER (Payments)
// ============================================

function ContasReceber({ payments }: { payments: Payment[] }) {
  const [filter, setFilter] = useState("all");

  const statusMap: any = {
    PAID:      { label: "Pago",      cls: "bg-green-100 text-green-700", icon: CheckCircle },
    PENDING:   { label: "Pendente",  cls: "bg-yellow-100 text-yellow-700", icon: Clock },
    CANCELLED: { label: "Cancelado", cls: "bg-slate-100 text-slate-500", icon: X },
    REFUNDED:  { label: "Reembolsado", cls: "bg-blue-100 text-blue-700", icon: ArrowDownRight },
  };

  const filtered = filter === "all" ? payments : payments.filter(p => p.status === filter);

  return (
    <div className="card">
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {["all", "PAID", "PENDING", "CANCELLED"].map(f => (
          <button 
            key={f} 
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${filter === f ? 'bg-primary-600 text-white' : 'bg-cream-100 text-slate-600 hover:bg-cream-200'}`}
          >
            {f === 'all' ? 'Todos' : statusMap[f]?.label || f}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-cream-50 text-slate-600 border-b border-surface-border">
            <tr>
              <th className="text-left p-3">Paciente</th>
              <th className="text-left p-3">Vencimento</th>
              <th className="text-left p-3">Método</th>
              <th className="text-right p-3">Valor</th>
              <th className="text-center p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} className="border-b border-surface-border hover:bg-cream-50 transition-colors">
                <td className="p-3 font-medium text-slate-800">{p.patient?.fullName || 'Cobrança Avulsa'}</td>
                <td className="p-3 font-mono text-slate-600">{new Date(p.dueDate).toLocaleDateString('pt-BR')}</td>
                <td className="p-3 text-xs uppercase font-semibold text-slate-500">{p.method}</td>
                <td className="p-3 text-right font-bold text-primary-700">R$ {Number(p.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td className="p-3 text-center">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${statusMap[p.status]?.cls}`}>
                    {statusMap[p.status]?.label || p.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================
// 📤 CONTAS A PAGAR (Accounts Payable)
// ============================================

function ContasPagar({ payables, onRefresh }: { payables: AccountPayable[], onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  // Estados do formulário
  const [description, setDescription] = useState("");
  const [supplier, setSupplier]       = useState("");
  const [amount, setAmount]           = useState("");
  const [dueDate, setDueDate]         = useState("");
  const [category, setCategory]       = useState("Aluguel");

  const statusMap: any = {
    PAID:      { label: "Pago",     cls: "bg-green-100 text-green-700" },
    PENDING:   { label: "Pendente", cls: "bg-yellow-100 text-yellow-700" },
    CANCELLED: { label: "Cancelado", cls: "bg-red-100 text-red-700" },
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!description || !amount || !dueDate) {
      setError("Por favor, preencha descrição, valor e data.");
      return;
    }

    setSaving(true);
    try {
      await createAccountPayable({
        description,
        supplier: supplier || undefined,
        amount: amount.replace(",", "."), // Garantir formato decimal
        dueDate: new Date(dueDate).toISOString(),
        category,
        status: "PENDING"
      });

      // Limpar formulário e fechar
      setDescription("");
      setSupplier("");
      setAmount("");
      setDueDate("");
      setShowForm(false);
      onRefresh(); // Atualiza a lista pai
    } catch (err: any) {
      setError(err.message || "Erro ao salvar conta a pagar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800">Listagem de Despesas</h3>
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn-primary text-sm flex items-center gap-1"
          >
            {showForm ? <X size={14} /> : <Plus size={14} />}
            {showForm ? "Fechar" : "Nova Despesa"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-cream-50 border border-cream-200 rounded-xl p-5 mb-6 animate-in fade-in slide-in-from-top-2">
            <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Plus size={16} className="text-primary-600" /> Cadastrar Nova Conta
            </h4>
            
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase">Descrição *</label>
                <input 
                  className="input mt-1" 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Ex: Material de Escritório" 
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase">Fornecedor</label>
                <input 
                  className="input mt-1" 
                  value={supplier}
                  onChange={e => setSupplier(e.target.value)}
                  placeholder="Ex: Kalunga" 
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase">Valor (R$) *</label>
                <input 
                  type="text"
                  className="input mt-1 font-mono" 
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00" 
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase">Vencimento *</label>
                <input 
                  type="date" 
                  className="input mt-1" 
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase">Categoria</label>
                <select 
                  className="input mt-1"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                >
                  <option>Aluguel</option>
                  <option>Energia</option>
                  <option>Internet</option>
                  <option>Pessoal</option>
                  <option>Material</option>
                  <option>Outros</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={() => setShowForm(false)} className="btn-outline text-sm">
                Cancelar
              </button>
              <button 
                type="submit" 
                disabled={saving} 
                className="btn-primary text-sm flex items-center gap-2"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {saving ? "Salvando..." : "Confirmar Lançamento"}
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cream-50 text-slate-600 border-b border-surface-border">
              <tr>
                <th className="text-left p-3">Descrição / Fornecedor</th>
                <th className="text-left p-3">Categoria</th>
                <th className="text-left p-3">Vencimento</th>
                <th className="text-right p-3">Valor</th>
                <th className="text-center p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {payables.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400 italic">Nenhuma conta a pagar cadastrada.</td>
                </tr>
              ) : (
                payables.map(item => (
                  <tr key={item.id} className="border-b border-surface-border hover:bg-cream-50 transition-colors">
                    <td className="p-3">
                      <div className="font-medium text-slate-800">{item.description}</div>
                      <div className="text-xs text-slate-500">{item.supplier || '—'}</div>
                    </td>
                    <td className="p-3">
                      <span className="text-xs bg-cream-100 text-slate-600 px-2 py-1 rounded font-medium border border-cream-200">
                        {item.category}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-600">{new Date(item.dueDate).toLocaleDateString('pt-BR')}</td>
                    <td className="p-3 text-right font-bold text-red-600">
                      R$ {Number(item.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${statusMap[item.status]?.cls}`}>
                        {statusMap[item.status]?.label || item.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Componentes de UI Auxiliares ─────────────────────────────────────────────

function BalanceCard({ title, value, icon: Icon, color }: any) {
  const colors: any = {
    primary: "bg-primary-50 text-primary-700 border-primary-100",
    success: "bg-green-50 text-green-700 border-green-100",
    danger:  "bg-red-50 text-red-700 border-red-100",
  };
  return (
    <div className={`card border-l-4 ${colors[color]}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon size={20} />
        </div>
        <div>
          <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">{title}</div>
          <div className="text-xl font-black text-slate-800 font-mono">
            R$ {value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Alert({ type, title, detail }: any) {
  const styles: any = {
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
    primary: "bg-primary-50 border-primary-200 text-primary-800",
  };
  return (
    <div className={`border rounded-lg p-3 ${styles[type]} animate-in slide-in-from-right-4`}>
      <div className="flex items-start gap-2 text-sm">
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
        <div>
          <div className="font-bold">{title}</div>
          <div className="text-xs opacity-90">{detail}</div>
        </div>
      </div>
    </div>
  );
}