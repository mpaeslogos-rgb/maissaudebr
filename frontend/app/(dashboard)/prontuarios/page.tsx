"use client";

import { useEffect, useState } from "react";
import {
  Search, Plus, FileText, Calendar, User,
  Stethoscope, ChevronRight, Loader2, X,
} from "lucide-react";
import Link from "next/link";
import { getMedicalRecords, getPatients, getDoctors, createMedicalRecord } from "@/lib/api";
import { MedicalRecord, Patient, Doctor } from "@/lib/types";

export default function ProntuariosPage() {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showNewModal, setShowNewModal] = useState(false);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await getMedicalRecords({ limit: 100 });
      setRecords(res.data);
    } catch (error) {
      console.error("Erro ao buscar prontuários:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRecords(); }, []);

  const filteredRecords = records.filter(r =>
    r.patient.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.diagnosis?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Prontuários</h1>
          <p className="text-slate-500 text-sm">Histórico clínico e evoluções dos pacientes</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="btn-primary flex items-center gap-2 self-start"
        >
          <Plus size={18} /> Novo Atendimento
        </button>
      </div>

      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="text"
            placeholder="Buscar por paciente ou diagnóstico..."
            className="input pl-10 w-full"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <Loader2 className="animate-spin mb-2" size={32} />
          <p>Carregando histórico clínico...</p>
        </div>
      ) : filteredRecords.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {filteredRecords.map(record => (
            <div key={record.id} className="card hover:border-primary-300 transition-all group">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center text-primary-600 shrink-0">
                    <User size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 group-hover:text-primary-700 transition-colors">
                      {record.patient.fullName}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar size={14} />
                        {new Date(record.createdAt).toLocaleDateString("pt-BR")}
                      </span>
                      <span className="flex items-center gap-1">
                        <Stethoscope size={14} />
                        {record.doctor.user?.name ?? record.doctor.crm}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 md:max-w-xs">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Diagnóstico</div>
                  <p className="text-sm text-slate-600 truncate">{record.diagnosis || "Não informado"}</p>
                </div>

                <Link
                  href={`/prontuarios/${record.id}`}
                  className="btn-outline flex items-center justify-center gap-2"
                >
                  Ver Detalhes <ChevronRight size={16} />
                </Link>
              </div>

              {record.chiefComplaint && (
                <div className="mt-4 p-3 bg-cream-50 rounded-lg border border-cream-100">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Queixa Principal:</p>
                  <p className="text-sm text-slate-700 italic">&quot;{record.chiefComplaint}&quot;</p>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-20 text-center">
          <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
            <FileText size={32} />
          </div>
          <h3 className="text-lg font-medium text-slate-600">Nenhum prontuário encontrado</h3>
          <p className="text-slate-500 text-sm">Tente mudar os termos da busca.</p>
        </div>
      )}

      {showNewModal && (
        <NewProntuarioModal
          onClose={() => setShowNewModal(false)}
          onSaved={() => { setShowNewModal(false); fetchRecords(); }}
        />
      )}
    </div>
  );
}

// ── Modal: Novo Prontuário ────────────────────────────────────────────────────

function NewProntuarioModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [patSearch, setPatSearch] = useState("");
  const [patResults, setPatResults] = useState<Patient[]>([]);
  const [showPatDrop, setShowPatDrop] = useState(false);
  const [selectedPat, setSelectedPat] = useState<Patient | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [form, setForm] = useState({
    chiefComplaint: "", historyOfIllness: "", diagnosis: "",
    prescription: "", observations: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getDoctors({ limit: 100 })
      .then(r => setDoctors(r.data.filter(d => d.user?.isActive)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!patSearch.trim() || selectedPat) { setPatResults([]); setShowPatDrop(false); return; }
    const t = setTimeout(async () => {
      try {
        const res = await getPatients({ search: patSearch.trim(), limit: 8 });
        setPatResults(res.data);
        setShowPatDrop(res.data.length > 0);
      } catch { setPatResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [patSearch, selectedPat]);

  async function handleSave() {
    if (!selectedPat) return setError("Selecione um paciente.");
    if (!doctorId) return setError("Selecione um médico responsável.");
    setSaving(true); setError("");
    try {
      await createMedicalRecord({ ...form, patientId: selectedPat.id, doctorId });
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-surface-border sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold text-slate-800">Novo Atendimento / Prontuário</h2>
          <button onClick={onClose} className="p-1 hover:bg-cream-100 rounded-lg">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
          )}

          {/* Busca de paciente */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Paciente <span className="text-red-500">*</span>
            </label>
            {selectedPat ? (
              <div className="input bg-cream-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">
                    {selectedPat.fullName.charAt(0)}
                  </div>
                  <div>
                    <span className="text-sm font-semibold">{selectedPat.fullName}</span>
                    <span className="text-xs text-slate-500 ml-2">{selectedPat.cpf}</span>
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedPat(null); setPatSearch(""); }}
                  className="text-xs text-slate-500 hover:text-red-500"
                >
                  Trocar
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  type="text"
                  placeholder="Buscar por nome ou CPF..."
                  value={patSearch}
                  onChange={e => setPatSearch(e.target.value)}
                  onFocus={() => patResults.length > 0 && setShowPatDrop(true)}
                  className="input pl-9 w-full"
                  autoFocus
                />
                {showPatDrop && patResults.length > 0 && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowPatDrop(false)} />
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-cream-200 rounded-xl shadow-lg z-20 overflow-hidden">
                      {patResults.map(p => (
                        <button
                          key={p.id}
                          onClick={() => { setSelectedPat(p); setShowPatDrop(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-cream-50 text-left border-b border-cream-50 last:border-0"
                        >
                          <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center shrink-0">
                            {p.fullName.charAt(0)}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-slate-800">{p.fullName}</div>
                            <div className="text-xs text-slate-500">{p.cpf}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Médico */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Médico Responsável <span className="text-red-500">*</span>
            </label>
            <select value={doctorId} onChange={e => setDoctorId(e.target.value)} className="input w-full">
              <option value="">Selecione um médico</option>
              {doctors.map(d => (
                <option key={d.id} value={d.id}>Dr(a). {d.user?.name} — {d.specialty}</option>
              ))}
            </select>
          </div>

          <hr className="border-cream-200" />

          {/* Campos clínicos */}
          {[
            { name: "chiefComplaint", label: "Queixa Principal", rows: 2 },
            { name: "historyOfIllness", label: "História da Doença Atual", rows: 2 },
            { name: "diagnosis", label: "Diagnóstico (CID)", rows: 2 },
            { name: "prescription", label: "Prescrição / Conduta", rows: 4 },
            { name: "observations", label: "Observações", rows: 2 },
          ].map(f => (
            <div key={f.name}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{f.label}</label>
              <textarea
                value={form[f.name as keyof typeof form]}
                onChange={e => setForm(prev => ({ ...prev, [f.name]: e.target.value }))}
                rows={f.rows}
                className="input resize-none w-full"
                placeholder={`${f.label}…`}
              />
            </div>
          ))}

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="btn-outline">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? "Salvando…" : "Salvar Prontuário"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
