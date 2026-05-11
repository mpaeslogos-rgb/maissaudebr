"use client";

import { useEffect, useState } from "react";
import { 
  Search, Plus, FileText, Calendar, User, 
  Stethoscope, ChevronRight, Loader2, ClipboardList 
} from "lucide-react";
import Link from "next/link";
import { getMedicalRecords } from "@/lib/api"; // ✅ Apenas o plural aqui
import { MedicalRecord } from "@/lib/types";

export default function ProntuariosPage() {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

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

  useEffect(() => {
    fetchRecords();
  }, []);

  const filteredRecords = records.filter(r => 
    r.patient.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.diagnosis?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">🩺 Prontuários</h1>
          <p className="text-slate-500 text-sm">Histórico clínico e evoluções dos pacientes</p>
        </div>
        <Link href="/agenda" className="btn-primary flex items-center gap-2 self-start">
          <Plus size={18} /> Novo Atendimento
        </Link>
      </div>

      <div className="card p-4 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Buscar por paciente ou diagnóstico..."
            className="input pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="btn-outline flex items-center gap-2">
          <ClipboardList size={18} /> Todos os Pacientes
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <Loader2 className="animate-spin mb-2" size={32} />
          <p>Carregando histórico clínico...</p>
        </div>
      ) : filteredRecords.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {filteredRecords.map((record) => (
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
                        {new Date(record.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Stethoscope size={14} /> 
                        {record.doctor.user?.name ?? record.doctor.crm}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 md:max-w-xs">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Diagnóstico</div>
                  <p className="text-sm text-slate-600 truncate">
                    {record.diagnosis || "Não informado"}
                  </p>
                </div>

                <Link 
                  href={`/prontuarios/${record.id}`}
                  className="btn-outline flex items-center justify-center gap-2"
                >
                  Ver Detalhes <ChevronRight size={16} />
                </Link>
              </div>
              
              <div className="mt-4 p-3 bg-cream-50 rounded-lg border border-cream-100">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Queixa Principal:</p>
                <p className="text-sm text-slate-700 italic">&quot;{record.chiefComplaint}&quot;</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-20 text-center">
          <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
            <FileText size={32} />
          </div>
          <h3 className="text-lg font-medium text-slate-600">Nenhum prontuário encontrado</h3>
          <p className="text-slate-400 text-sm">Tente mudar os termos da busca.</p>
        </div>
      )}
    </div>
  );
}