"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPatch, apiDelete, getPatients } from "@/lib/api";
import { Plus, ChevronDown, ChevronUp, Users, Activity, X, CheckCircle, Clock, Calendar } from "lucide-react";

interface Program {
  id: string;
  name: string;
  description?: string;
  durationDays: number;
  monthlyFee: number;
  entryFee: number;
  clinicScope?: string;
  isActive: boolean;
  _count?: { enrollments: number };
}

interface Patient { id: string; fullName: string; phone: string }

interface Enrollment {
  id: string;
  patientId: string;
  programId: string;
  startDate: string;
  endDate?: string;
  status: string;
  journeyStage: string;
  monthlyFee: number;
  nextBillingDate: string;
  cancelReason?: string;
  cancelledAt?: string;
  notes?: string;
  patient: Patient;
  program: { id: string; name: string; durationDays: number };
  _count?: { payments: number };
}

interface CheckIn {
  id: string;
  patientId: string;
  enrollmentId: string;
  scheduledAt: string;
  completedAt?: string;
  type: string;
  notes?: string;
  patient: { id: string; fullName: string };
  enrollment: { program: { id: string; name: string } };
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s: string) => new Date(s).toLocaleDateString("pt-BR");
const fmtDatetime = (s: string) => new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativo", PAUSED: "Pausado", CANCELLED: "Cancelado", COMPLETED: "Concluído",
};
const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  PAUSED: "bg-yellow-100 text-yellow-800",
  CANCELLED: "bg-red-100 text-red-800",
  COMPLETED: "bg-blue-100 text-blue-800",
};

const JOURNEY_LABELS: Record<string, string> = {
  ONBOARDING: "Onboarding",
  ACTIVE:     "Ativo",
  AT_RISK:    "Em Risco",
  COMPLETED:  "Concluído",
  CHURNED:    "Churned",
};
const JOURNEY_COLOR: Record<string, string> = {
  ONBOARDING: "bg-purple-100 text-purple-700",
  ACTIVE:     "bg-emerald-100 text-emerald-700",
  AT_RISK:    "bg-orange-100 text-orange-700",
  COMPLETED:  "bg-blue-100 text-blue-700",
  CHURNED:    "bg-slate-100 text-slate-500",
};

const CHECKIN_LABELS: Record<string, string> = {
  INITIAL_ASSESSMENT: "Avaliação inicial",
  MONTHLY_REVIEW:     "Revisão mensal",
  METABOLIC_REVIEW:   "Revisão metabólica",
  LAB_RESULTS:        "Resultados de exames",
  FOLLOWUP:           "Acompanhamento",
};

