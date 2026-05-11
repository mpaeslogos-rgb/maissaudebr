"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  Users, Calendar, Wallet, AlertCircle, 
  ArrowRight, Plus, Clock, CheckCircle2,
  TrendingUp, Loader2
} from "lucide-react";
import Link from "next/link";
import { 
  getPatients, 
  getAppointments, 
  getPayments, 
  getAccountsPayable 
} from "@/lib/api";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, LineChart, Line 
} from "recharts";

export default function DashboardPage() {
  const [data, setData] = useState({
    patients: [] as any[],
    appointments: [] as any[],
    payments: [] as any[],
    payables: [] as any[],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      try {
        const [p, a, pay, acc] = await Promise.all([
          getPatients({ limit: 1000 }),
          getAppointments({ limit: 1000 }),
          getPayments({ limit: 1000 }),
          getAccountsPayable({ limit: 1000 }),
        ]);
        setData({
          patients: p.data,
          appointments: a.data,
          payments: pay.data,
          payables: acc.data,
        });
      } catch (err) {
        console.error("Erro ao carregar dashboard:", err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  // --- LÓGICA DE INDICADORES (KPIs) ---
  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    
    return {
      totalPatients: data.patients.length,
      appointmentsToday: data.appointments.filter(a => a.startTime.startsWith(today)).length,
      revenueMonth: data.payments
        .filter(p => p.status === "PAID")
        .reduce((acc, curr) => acc + Number(curr.amount), 0),
      pendingPayables: data.payables.filter(p => p.status === "PENDING").length,
      upcomingApts: data.appointments
        .filter(a => a.status === "SCHEDULED" || a.status === "CONFIRMED")
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
        .slice(0, 5) // Pega os próximos 5
    };
  }, [data]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin text-primary-600" size={40} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Saudação e Ações Rápidas */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Olá, Dr(a). Marcos!</h1>
          <p className="text-slate-500 text-sm">Aqui está o que está acontecendo na clínica hoje.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/agenda" className="btn-primary flex items-center gap-2">
            <Plus size={18} /> Novo Agendamento
          </Link>
        </div>
      </div>

      {/* Grid de KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total de Pacientes" 
          value={stats.totalPatients} 
          icon={<Users size={20} />} 
          trend="+2 este mês"
          color="bg-blue-50 text-blue-600" 
        />
        <StatCard 
          title="Consultas Hoje" 
          value={stats.appointmentsToday} 
          icon={<Calendar size={20} />} 
          trend="Ver agenda"
          color="bg-primary-50 text-primary-600" 
        />
        <StatCard 
          title="Receita (Mês)" 
          value={`R$ ${stats.revenueMonth.toLocaleString()}`} 
          icon={<Wallet size={20} />} 
          trend="Realizado"
          color="bg-green-50 text-green-600" 
        />
        <StatCard 
          title="Contas a Pagar" 
          value={stats.pendingPayables} 
          icon={<AlertCircle size={20} />} 
          trend="Pendentes"
          color="bg-red-50 text-red-600" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Coluna 1 e 2: Gráfico de Movimentação */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <TrendingUp size={18} className="text-primary-600" /> Fluxo de Atendimentos
              </h3>
              <select className="text-xs border-none bg-cream-50 rounded-lg p-1">
                <option>Últimos 7 dias</option>
              </select>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.appointments.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="status" hide />
                  <YAxis hide />
                  <Tooltip 
                    cursor={{fill: 'transparent'}}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white p-2 shadow-lg border rounded-lg text-xs">
                            <p className="font-bold">{payload[0].payload.patient.fullName}</p>
                            <p className="text-slate-500">{payload[0].payload.reason}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="id" fill="#1B5E3F" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <QuickLink 
                href="/pacientes" 
                title="Gerenciar Pacientes" 
                desc="Cadastre novos pacientes e edite dados." 
                icon={<Users size={20}/>} 
             />
             <QuickLink 
                href="/financeiro" 
                title="Fluxo de Caixa" 
                desc="Acompanhe entradas e saídas." 
                icon={<Wallet size={20}/>} 
             />
          </div>
        </div>

        {/* Coluna 3: Próximas Consultas */}
        <div className="card">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Clock size={18} className="text-primary-600" /> Próximos Atendimentos
          </h3>
          <div className="space-y-4">
            {stats.upcomingApts.length > 0 ? stats.upcomingApts.map((apt: any) => (
              <div key={apt.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-cream-50 transition-colors border border-transparent hover:border-cream-200 group">
                <div className="bg-white p-2 rounded-lg shadow-sm font-mono text-[10px] text-center min-w-[50px]">
                  <span className="block font-bold text-primary-700">
                    {new Date(apt.startTime).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                  </span>
                  <span className="text-slate-400">
                    {new Date(apt.startTime).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})}
                  </span>
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-bold text-slate-800 truncate">{apt.patient.fullName}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider truncate">{apt.doctor.specialty}</p>
                </div>
                <Link href="/agenda" className="text-slate-300 group-hover:text-primary-600 transition-colors">
                  <ArrowRight size={16} />
                </Link>
              </div>
            )) : (
              <p className="text-sm text-slate-400 text-center py-10">Nenhuma consulta agendada.</p>
            )}
          </div>
          <Link href="/agenda" className="block text-center text-xs text-primary-600 font-bold mt-6 hover:underline">
            Ver agenda completa
          </Link>
        </div>

      </div>
    </div>
  );
}

// --- SUBCOMPONENTES DE UI ---

function StatCard({ title, value, icon, trend, color }: any) {
  return (
    <div className="card border-l-4 border-primary-600">
      <div className="flex justify-between items-start mb-2">
        <div className={`p-2 rounded-lg ${color}`}>
          {icon}
        </div>
        <span className="text-[10px] font-bold text-slate-400 uppercase">{trend}</span>
      </div>
      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{title}</p>
      <p className="text-2xl font-black text-slate-800 mt-1">{value}</p>
    </div>
  );
}

function QuickLink({ href, title, desc, icon }: any) {
  return (
    <Link href={href} className="card hover:border-primary-300 transition-all group flex items-start gap-4">
      <div className="p-3 bg-slate-50 rounded-xl text-slate-400 group-hover:bg-primary-50 group-hover:text-primary-600 transition-colors">
        {icon}
      </div>
      <div>
        <h4 className="text-sm font-bold text-slate-800 group-hover:text-primary-700 transition-colors">{title}</h4>
        <p className="text-xs text-slate-500 mt-1">{desc}</p>
      </div>
    </Link>
  );
}