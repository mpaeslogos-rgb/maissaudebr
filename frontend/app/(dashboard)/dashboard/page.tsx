"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Users, Calendar, Wallet, AlertCircle,
  ArrowRight, Plus, Clock, TrendingUp, Loader2,
} from "lucide-react";
import { SkeletonKPIRow, SkeletonChart, SkeletonList } from "@/components/Skeleton";
import Link from "next/link";
import {
  getPatients,
  getAppointments,
  getPaymentSummary,
  getAccountsPayableSummary,
} from "@/lib/api";
import { Appointment } from "@/lib/types";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState({
    patients: [] as any[],
    appointments: [] as Appointment[],
    revenueMonth: 0,
    pendingReceivables: 0,
    pendingPayables: 0,
  });
  const [loading, setLoading] = useState(true);
  const role = user?.role ?? 'ADMIN';

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
        const future = new Date(now); future.setDate(future.getDate() + 30);

        const [p, a, revenueSummary, receivablesSummary, payablesSummary] = await Promise.all([
          getPatients({ limit: 100 }),
          getAppointments({ limit: 100, from: weekAgo.toISOString(), to: future.toISOString() }),
          // "Receita (Mês)": soma agregada no backend, filtrada por pago no mês
          // atual — antes somava todos os pagamentos PAID retornados (sem filtro
          // de data), inflando o valor com receita de meses anteriores.
          getPaymentSummary({ from: monthStart.toISOString(), to: monthEnd.toISOString(), dateField: 'paidAt' }),
          getPaymentSummary(),
          getAccountsPayableSummary(),
        ]);
        setData({
          patients: p.data,
          appointments: a.data,
          revenueMonth: revenueSummary.byStatus.find(s => s.status === 'PAID')?.amount ?? 0,
          pendingReceivables: receivablesSummary.byStatus
            .filter(s => s.status === 'PENDING' || s.status === 'OVERDUE')
            .reduce((acc, s) => acc + s.count, 0),
          pendingPayables: payablesSummary.byStatus.find(s => s.status === 'PENDING')?.count ?? 0,
        });
      } catch (err) {
        console.error("Erro ao carregar dashboard:", err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
    const weekStr = weekAgo.toISOString().split("T")[0];
    const myName = user?.name ?? '';

    const todayApts = data.appointments.filter(a => a.startTime.startsWith(today));
    const myTodayApts = todayApts.filter(a => a.doctor?.user?.name === myName);
    const myWeekApts = data.appointments.filter(a => a.startTime >= weekStr && a.doctor?.user?.name === myName);
    const myPendingRecords = myTodayApts.filter(a =>
      (a.status === 'COMPLETED' || a.status === 'IN_PROGRESS')
    ).length;

    return {
      totalPatients: data.patients.length,
      appointmentsToday: todayApts.length,
      revenueMonth: data.revenueMonth,
      pendingPayables: data.pendingPayables,
      pendingReceivables: data.pendingReceivables,
      myAppointmentsToday: myTodayApts.length,
      myPatientsWeek: new Set(myWeekApts.map(a => a.patientId)).size,
      pendingRecords: myPendingRecords,
      upcomingApts: data.appointments
        .filter(a => {
          // ✅ CORREÇÃO: antes só checava o status, então uma consulta SCHEDULED
          // do passado (nunca atualizada) aparecia como "próxima".
          const isFuture = new Date(a.startTime).getTime() >= now.getTime();
          const isUpcoming = isFuture && (a.status === "SCHEDULED" || a.status === "CONFIRMED");
          if (role === 'DOCTOR') return isUpcoming && a.doctor?.user?.name === myName;
          return isUpcoming;
        })
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
        .slice(0, 5),
    };
  }, [data, user?.name, role]);

  // ── Dados do gráfico: atendimentos dos últimos 7 dias ─────────────────────
  const chartData = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      const dayStr = d.toISOString().split("T")[0];
      return {
        label: d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" }),
        total: data.appointments.filter(a => a.startTime.startsWith(dayStr)).length,
        concluidas: data.appointments.filter(
          a => a.startTime.startsWith(dayStr) && a.status === "COMPLETED"
        ).length,
      };
    });
  }, [data.appointments]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <div className="animate-pulse h-7 w-48 bg-slate-200 rounded-lg" />
          <div className="animate-pulse h-4 w-72 bg-slate-200 rounded-lg" />
        </div>
        <SkeletonKPIRow count={4} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2"><SkeletonChart /></div>
          <SkeletonList rows={4} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Saudação */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Olá, {user?.name}!</h1>
          <p className="text-slate-500 text-sm">
            {role === 'DOCTOR' ? 'Seus atendimentos de hoje.' : role === 'RECEPTIONIST' ? 'Resumo da agenda e pendencias.' : 'Visao geral da clinica.'}
          </p>
        </div>
        <Link href="/agenda" className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Novo Agendamento
        </Link>
      </div>

      {/* KPIs por role */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${role === 'DOCTOR' ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-4`}>
        {role === 'DOCTOR' ? (
          <>
            <StatCard title="Minhas Consultas Hoje" value={stats.myAppointmentsToday} icon={<Calendar size={20} />} trend="Hoje" color="bg-primary-50 text-primary-600" />
            <StatCard title="Pacientes Esta Semana" value={stats.myPatientsWeek} icon={<Users size={20} />} trend="Semana" color="bg-blue-50 text-blue-600" />
            <StatCard title="Prontuarios Pendentes" value={stats.pendingRecords} icon={<Clock size={20} />} trend="Sem evolucao" color="bg-amber-50 text-amber-600" />
          </>
        ) : role === 'RECEPTIONIST' ? (
          <>
            <StatCard title="Consultas Hoje" value={stats.appointmentsToday} icon={<Calendar size={20} />} trend="Todas" color="bg-primary-50 text-primary-600" />
            <StatCard title="Total de Pacientes" value={stats.totalPatients} icon={<Users size={20} />} trend="Cadastrados" color="bg-blue-50 text-blue-600" />
            <StatCard title="A Receber Pendente" value={stats.pendingReceivables} icon={<Wallet size={20} />} trend="Pendentes" color="bg-amber-50 text-amber-600" />
            <StatCard title="Contas a Pagar" value={stats.pendingPayables} icon={<AlertCircle size={20} />} trend="Pendentes" color="bg-red-50 text-red-600" />
          </>
        ) : (
          <>
            <StatCard title="Total de Pacientes" value={stats.totalPatients} icon={<Users size={20} />} trend="Cadastrados" color="bg-blue-50 text-blue-600" />
            <StatCard title="Consultas Hoje" value={stats.appointmentsToday} icon={<Calendar size={20} />} trend="Ver agenda" color="bg-primary-50 text-primary-600" />
            <StatCard title="Receita (Mes)" value={`R$ ${stats.revenueMonth.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={<Wallet size={20} />} trend="Realizado" color="bg-green-50 text-green-600" />
            <StatCard title="Contas a Pagar" value={stats.pendingPayables} icon={<AlertCircle size={20} />} trend="Pendentes" color="bg-red-50 text-red-600" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Gráfico + links rápidos */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <TrendingUp size={18} className="text-primary-600" /> Fluxo de Atendimentos
              </h3>
              <span className="text-xs text-slate-500">Últimos 7 dias</span>
            </div>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis hide allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(27,94,63,0.04)" }}
                    content={({ active, payload }) => {
                      if (active && payload?.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-white p-2.5 shadow-lg border border-cream-200 rounded-lg text-xs">
                            <p className="font-bold text-slate-700 mb-1">{d.label}</p>
                            <p className="text-slate-600">{d.total} atendimento(s)</p>
                            <p className="text-green-600">{d.concluidas} concluído(s)</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="total" fill="#1B5E3F" radius={[4, 4, 0, 0]} name="Total" />
                  <Bar dataKey="concluidas" fill="#7FAE8C" radius={[4, 4, 0, 0]} name="Concluídas" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-4 mt-2 justify-center text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-primary-600 inline-block" /> Total</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-primary-300 inline-block" /> Concluídas</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {role === 'DOCTOR' ? (
              <>
                <QuickLink href="/prontuarios" title="Prontuarios" desc="Acesse evolucoes e historico clinico." icon={<Clock size={20} />} />
                <QuickLink href="/exames" title="Exames" desc="Solicite e acompanhe exames." icon={<Calendar size={20} />} />
              </>
            ) : (
              <>
                <QuickLink href="/pacientes" title="Gerenciar Pacientes" desc="Cadastre novos pacientes e edite dados." icon={<Users size={20} />} />
                <QuickLink href="/financeiro" title="Fluxo de Caixa" desc="Acompanhe entradas e saidas." icon={<Wallet size={20} />} />
              </>
            )}
          </div>
        </div>

        {/* Próximos atendimentos */}
        <div className="card">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Clock size={18} className="text-primary-600" /> {role === 'DOCTOR' ? 'Meus Proximos' : 'Proximos Atendimentos'}
          </h3>
          <div className="space-y-3">
            {stats.upcomingApts.length > 0 ? stats.upcomingApts.map(apt => (
              <Link
                key={apt.id}
                href={`/agenda?date=${new Date(apt.startTime).toISOString().split("T")[0]}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-cream-50 transition-colors border border-transparent hover:border-cream-200 group"
                title="Abrir na agenda"
              >
                <div className="bg-white p-2 rounded-lg shadow-sm font-mono text-[10px] text-center min-w-[52px]">
                  <span className="block font-bold text-primary-700">
                    {new Date(apt.startTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="text-slate-500">
                    {new Date(apt.startTime).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                  </span>
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-bold text-slate-800 truncate">{apt.patient.fullName}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider truncate">{apt.doctor.specialty}</p>
                </div>
                <ArrowRight size={16} className="text-slate-300 group-hover:text-primary-600 transition-colors shrink-0" />
              </Link>
            )) : (
              <p className="text-sm text-slate-500 text-center py-10">Nenhuma consulta agendada.</p>
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

// ── Sub-componentes ───────────────────────────────────────────────────────────

function StatCard({ title, value, icon, trend, color }: any) {
  return (
    <div className="card border-l-4 border-primary-600">
      <div className="flex justify-between items-start mb-2">
        <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
        <span className="text-[10px] font-bold text-slate-500 uppercase">{trend}</span>
      </div>
      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{title}</p>
      <p className="text-2xl font-black text-slate-800 mt-1">{value}</p>
    </div>
  );
}

function QuickLink({ href, title, desc, icon }: any) {
  return (
    <Link href={href} className="card hover:border-primary-300 transition-all group flex items-start gap-4">
      <div className="p-3 bg-slate-50 rounded-xl text-slate-500 group-hover:bg-primary-50 group-hover:text-primary-600 transition-colors">
        {icon}
      </div>
      <div>
        <h4 className="text-sm font-bold text-slate-800 group-hover:text-primary-700 transition-colors">{title}</h4>
        <p className="text-xs text-slate-500 mt-1">{desc}</p>
      </div>
    </Link>
  );
}