export default function ProgramasPage() {
  const [programs, setPrograms]       = useState<Program[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [checkIns, setCheckIns]       = useState<CheckIn[]>([]);
  const [patients, setPatients]       = useState<Patient[]>([]);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState<"programs" | "enrollments" | "checkins">("programs");
  const [expanded, setExpanded]       = useState<string | null>(null);

  // Modais
  const [showProgramForm, setShowProgramForm]   = useState(false);
  const [showEnrollForm, setShowEnrollForm]     = useState(false);
  const [showCancelModal, setShowCancelModal]   = useState<Enrollment | null>(null);
  const [showCheckInForm, setShowCheckInForm]   = useState(false);
  const [editProgram, setEditProgram]           = useState<Program | null>(null);
  const [cancelReason, setCancelReason]         = useState("");

  // Form program
  const [pForm, setPForm] = useState({ name: "", description: "", durationDays: 90, monthlyFee: 97, entryFee: 0, clinicScope: "" });
  // Form enrollment
  const [eForm, setEForm] = useState({ patientId: "", programId: "", startDate: new Date().toISOString().slice(0, 10), monthlyFee: "", notes: "" });
  // Form check-in
  const [ciForm, setCiForm] = useState({ enrollmentId: "", patientId: "", scheduledAt: new Date().toISOString().slice(0, 16), type: "MONTHLY_REVIEW", notes: "" });

  const load = async () => {
    setLoading(true);
    const [p, e, ci, pa] = await Promise.all([
      apiGet<Program[]>("/preventivo-programs"),
      apiGet<Enrollment[]>("/patient-enrollments"),
      apiGet<CheckIn[]>("/check-ins"),
      getPatients({ limit: 500 }),
    ]);
    setPrograms(p);
    setEnrollments(e);
    setCheckIns(ci);
    setPatients(pa.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const saveProgram = async () => {
    if (editProgram) {
      await apiPatch(`/preventivo-programs/${editProgram.id}`, pForm);
    } else {
      await apiPost("/preventivo-programs", pForm);
    }
    setShowProgramForm(false);
    setEditProgram(null);
    setPForm({ name: "", description: "", durationDays: 90, monthlyFee: 97, entryFee: 0, clinicScope: "" });
    load();
  };

  const openEditProgram = (p: Program) => {
    setEditProgram(p);
    setPForm({ name: p.name, description: p.description ?? "", durationDays: p.durationDays, monthlyFee: p.monthlyFee, entryFee: p.entryFee, clinicScope: p.clinicScope ?? "" });
    setShowProgramForm(true);
  };

  const saveEnrollment = async () => {
    const prog = programs.find(p => p.id === eForm.programId);
    await apiPost("/patient-enrollments", {
      ...eForm,
      monthlyFee: eForm.monthlyFee ? parseFloat(eForm.monthlyFee) : (prog?.monthlyFee ?? 97),
    });
    setShowEnrollForm(false);
    setEForm({ patientId: "", programId: "", startDate: new Date().toISOString().slice(0, 10), monthlyFee: "", notes: "" });
    load();
  };

  const billEnrollment = async (id: string) => {
    await apiPost(`/patient-enrollments/${id}/bill`, {});
    alert("Cobrança gerada com sucesso!");
    load();
  };

  const updateEnrollmentStatus = async (id: string, status: string, extra?: object) => {
    await apiPatch(`/patient-enrollments/${id}`, { status, ...extra });
    load();
  };

  const updateJourneyStage = async (id: string, journeyStage: string) => {
    await apiPatch(`/patient-enrollments/${id}`, { journeyStage });
    load();
  };

  const confirmCancel = async () => {
    if (!showCancelModal) return;
    await apiPatch(`/patient-enrollments/${showCancelModal.id}`, {
      status: "CANCELLED",
      cancelReason: cancelReason || undefined,
    });
    setShowCancelModal(null);
    setCancelReason("");
    load();
  };

  const saveCheckIn = async () => {
    const enrollment = enrollments.find(e => e.id === ciForm.enrollmentId);
    await apiPost("/check-ins", {
      ...ciForm,
      patientId: enrollment?.patientId ?? ciForm.patientId,
    });
    setShowCheckInForm(false);
    setCiForm({ enrollmentId: "", patientId: "", scheduledAt: new Date().toISOString().slice(0, 16), type: "MONTHLY_REVIEW", notes: "" });
    load();
  };

  const completeCheckIn = async (id: string) => {
    await apiPatch(`/check-ins/${id}`, { completedAt: new Date().toISOString() });
    load();
  };

  const deleteCheckIn = async (id: string) => {
    if (!confirm("Remover check-in?")) return;
    await apiDelete(`/check-ins/${id}`);
    load();
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Carregando...</div>;

  const activeEnrollments = enrollments.filter(e => e.status === "ACTIVE");
  const pendingCheckIns   = checkIns.filter(c => !c.completedAt);
  const doneCheckIns      = checkIns.filter(c => c.completedAt);
  const adhesionPct       = checkIns.length > 0 ? Math.round((doneCheckIns.length / checkIns.length) * 100) : null;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Programas Preventivos</h1>
          <p className="text-sm text-gray-500 mt-1">Modelo de assinatura para medicina preventiva longitudinal</p>
        </div>
        <div className="flex gap-2">
          {tab === "checkins" && (
            <button onClick={() => setShowCheckInForm(true)} className="flex items-center gap-1 px-3 py-2 text-sm bg-white border border-teal-600 text-teal-600 rounded-lg hover:bg-teal-50">
              <Calendar size={16} /> Agendar Check-in
            </button>
          )}
          <button onClick={() => setShowEnrollForm(true)} className="flex items-center gap-1 px-3 py-2 text-sm bg-white border border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50">
            <Users size={16} /> Matricular Paciente
          </button>
          <button onClick={() => { setEditProgram(null); setShowProgramForm(true); }} className="flex items-center gap-1 px-3 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">
            <Plus size={16} /> Novo Programa
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {[
          { label: "Programas ativos", value: programs.filter(p => p.isActive).length.toString() },
          { label: "Matrículas ativas", value: activeEnrollments.length.toString() },
          { label: "MRR estimado", value: fmt(activeEnrollments.reduce((s, e) => s + e.monthlyFee, 0)) },
          { label: "Pacientes no programa", value: new Set(activeEnrollments.map(e => e.patientId)).size.toString() },
          { label: "Adesão check-ins", value: adhesionPct !== null ? `${adhesionPct}%` : "—" },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500">{k.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {(["programs", "enrollments", "checkins"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t ? "border-primary-600 text-primary-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t === "programs" ? "Programas" : t === "enrollments" ? "Matrículas" : `Check-ins${pendingCheckIns.length > 0 ? ` (${pendingCheckIns.length} pendentes)` : ""}`}
          </button>
        ))}
      </div>

      {/* Tab Programas */}
      {tab === "programs" && (
        <div className="space-y-4">
          {programs.length === 0 && <p className="text-gray-500 text-center py-12">Nenhum programa cadastrado.</p>}
          {programs.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-10 rounded-full ${p.isActive ? "bg-primary-500" : "bg-gray-300"}`} />
                  <div>
                    <p className="font-semibold text-gray-900">{p.name}</p>
                    <p className="text-sm text-gray-500">{p.durationDays} dias · {fmt(p.monthlyFee)}/mês{p.entryFee > 0 ? ` · Entrada ${fmt(p.entryFee)}` : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500 hidden md:block"><Activity size={14} className="inline mr-1" />{p._count?.enrollments ?? 0} ativos</span>
                  {expanded === p.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>
              {expanded === p.id && (
                <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-3">
                  {p.description && <p className="text-sm text-gray-600">{p.description}</p>}
                  {p.clinicScope && <p className="text-sm text-gray-600"><span className="font-medium">Escopo clínico:</span> {p.clinicScope}</p>}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => openEditProgram(p)} className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-white">Editar</button>
                    <button onClick={async () => { await apiPatch(`/preventivo-programs/${p.id}`, { isActive: !p.isActive }); load(); }}
                      className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-white">
                      {p.isActive ? "Desativar" : "Ativar"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tab Matrículas */}
      {tab === "enrollments" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Paciente</th>
                <th className="px-4 py-3 text-left">Programa</th>
                <th className="px-4 py-3 text-left">Início</th>
                <th className="px-4 py-3 text-left">Jornada</th>
                <th className="px-4 py-3 text-right">Mensalidade</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {enrollments.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-gray-500">Nenhuma matrícula encontrada.</td></tr>
              )}
              {enrollments.map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{e.patient.fullName}</td>
                  <td className="px-4 py-3 text-gray-600">{e.program.name}</td>
                  <td className="px-4 py-3 text-gray-600">{fmtDate(e.startDate)}</td>
                  <td className="px-4 py-3">
                    {e.status === "ACTIVE" || e.status === "PAUSED" ? (
                      <select
                        className={`text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer ${JOURNEY_COLOR[e.journeyStage ?? "ONBOARDING"]}`}
                        value={e.journeyStage ?? "ONBOARDING"}
                        onChange={ev => updateJourneyStage(e.id, ev.target.value)}
                      >
                        {Object.entries(JOURNEY_LABELS).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${JOURNEY_COLOR[e.journeyStage ?? "CHURNED"]}`}>
                        {JOURNEY_LABELS[e.journeyStage ?? "CHURNED"]}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">{fmt(e.monthlyFee)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[e.status]}`}>{STATUS_LABELS[e.status]}</span>
                    {e.cancelReason && <p className="text-xs text-gray-400 mt-0.5">{e.cancelReason}</p>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {e.status === "ACTIVE" && (
                        <button onClick={() => billEnrollment(e.id)} className="text-xs text-primary-600 hover:underline">Cobrar</button>
                      )}
                      {e.status === "ACTIVE" && (
                        <button onClick={() => updateEnrollmentStatus(e.id, "PAUSED")} className="text-xs text-yellow-600 hover:underline">Pausar</button>
                      )}
                      {e.status === "PAUSED" && (
                        <button onClick={() => updateEnrollmentStatus(e.id, "ACTIVE")} className="text-xs text-green-600 hover:underline">Reativar</button>
                      )}
                      {(e.status === "ACTIVE" || e.status === "PAUSED") && (
                        <button onClick={() => { setShowCancelModal(e); setCancelReason(""); }} className="text-xs text-red-500 hover:underline">Cancelar</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab Check-ins */}
      {tab === "checkins" && (
        <div className="space-y-6">
          {/* Pendentes */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Clock size={14} className="text-orange-500" /> Pendentes ({pendingCheckIns.length})
            </h3>
            {pendingCheckIns.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">Nenhum check-in pendente.</p>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Paciente</th>
                      <th className="px-4 py-3 text-left">Programa</th>
                      <th className="px-4 py-3 text-left">Tipo</th>
                      <th className="px-4 py-3 text-left">Agendado para</th>
                      <th className="px-4 py-3 text-left">Obs.</th>
                      <th className="px-4 py-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pendingCheckIns.map(c => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{c.patient.fullName}</td>
                        <td className="px-4 py-3 text-gray-600">{c.enrollment.program.name}</td>
                        <td className="px-4 py-3 text-gray-600">{CHECKIN_LABELS[c.type]}</td>
                        <td className="px-4 py-3 text-gray-600">{fmtDatetime(c.scheduledAt)}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px] truncate">{c.notes || "—"}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => completeCheckIn(c.id)} className="text-xs text-green-600 hover:underline flex items-center gap-1">
                              <CheckCircle size={12} /> Concluir
                            </button>
                            <button onClick={() => deleteCheckIn(c.id)} className="text-xs text-red-400 hover:underline">Excluir</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Concluídos */}
          {doneCheckIns.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <CheckCircle size={14} className="text-green-500" /> Concluídos ({doneCheckIns.length})
              </h3>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Paciente</th>
                      <th className="px-4 py-3 text-left">Programa</th>
                      <th className="px-4 py-3 text-left">Tipo</th>
                      <th className="px-4 py-3 text-left">Agendado</th>
                      <th className="px-4 py-3 text-left">Concluído</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {doneCheckIns.map(c => (
                      <tr key={c.id} className="hover:bg-gray-50 opacity-75">
                        <td className="px-4 py-3 text-gray-700">{c.patient.fullName}</td>
                        <td className="px-4 py-3 text-gray-500">{c.enrollment.program.name}</td>
                        <td className="px-4 py-3 text-gray-500">{CHECKIN_LABELS[c.type]}</td>
                        <td className="px-4 py-3 text-gray-500">{fmtDatetime(c.scheduledAt)}</td>
                        <td className="px-4 py-3 text-green-600">{c.completedAt ? fmtDatetime(c.completedAt) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Programa */}
      {showProgramForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">{editProgram ? "Editar Programa" : "Novo Programa Preventivo"}</h2>
              <button onClick={() => { setShowProgramForm(false); setEditProgram(null); }}><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do programa *</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={pForm.name} onChange={e => setPForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Programa Metabólico 90 dias" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={2} value={pForm.description} onChange={e => setPForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duração (dias) *</label>
                  <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={pForm.durationDays} onChange={e => setPForm(f => ({ ...f, durationDays: +e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mensalidade (R$) *</label>
                  <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={pForm.monthlyFee} onChange={e => setPForm(f => ({ ...f, monthlyFee: +e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Entrada (R$)</label>
                  <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={pForm.entryFee} onChange={e => setPForm(f => ({ ...f, entryFee: +e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Escopo clínico</label>
                <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={2} value={pForm.clinicScope} onChange={e => setPForm(f => ({ ...f, clinicScope: e.target.value }))} placeholder="Ex: Adultos 30–50 anos com risco metabólico..." />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => { setShowProgramForm(false); setEditProgram(null); }} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancelar</button>
              <button onClick={saveProgram} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Matrícula */}
      {showEnrollForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Matricular Paciente</h2>
              <button onClick={() => setShowEnrollForm(false)}><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Paciente *</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={eForm.patientId} onChange={e => setEForm(f => ({ ...f, patientId: e.target.value }))}>
                  <option value="">Selecionar...</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Programa *</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={eForm.programId} onChange={e => setEForm(f => ({ ...f, programId: e.target.value }))}>
                  <option value="">Selecionar...</option>
                  {programs.filter(p => p.isActive).map(p => <option key={p.id} value={p.id}>{p.name} — {fmt(p.monthlyFee)}/mês</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data de início *</label>
                  <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={eForm.startDate} onChange={e => setEForm(f => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mensalidade (R$)</label>
                  <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={eForm.monthlyFee} onChange={e => setEForm(f => ({ ...f, monthlyFee: e.target.value }))} placeholder="Padrão do programa" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={2} value={eForm.notes} onChange={e => setEForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowEnrollForm(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancelar</button>
              <button onClick={saveEnrollment} disabled={!eForm.patientId || !eForm.programId} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">Matricular</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cancelamento com motivo */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-red-600">Cancelar Matrícula</h2>
              <button onClick={() => setShowCancelModal(null)}><X size={20} /></button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Você está cancelando a matrícula de <strong>{showCancelModal.patient.fullName}</strong> no programa <strong>{showCancelModal.program.name}</strong>. Esta ação não pode ser desfeita.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Motivo do cancelamento</label>
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                rows={3}
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="Ex: Paciente solicitou cancelamento por motivo financeiro..."
              />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCancelModal(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Voltar</button>
              <button onClick={confirmCancel} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Confirmar cancelamento</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Check-in */}
      {showCheckInForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Agendar Check-in</h2>
              <button onClick={() => setShowCheckInForm(false)}><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Matrícula *</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={ciForm.enrollmentId}
                  onChange={e => {
                    const enroll = enrollments.find(en => en.id === e.target.value);
                    setCiForm(f => ({ ...f, enrollmentId: e.target.value, patientId: enroll?.patientId ?? "" }));
                  }}
                >
                  <option value="">Selecionar...</option>
                  {enrollments.filter(e => e.status === "ACTIVE").map(e => (
                    <option key={e.id} value={e.id}>{e.patient.fullName} — {e.program.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={ciForm.type} onChange={e => setCiForm(f => ({ ...f, type: e.target.value }))}>
                  {Object.entries(CHECKIN_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data e hora *</label>
                <input type="datetime-local" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={ciForm.scheduledAt} onChange={e => setCiForm(f => ({ ...f, scheduledAt: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={2} value={ciForm.notes} onChange={e => setCiForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCheckInForm(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancelar</button>
              <button onClick={saveCheckIn} disabled={!ciForm.enrollmentId} className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">Agendar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
