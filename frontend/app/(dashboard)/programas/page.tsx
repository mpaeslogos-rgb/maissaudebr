"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPatch, getPatients } from "@/lib/api";
import { Plus, ChevronDown, ChevronUp, Users, Activity, X } from "lucide-react";

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
  monthlyFee: number;
  nextBillingDate: string;
  notes?: string;
  patient: Patient;
  program: { id: string; name: string; durationDays: number };
  _count?: { payments: number };
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s: string) => new Date(s).toLocaleDateString("pt-BR");

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativo", PAUSED: "Pausado", CANCELLED: "Cancelado", COMPLETED: "Concluído",
};
const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  PAUSED: "bg-yellow-100 text-yellow-800",
  CANCELLED: "bg-red-100 text-red-800",
  COMPLETED: "bg-blue-100 text-blue-800",
};

export default function ProgramasPage() {
  const [programs, setPrograms]       = useState<Program[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [patients, setPatients]       = useState<Patient[]>([]);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState<"programs" | "enrollments">("programs");
  const [expanded, setExpanded]       = useState<string | null>(null);

  // Modais
  const [showProgramForm, setShowProgramForm] = useState(false);
  const [showEnrollForm, setShowEnrollForm]   = useState(false);
  const [editProgram, setEditProgram]         = useState<Program | null>(null);

  // Form program
  const [pForm, setPForm] = useState({ name: "", description: "", durationDays: 90, monthlyFee: 97, entryFee: 0, clinicScope: "" });
  // Form enrollment
  const [eForm, setEForm] = useState({ patientId: "", programId: "", startDate: new Date().toISOString().slice(0, 10), monthlyFee: "", notes: "" });

  const load = async () => {
    setLoading(true);
    const [p, e, pa] = await Promise.all([
      apiGet<Program[]>("/preventivo-programs"),
      apiGet<Enrollment[]>("/patient-enrollments"),
      getPatients({ limit: 500 }),
    ]);
    setPrograms(p);
    setEnrollments(e);
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

  const updateEnrollmentStatus = async (id: string, status: string) => {
    await apiPatch(`/patient-enrollments/${id}`, { status });
    load();
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Carregando...</div>;

  const activeEnrollments = enrollments.filter(e => e.status === "ACTIVE");

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Programas Preventivos</h1>
          <p className="text-sm text-gray-500 mt-1">Modelo de assinatura para medicina preventiva longitudinal</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowEnrollForm(true)} className="flex items-center gap-1 px-3 py-2 text-sm bg-white border border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50">
            <Users size={16} /> Matricular Paciente
          </button>
          <button onClick={() => { setEditProgram(null); setShowProgramForm(true); }} className="flex items-center gap-1 px-3 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">
            <Plus size={16} /> Novo Programa
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Programas ativos", value: programs.filter(p => p.isActive).length.toString() },
          { label: "Matrículas ativas", value: activeEnrollments.length.toString() },
          { label: "MRR estimado", value: fmt(activeEnrollments.reduce((s, e) => s + e.monthlyFee, 0)) },
          { label: "Pacientes no programa", value: new Set(activeEnrollments.map(e => e.patientId)).size.toString() },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500">{k.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {(["programs", "enrollments"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t ? "border-primary-600 text-primary-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t === "programs" ? "Programas" : "Matrículas"}
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
                <th className="px-4 py-3 text-left">Próx. Cobrança</th>
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
                  <td className="px-4 py-3 text-gray-600">{fmtDate(e.nextBillingDate)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{fmt(e.monthlyFee)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[e.status]}`}>{STATUS_LABELS[e.status]}</span>
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
                        <button onClick={() => { if (confirm("Cancelar matrícula?")) updateEnrollmentStatus(e.id, "CANCELLED"); }} className="text-xs text-red-500 hover:underline">Cancelar</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
                <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={2} value={pForm.clinicScope} onChange={e => setPForm(f => ({ ...f, clinicScope: e.target.value }))} placeholder="Ex: Adultos 30–50 anos com risco metabólico e cardiometabólico..." />
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
    </div>
  );
}
