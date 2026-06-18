"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  Users, Calendar, TrendingUp, DollarSign, 
  ArrowUpRight, ArrowDownRight, Loader2, Download 
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line 
} from "recharts";
import { getPatients, getAppointments, getPayments, getAccountsPayable } from "@/lib/api";

// Cores do padrão MaissaudeBR
const COLORS = ["#1B5E3F", "#D69E2E", "#C53030", "#3182CE", "#805AD5"];

export default function RelatoriosPage() {
  const [data, setData] = useState({
    patients: [] as any[],
    appointments: [] as any[],
    payments: [] as any[],
    payables: [] as any[],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAllData() {
      setLoading(true);
      try {
        const [p, a, pay, acc] = await Promise.all([
          getPatients({ limit: 1000 }),
          getAppointments({ limit: 1000 }),
          getPayments({ take: 100 }),
          getAccountsPayable({ take: 100 }),
        ]);
        setData({
          patients: p.data,
          appointments: a.data,
          payments: pay.data,
          payables: acc.data,
        });
      } catch (err) {
        console.error("Erro ao carregar relatórios:", err);
      } finally {
        setLoading(false);
      }
    }
    loadAllData();
  }, []);

  // --- CÁLCULO DE MÉTRICAS (KPIs) ---
  const metrics = useMemo(() => {
    const totalPatients = data.patients.length;
    const totalApts = data.appointments.length;
    
    const totalRevenue = data.payments
      .filter(p => p.status === "PAID")
      .reduce((acc, curr) => acc + Number(curr.amount), 0);

    const totalExpenses = data.payables
      .filter(p => p.status === "PAID")
      .reduce((acc, curr) => acc + Number(curr.amount), 0);

    const profit = totalRevenue - totalExpenses;

    return { totalPatients, totalApts, totalRevenue, totalExpenses, profit };
  }, [data]);

  // --- DADOS PARA OS GRÁFICOS ---
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    data.appointments.forEach(a => {
      counts[a.status] = (counts[a.status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [data.appointments]);

  const financeData = [
    { name: "Receitas", valor: metrics.totalRevenue },
    { name: "Despesas", valor: metrics.totalExpenses },
  ];

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin text-primary-600 mx-auto mb-4" size={40} />
          <p className="text-slate-500">Consolidando indicadores reais...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">📊 Relatórios de Gestão</h1>
          <p className="text-slate-500 text-sm">Visão geral baseada em dados reais do sistema</p>
        </div>
        <button className="btn-outline flex items-center gap-2 text-sm" onClick={() => window.print()}>
          <Download size={16} /> Exportar Relatório
        </button>
      </div>

      {/* Cards de KPI */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard 
          title="Total de Pacientes" 
          value={metrics.totalPatients} 
          icon={<Users size={20} />} 
          color="bg-blue-50 text-blue-600" 
        />
        <KpiCard 
          title="Agendamentos" 
          value={metrics.totalApts} 
          icon={<Calendar size={20} />} 
          color="bg-primary-50 text-primary-600" 
        />
        <KpiCard 
          title="Faturamento (Pago)" 
          value={`R$ ${metrics.totalRevenue.toLocaleString()}`} 
          icon={<TrendingUp size={20} />} 
          color="bg-green-50 text-green-600" 
        />
        <KpiCard 
          title="Resultado Líquido" 
          value={`R$ ${metrics.profit.toLocaleString()}`} 
          icon={<DollarSign size={20} />} 
          color={metrics.profit >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 1: Status de Agendamentos */}
        <div className="card">
          <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
            Distribuição de Status (Consultas)
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Receitas vs Despesas */}
        <div className="card">
          <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
            Saúde Financeira (Realizado)
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={financeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(v) => `R$ ${v.toLocaleString()}`} />
                <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                  {financeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.name === "Receitas" ? "#1B5E3F" : "#C53030"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Seção de Tabela Resumo */}
      <div className="card">
        <h3 className="font-bold text-slate-800 mb-4 uppercase text-xs tracking-widest text-slate-500">
          Resumo de Atividade Recente
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left p-3">Indicador</th>
                <th className="text-right p-3">Valor</th>
                <th className="text-center p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="p-3 font-medium">Conversão de Agendamentos</td>
                <td className="p-3 text-right">
                  {metrics.totalApts > 0 ? ((data.appointments.filter(a => a.status === 'COMPLETED').length / metrics.totalApts) * 100).toFixed(1) : 0}%
                </td>
                <td className="p-3 text-center">
                  <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded font-bold">INFO</span>
                </td>
              </tr>
              <tr>
                <td className="p-3 font-medium">Inadimplência (Estimada)</td>
                <td className="p-3 text-right">
                  R$ {data.payments.filter(p => p.status === "PENDING").reduce((acc, curr) => acc + Number(curr.amount), 0).toLocaleString()}
                </td>
                <td className="p-3 text-center">
                  <span className="text-[10px] bg-red-50 text-red-600 px-2 py-1 rounded font-bold">ALERTA</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value, icon, color }: any) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`p-3 rounded-xl ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</p>
        <p className="text-xl font-bold text-slate-800">{value}</p>
      </div>
    </div>
  );
}