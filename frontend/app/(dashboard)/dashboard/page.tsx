"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Users, Calendar, Wallet, AlertCircle,
  ArrowRight, Plus, Clock, TrendingUp, Loader2, X,
} from "lucide-react";
import { SkeletonKPIRow, SkeletonChart, SkeletonList } from "@/components/Skeleton";
import Link from "next/link";
import {
  getPatients,
  getAppointments,
  getPayments,
  getAccountsPayable,
} from "@/lib/api";
import { Appointment } from "@/lib/types";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Agendada", CONFIRMED: "Confirmada", IN_PROGRESS: "Em atendimento",
  COMPLETED: "Concluída", CANCELLED: "Cancelada", NO_SHOW: "Não compareceu",
};
const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "bg-yellow-100 text-yellow-800 border-yellow-300",
  CONFIRMED: "bg-primary-100 text-primary-800 border-primary-300",
  IN_PROGRESS: "bg-blue-100 text-blue-800 border-blue-300",
  COMPLETED: "bg-green-100 text-green-800 border-green-300",
  CANCELLED: "bg-red-100 text-red-700 border-red-300",
  NO_SHOW: "bg-slate-100 text-slate-600 border-slate-300",
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState({
    patients: [] as any[],
    appointments: [] as Appointment[],
    payments: [] as any[],
    payables: [] as any[],
  });
  const [loading, setLoading] = useState(true);
  const [aptDetail, setAptDetail] = useState<Appointment | null>(null);

  useEffect(() => {
    async function loadDashboardData() {
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
        console.error("Erro ao carregar dashboard:", err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return {
      totalPatients: data.patients.length,
      appointmentsToday: data.appointments.filter(a => a.startTime.startsWith(today)).length,
      revenueMonth: data.payments
        .filter((p: any) => p.status === "PAID")
        .reduce((acc: number, curr: any) => acc + Number(curr.amount), 0),
      pendingPayables: data.payables.filter((p: any) => p.status === "PENDING").length,
      upcomingApts: data.appointments
        .filter(a => a.status === "SCHEDULED" || a.status === "CONFIRMED")
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
        .slice(0, 5),
    };
  }, [data]);

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
          <p className="text-slate-500 text-sm">Aqui está o que está acontecendo na clínica hoje.</p>
        </div>
        <Link href="/agenda" className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Novo Agendamento
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total de Pacientes" value={stats.totalPatients} icon={<Users size={20} />} trend="+2 este mês" color="bg-blue-50 text-blue-600" />
        <StatCard title="Consultas Hoje" value={stats.appointmentsToday} icon={<Calendar size={20} />} trend="Ver agenda" color="bg-primary-50 text-primary-600" />
        <StatCard title="Receita (Mês)" value={`R$ ${stats.revenueMonth.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={<Wallet size={20} />} trend="Realizado" color="bg-green-50 text-green-600" />
        <StatCard title="Contas a Pagar" value={stats.pendingPayables} icon={<AlertCircle size={20} />} trend="Pendentes" color="bg-red-50 text-red-600" />
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
            <QuickLink href="/pacientes" title="Gerenciar Pacientes" desc="Cadastre novos pacientes e edite dados." icon={<Users size={20} />} />
            <QuickLink href="/financeiro" title="Fluxo de Caixa" desc="Acompanhe entradas e saídas." icon={<Wallet size={20} />} />
          </div>
        </div>

        {/* Próximos atendimentos */}
        <div className="card">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Clock size={18} className="text-primary-600" /> Próximos Atendimentos
          </h3>
          <div className="space-y-3">
            {stats.upcomingApts.length > 0 ? stats.upcomingApts.map(apt => (
              <div
                key={apt.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-cream-50 transition-colors border border-transparent hover:border-cream-200 group"
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
                <button
                  onClick={() => setAptDetail(apt)}
                  className="text-slate-300 group-hover:text-primary-600 transition-colors p-1 hover:bg-primary-50 rounded"
                  title="Ver detalhes"
                >
                  <ArrowRight size={16} />
                </button>
              </div>
            )) : (
              <p className="text-sm text-slate-500 text-center py-10">Nenhuma consulta agendada.</p>
            )}
          </div>
          <Link href="/agenda" className="block text-center text-xs text-primary-600 font-bold mt-6 hover:underline">
            Ver agenda completa
          </Link>
        </div>
      </div>

      {/* Modal de detalhe da consulta */}
      {aptDetail && (
        <AptDetailModal apt={aptDetail} onClose={() => setAptDetail(null)} />
      )}
    </div>
  );
}

// ── Modal de detalhe ──────────────────────────────────────────────────────────

function AptDetailModal({ apt, onClose }: { apt: Appointment; onClose: () => void }) {
  const start = new Date(apt.startTime);
  const end = new Date(apt.endTime);
  const durMin = Math.round((end.getTime() - start.getTime()) / 60_000);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-surface-border">
          <h2 className="font-semibold text-slate-800">Detalhes da Consulta</h2>
          <button onClick={onClose} className="p-1 hover:bg-cream-100 rounded-lg">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[apt.status] ?? ""}`}>
            {STATUS_LABELS[apt.status] ?? apt.status}
          </span>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center shrink-0">
              {apt.patient.fullName.charAt(0)}
            </div>
            <div>
              <div className="font-semibold text-slate-800">{apt.patient.fullName}</div>
              {apt.patient.phone && <div className="text-xs text-slate-500">{apt.patient.phone}</div>}
            </div>
          </div>

          <div className="space-y-2 text-sm divide-y divide-cream-100">
            <InfoRow label="Data / Hora" value={start.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })} />
            <InfoRow label="Duração" value={`${durMin} min`} />
            <InfoRow label="Médico" value={`Dr(a). ${apt.doctor.user.name}`} />
            <InfoRow label="Especialidade" value={apt.doctor.specialty} />
            {apt.reason && <InfoRow label="Motivo" value={apt.reason} />}
          </div>
        </div>

        <div className="p-5 border-t border-surface-border flex gap-2">
          <button onClick={onClose} className="btn-outline flex-1 text-sm">Fechar</button>
          <Link href="/agenda" onClick={onClose} className="btn-primary flex-1 text-sm text-center flex items-center justify-center">
            Abrir na Agenda
          </Link>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 first:pt-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800 text-right max-w-[180px] truncate">{value}</span>
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
