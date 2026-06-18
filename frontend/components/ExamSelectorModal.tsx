"use client";

import { useEffect, useState } from "react";
import { FlaskConical, Search, X, Check, Loader2, PenLine } from "lucide-react";
import {
  createExamOrdersBatch,
  getExamCatalog,
  initSignature,
  type ExamCatalog,
  type ExamOrder,
  type SignatureProvider,
} from "@/lib/api";

interface Props {
  patientId: string;
  doctorId: string;
  patientName: string;
  appointmentId?: string;
  onClose: () => void;
  onCreated?: (orders: ExamOrder[]) => void;
}

export function ExamSelectorModal({
  patientId,
  doctorId,
  patientName,
  appointmentId,
  onClose,
  onCreated,
}: Props) {
  const [catalog, setCatalog] = useState<ExamCatalog[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [createdOrders, setCreatedOrders] = useState<ExamOrder[] | null>(null);
  const [signError, setSignError] = useState("");

  useEffect(() => {
    getExamCatalog()
      .then((data) => setCatalog(data))
      .catch(() => setError("Erro ao carregar catálogo de exames."))
      .finally(() => setLoadingCatalog(false));
  }, []);

  const filtered = catalog.filter(
    (c) => c.isActive && c.name.toLowerCase().includes(search.toLowerCase())
  );

  const selected = catalog.filter((c) => selectedIds.has(c.id));
  const totalPrice = selected.reduce((sum, c) => sum + c.price, 0);

  function toggleExam(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit() {
    if (selectedIds.size === 0) return;
    setSaving(true);
    setError("");
    try {
      const orders = await createExamOrdersBatch({
        patientId,
        doctorId,
        catalogIds: Array.from(selectedIds),
        appointmentId,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        notes: notes || undefined,
      });
      setCreatedOrders(orders);
      onCreated?.(orders);
    } catch (e: any) {
      setError(e?.message ?? "Erro ao solicitar exames.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSign(orderId: string) {
    setSignError("");
    try {
      const provider = (typeof localStorage !== "undefined"
        ? localStorage.getItem("maissaudebr_sig_provider")
        : null) as SignatureProvider | null;
      const { redirectUrl } = await initSignature({
        documentType: "SOLICITACAO",
        referenceId: orderId,
        ...(provider ? { provider } : {}),
      });
      window.location.href = redirectUrl;
    } catch (e: any) {
      setSignError(e?.message ?? "Erro ao iniciar assinatura.");
    }
  }

  if (createdOrders) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <div className="flex items-center gap-2 text-emerald-600">
              <Check size={20} />
              <h2 className="font-semibold text-base">
                {createdOrders.length} exame{createdOrders.length > 1 ? "s" : ""} solicitado{createdOrders.length > 1 ? "s" : ""}
              </h2>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          </div>

          <div className="p-5 space-y-2">
            <p className="text-sm text-slate-500 mb-3">Paciente: {patientName}</p>
            {createdOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">{order.catalog?.name}</p>
                  <p className="text-xs text-slate-500">
                    R$ {order.catalog?.price?.toFixed(2)} &middot;{" "}
                    {order.scheduledAt ? "Agendado" : "Pendente"}
                  </p>
                </div>
                <button
                  onClick={() => handleSign(order.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
                >
                  <PenLine size={13} />
                  Assinar
                </button>
              </div>
            ))}
            {signError && <p className="text-xs text-red-600 mt-2">{signError}</p>}
          </div>

          <div className="flex justify-end p-5 border-t border-slate-100">
            <button
              onClick={onClose}
              className="px-5 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <FlaskConical size={20} className="text-teal-600" />
            <h2 className="font-semibold text-slate-800 text-base">
              Solicitar Exames / Procedimentos
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {/* Patient info */}
        <div className="px-5 pt-4 pb-2 text-sm text-slate-500 shrink-0">
          Paciente: <span className="font-medium text-slate-700">{patientName}</span>
        </div>

        {/* Search */}
        <div className="px-5 pb-3 shrink-0">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar exame ou procedimento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Exam list */}
        <div className="flex-1 overflow-y-auto px-5 min-h-0">
          {loadingCatalog ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-teal-500" />
              <span className="ml-2 text-sm text-slate-500">Carregando catálogo...</span>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">
              {catalog.length === 0
                ? "Nenhum exame cadastrado. Cadastre em Exames e Proced."
                : "Nenhum exame encontrado."}
            </p>
          ) : (
            <div className="space-y-1">
              {filtered.map((exam) => {
                const isSelected = selectedIds.has(exam.id);
                return (
                  <button
                    key={exam.id}
                    type="button"
                    onClick={() => toggleExam(exam.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                      isSelected
                        ? "bg-teal-50 border-2 border-teal-500"
                        : "bg-slate-50 border-2 border-transparent hover:bg-slate-100"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                        isSelected
                          ? "bg-teal-500 border-teal-500"
                          : "border-slate-300"
                      }`}
                    >
                      {isSelected && <Check size={13} className="text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{exam.name}</p>
                      {exam.description && (
                        <p className="text-xs text-slate-500 truncate">{exam.description}</p>
                      )}
                    </div>
                    <span className="text-sm font-medium text-slate-600 shrink-0">
                      R$ {exam.price.toFixed(2)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected summary */}
        {selected.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 bg-teal-50/50 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-teal-800">
                {selected.length} selecionado{selected.length > 1 ? "s" : ""}
              </span>
              <span className="text-sm font-semibold text-teal-800">
                R$ {totalPrice.toFixed(2)}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {selected.map((exam) => (
                <span
                  key={exam.id}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-teal-700 bg-teal-100 rounded-full"
                >
                  {exam.name}
                  <button
                    onClick={() => toggleExam(exam.id)}
                    className="text-teal-500 hover:text-teal-700"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Date + Notes */}
        <div className="px-5 py-3 border-t border-slate-100 space-y-3 shrink-0">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Data/Hora (deixe vazio para Pendente)
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Indicacao clinica / Observacoes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Investigar dor abdominal..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none resize-none"
            />
          </div>
        </div>

        {/* Error + Actions */}
        {error && (
          <div className="px-5 pb-2 shrink-0">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-between p-5 border-t border-slate-100 shrink-0">
          <button
            onClick={onClose}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={selectedIds.size === 0 || saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <FlaskConical size={15} />}
            Solicitar {selectedIds.size > 0 ? `${selectedIds.size} Exame${selectedIds.size > 1 ? "s" : ""}` : "Exames"}
          </button>
        </div>
      </div>
    </div>
  );
}
