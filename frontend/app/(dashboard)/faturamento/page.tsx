"use client";

import { useEffect, useState, useMemo } from "react";
import {
  FileText, Plus, Download, Trash2, CheckCircle, XCircle,
  ChevronDown, ChevronUp, Loader2, AlertCircle, RefreshCw,
  Package, ClipboardList,
} from "lucide-react";
import {
  getInsurancePlans,
  getGuias, createGuiaFromAppointment, updateGuia, deleteGuia,
  getLotes, createLote, updateLote, deleteLote,
  getConsultasElegiveis, downloadXmlTiss,
  type InsurancePlan, type GuiaFaturamento, type LoteFaturamento,
  type GuiaStatus, type LoteStatus,
} from "@/lib/api";

// ─── Constantes ───────────────────────────────────────────────────────────────

const GUIA_STATUS_LABEL: Record<GuiaStatus, string> = {
  PENDENTE:   "Pendente",
  AUTORIZADA: "Autorizada",
  NEGADA:     "Negada",
  FATURADA:   "Faturada",
  PAGA:       "Paga",
  GLOSADA:    "Glosada",
};

const GUIA_STATUS_COLOR: Record<GuiaStatus, string> = {
  PENDENTE:   "bg-yellow-100 text-yellow-800 border-yellow-300",
  AUTORIZADA: "bg-blue-100 text-blue-800 border-blue-300",
  NEGADA:     "bg-red-100 text-red-700 border-red-300",
  FATURADA:   "bg-purple-100 text-purple-800 border-purple-300",
  PAGA:       "bg-green-100 text-green-800 border-green-300",
  GLOSADA:    "bg-orange-100 text-orange-800 border-orange-300",
};

const LOTE_STATUS_LABEL: Record<LoteStatus, string> = {
  ABERTO:    "Aberto",
  FECHADO:   "Fechado",
  ENVIADO:   "Enviado",
  LIQUIDADO: "Liquidado",
};

const LOTE_STATUS_COLOR: Record<LoteStatus, string> = {
  ABERTO:    "bg-yellow-100 text-yellow-800",
  FECHADO:   "bg-blue-100 text-blue-800",
  ENVIADO:   "bg-purple-100 text-purple-800",
  LIQUIDADO: "bg-green-100 text-green-800",
};

const moeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ─── Componente principal ─────────────────────────────────────────────────────

export default function FaturamentoPage() {
  const [tab, setTab]                   = useState<"guias" | "lotes">("guias");
  const [plans, setPlans]               = useState<InsurancePlan[]>([]);
  const [planId, setPlanId]             = useState("");
  const [guias, setGuias]               = useState<GuiaFaturamento[]>([]);
  const [lotes, setLotes]               = useState<LoteFaturamento[]>([]);
  const [elegiveis, setElegiveis]       = useState<any[]>([]);
  const [loading, setLoading]           = useState(false);
  const [loadingXml, setLoadingXml]     = useState<string | null>(null);
  const [error, setError]               = useState("");

  // Modais
  const [showNovoLote, setShowNovoLote] = useState(false);
  const [showAddGuias, setShowAddGuias] = useState<string | null>(null); // loteId
  const [expandedLote, setExpandedLote] = useState<string | null>(null);

  // Form novo lote
  const [fCompetencia, setFCompetencia] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [fObs, setFObs]                 = useState("");

  // ── Carrega dados ───────────────────────────────────────────────────────────
  useEffect(() => {
    getInsurancePlans().then(p => {
      setPlans(p);
      if (p.length > 0 && !planId) setPlanId(p[0].id);
    });
  }, []);

  useEffect(() => {
    if (!planId) return;
    setLoading(true);
    Promise.all([
      getGuias({ planId, sem_lote: tab === "guias" }),
      getLotes(planId),
      getConsultasElegiveis(planId),
    ])
      .then(([g, l, e]) => { setGuias(g); setLotes(l); setElegiveis(e); })
      .catch(() => setError("Erro ao carregar dados"))
      .finally(() => setLoading(false));
  }, [planId, tab]);

  // ── Gerar guia de consulta ──────────────────────────────────────────────────
  async function handleGerarGuia(appointmentId: string) {
    try {
      const guia = await createGuiaFromAppointment(appointmentId);
      setGuias(prev => [guia, ...prev]);
      setElegiveis(prev => prev.filter(a => a.id !== appointmentId));
    } catch (e: any) {
      setError(e.message ?? "Erro ao gerar guia");
    }
  }

  // ── Atualizar status da guia ────────────────────────────────────────────────
  async function handleGuiaStatus(id: string, status: GuiaStatus) {
    const guia = await updateGuia(id, { status });
    setGuias(prev => prev.map(g => g.id === id ? { ...g, ...guia } : g));
  }

  // ── Excluir guia ────────────────────────────────────────────────────────────
  async function handleDeleteGuia(id: string) {
    if (!confirm("Excluir esta guia?")) return;
    await deleteGuia(id);
    setGuias(prev => prev.filter(g => g.id !== id));
  }

  // ── Criar lote ──────────────────────────────────────────────────────────────
  async function handleCriarLote() {
    if (!planId || !fCompetencia) return;
    const lote = await createLote({ insurancePlanId: planId, competencia: fCompetencia, observacoes: fObs || undefined });
    setLotes(prev => [lote, ...prev]);
    setShowNovoLote(false);
    setFObs("");
  }

  // ── Adicionar guias ao lote ─────────────────────────────────────────────────
  const [selectedGuias, setSelectedGuias] = useState<Set<string>>(new Set());

  async function handleAddGuiasAoLote() {
    if (!showAddGuias || selectedGuias.size === 0) return;
    const lote = await updateLote(showAddGuias, { addGuiaIds: Array.from(selectedGuias) });
    setLotes(prev => prev.map(l => l.id === showAddGuias ? lote : l));
    setGuias(prev => prev.filter(g => !selectedGuias.has(g.id)));
    setSelectedGuias(new Set());
    setShowAddGuias(null);
  }

  // ── Remover guia do lote ────────────────────────────────────────────────────
  async function handleRemoverGuiaDoLote(loteId: string, guiaId: string) {
    const lote = await updateLote(loteId, { removeGuiaIds: [guiaId] });
    setLotes(prev => prev.map(l => l.id === loteId ? lote : l));
  }

  // ── Fechar lote ─────────────────────────────────────────────────────────────
  async function handleFecharLote(id: string) {
    const lote = await updateLote(id, { status: "FECHADO" });
    setLotes(prev => prev.map(l => l.id === id ? lote : l));
  }

  // ── Exportar XML ────────────────────────────────────────────────────────────
  async function handleExportarXml(loteId: string, numeroLote: number, competencia: string) {
    setLoadingXml(loteId);
    try {
      const xml = await downloadXmlTiss(loteId);
      const blob = new Blob([xml], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tiss_lote_${numeroLote}_${competencia}.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Erro ao gerar XML TISS");
    } finally {
      setLoadingXml(null);
    }
  }

  // ── Excluir lote ────────────────────────────────────────────────────────────
  async function handleDeleteLote(id: string) {
    if (!confirm("Excluir este lote? As guias voltarão ao status Pendente.")) return;
    await deleteLote(id);
    setLotes(prev => prev.filter(l => l.id !== id));
    getLotes(planId).then(setLotes);
    getGuias({ planId, sem_lote: true }).then(setGuias);
  }

  const guiasSemLote = useMemo(() => guias.filter(g => !g.loteId), [guias]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-10">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FileText size={22} className="text-primary-600" /> Faturamento TISS
          </h1>
          <p className="text-slate-500 text-sm mt-1">Guias e lotes para envio às operadoras · Padrão 3.05</p>
        </div>
        {/* Seletor de convênio */}
        <select
          value={planId}
          onChange={e => setPlanId(e.target.value)}
          className="input w-full md:w-64"
        >
          <option value="">Selecione o convênio…</option>
          {plans.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 flex items-center gap-2">
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError("")} className="ml-auto text-red-400 hover:text-red-600"><XCircle size={16} /></button>
        </div>
      )}

      {!planId ? (
        <div className="card text-center py-16 text-slate-500">
          <Package size={48} className="mx-auto mb-3 opacity-30" />
          <p>Selecione um convênio para gerenciar o faturamento</p>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-1 border-b border-surface-border">
            {(["guias", "lotes"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                  tab === t
                    ? "bg-white border border-b-white border-surface-border -mb-px text-primary-700"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {t === "guias" ? "Guias Avulsas" : "Lotes"}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary-600" size={32} /></div>
          ) : tab === "guias" ? (
            <TabGuias
              elegiveis={elegiveis}
              guias={guiasSemLote}
              onGerarGuia={handleGerarGuia}
              onStatusChange={handleGuiaStatus}
              onDelete={handleDeleteGuia}
            />
          ) : (
            <TabLotes
              lotes={lotes}
              guiasSemLote={guiasSemLote}
              showNovoLote={showNovoLote}
              onToggleNovoLote={() => setShowNovoLote(v => !v)}
              fCompetencia={fCompetencia}
              onCompetencia={setFCompetencia}
              fObs={fObs}
              onObs={setFObs}
              onCriarLote={handleCriarLote}
              showAddGuias={showAddGuias}
              onShowAddGuias={setShowAddGuias}
              selectedGuias={selectedGuias}
              onToggleGuia={id => setSelectedGuias(prev => {
                const s = new Set(prev);
                s.has(id) ? s.delete(id) : s.add(id);
                return s;
              })}
              onAddGuiasAoLote={handleAddGuiasAoLote}
              onRemoverGuiaDoLote={handleRemoverGuiaDoLote}
              onFecharLote={handleFecharLote}
              onExportarXml={handleExportarXml}
              onDeleteLote={handleDeleteLote}
              expandedLote={expandedLote}
              onToggleExpand={id => setExpandedLote(v => v === id ? null : id)}
              loadingXml={loadingXml}
            />
          )}
        </>
      )}
    </div>
  );
}

// ─── Tab: Guias ───────────────────────────────────────────────────────────────

function TabGuias({
  elegiveis, guias, onGerarGuia, onStatusChange, onDelete,
}: {
  elegiveis: any[];
  guias: GuiaFaturamento[];
  onGerarGuia: (id: string) => void;
  onStatusChange: (id: string, s: GuiaStatus) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Consultas elegíveis */}
      {elegiveis.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <RefreshCw size={16} className="text-primary-600" />
            Consultas sem guia ({elegiveis.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-surface-border">
                  <th className="pb-2 pr-4">Paciente</th>
                  <th className="pb-2 pr-4">Médico</th>
                  <th className="pb-2 pr-4">Data</th>
                  <th className="pb-2 pr-4">Valor</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {elegiveis.map(a => (
                  <tr key={a.id} className="border-b border-surface-border last:border-0">
                    <td className="py-2 pr-4 font-medium text-slate-800">{a.patient.fullName}</td>
                    <td className="py-2 pr-4 text-slate-600">{a.doctor.user.name}</td>
                    <td className="py-2 pr-4 text-slate-500">
                      {new Date(a.startTime).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="py-2 pr-4 text-slate-700">
                      {a.payment ? moeda(a.payment.amount) : "—"}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => onGerarGuia(a.id)}
                        className="btn-primary text-xs py-1 px-3"
                      >
                        Gerar Guia
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Guias avulsas */}
      <div className="card">
        <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <ClipboardList size={16} className="text-primary-600" />
          Guias pendentes de lote ({guias.length})
        </h3>
        {guias.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8">
            Nenhuma guia avulsa. Gere guias a partir das consultas acima.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-surface-border">
                  <th className="pb-2 pr-4">Nº Guia</th>
                  <th className="pb-2 pr-4">Beneficiário</th>
                  <th className="pb-2 pr-4">Tipo</th>
                  <th className="pb-2 pr-4">Valor</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {guias.map(g => (
                  <tr key={g.id} className="border-b border-surface-border last:border-0">
                    <td className="py-2 pr-4 font-mono text-slate-700">{g.numeroGuia}</td>
                    <td className="py-2 pr-4 font-medium text-slate-800">{g.nomeBeneficiario}</td>
                    <td className="py-2 pr-4 text-slate-500">{g.tipo}</td>
                    <td className="py-2 pr-4 text-slate-700">{moeda(g.valorApresentado)}</td>
                    <td className="py-2 pr-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${GUIA_STATUS_COLOR[g.status]}`}>
                        {GUIA_STATUS_LABEL[g.status]}
                      </span>
                    </td>
                    <td className="py-2 text-right flex items-center justify-end gap-1">
                      <select
                        value={g.status}
                        onChange={e => onStatusChange(g.id, e.target.value as GuiaStatus)}
                        className="text-xs border border-slate-200 rounded px-1 py-0.5 bg-white"
                      >
                        {(Object.keys(GUIA_STATUS_LABEL) as GuiaStatus[]).map(s => (
                          <option key={s} value={s}>{GUIA_STATUS_LABEL[s]}</option>
                        ))}
                      </select>
                      <button onClick={() => onDelete(g.id)} className="p-1 text-red-400 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Lotes ───────────────────────────────────────────────────────────────

function TabLotes({
  lotes, guiasSemLote,
  showNovoLote, onToggleNovoLote,
  fCompetencia, onCompetencia, fObs, onObs, onCriarLote,
  showAddGuias, onShowAddGuias, selectedGuias, onToggleGuia, onAddGuiasAoLote,
  onRemoverGuiaDoLote, onFecharLote, onExportarXml, onDeleteLote,
  expandedLote, onToggleExpand, loadingXml,
}: {
  lotes: LoteFaturamento[];
  guiasSemLote: GuiaFaturamento[];
  showNovoLote: boolean;
  onToggleNovoLote: () => void;
  fCompetencia: string;
  onCompetencia: (v: string) => void;
  fObs: string;
  onObs: (v: string) => void;
  onCriarLote: () => void;
  showAddGuias: string | null;
  onShowAddGuias: (id: string | null) => void;
  selectedGuias: Set<string>;
  onToggleGuia: (id: string) => void;
  onAddGuiasAoLote: () => void;
  onRemoverGuiaDoLote: (loteId: string, guiaId: string) => void;
  onFecharLote: (id: string) => void;
  onExportarXml: (id: string, n: number, c: string) => void;
  onDeleteLote: (id: string) => void;
  expandedLote: string | null;
  onToggleExpand: (id: string) => void;
  loadingXml: string | null;
}) {
  return (
    <div className="space-y-4">
      {/* Botão novo lote */}
      <div className="flex justify-end">
        <button onClick={onToggleNovoLote} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Novo Lote
        </button>
      </div>

      {/* Form novo lote */}
      {showNovoLote && (
        <div className="card border border-primary-200 bg-primary-50/30">
          <h4 className="font-semibold text-slate-700 mb-3">Novo Lote de Faturamento</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Competência (YYYY-MM)</label>
              <input
                type="month"
                value={fCompetencia}
                onChange={e => onCompetencia(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">Observações (opcional)</label>
              <input
                type="text"
                value={fObs}
                onChange={e => onObs(e.target.value)}
                placeholder="Ex: Faturamento junho/2026"
                className="input"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <button onClick={onToggleNovoLote} className="btn-secondary">Cancelar</button>
            <button onClick={onCriarLote} className="btn-primary">Criar Lote</button>
          </div>
        </div>
      )}

      {/* Lista de lotes */}
      {lotes.length === 0 ? (
        <div className="card text-center py-16 text-slate-500">
          <Package size={48} className="mx-auto mb-3 opacity-30" />
          <p>Nenhum lote criado para este convênio.</p>
        </div>
      ) : (
        lotes.map(lote => (
          <div key={lote.id} className="card">
            {/* Cabeçalho do lote */}
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => onToggleExpand(lote.id)} className="flex items-center gap-2 flex-1 min-w-0">
                {expandedLote === lote.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                <span className="font-semibold text-slate-800">
                  Lote #{lote.numeroLote} — {lote.competencia}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LOTE_STATUS_COLOR[lote.status]}`}>
                  {LOTE_STATUS_LABEL[lote.status]}
                </span>
              </button>

              <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                <span>{lote.guias.length} guia{lote.guias.length !== 1 ? "s" : ""}</span>
                <span className="text-slate-500">·</span>
                <span className="text-green-700 font-semibold">{moeda(lote.valorTotal)}</span>
              </div>

              {/* Ações */}
              <div className="flex items-center gap-1">
                {lote.status === "ABERTO" && (
                  <>
                    <button
                      onClick={() => onShowAddGuias(showAddGuias === lote.id ? null : lote.id)}
                      className="btn-secondary text-xs py-1 px-2 flex items-center gap-1"
                    >
                      <Plus size={12} /> Guias
                    </button>
                    <button
                      onClick={() => onFecharLote(lote.id)}
                      className="btn-secondary text-xs py-1 px-2 flex items-center gap-1"
                    >
                      <CheckCircle size={12} /> Fechar
                    </button>
                  </>
                )}
                <button
                  onClick={() => onExportarXml(lote.id, lote.numeroLote, lote.competencia)}
                  disabled={loadingXml === lote.id || lote.guias.length === 0}
                  className="btn-primary text-xs py-1 px-2 flex items-center gap-1 disabled:opacity-50"
                >
                  {loadingXml === lote.id
                    ? <Loader2 size={12} className="animate-spin" />
                    : <Download size={12} />}
                  XML TISS
                </button>
                <button onClick={() => onDeleteLote(lote.id)} className="p-1.5 text-red-400 hover:text-red-600">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Painel adicionar guias */}
            {showAddGuias === lote.id && (
              <div className="mt-4 border-t border-surface-border pt-4">
                <p className="text-sm font-medium text-slate-700 mb-2">
                  Selecione guias avulsas para adicionar ao lote:
                </p>
                {guiasSemLote.length === 0 ? (
                  <p className="text-sm text-slate-500">Não há guias avulsas disponíveis.</p>
                ) : (
                  <>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {guiasSemLote.map(g => (
                        <label key={g.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-cream-100 rounded px-2 py-1">
                          <input
                            type="checkbox"
                            checked={selectedGuias.has(g.id)}
                            onChange={() => onToggleGuia(g.id)}
                          />
                          <span className="font-mono text-slate-500">{g.numeroGuia}</span>
                          <span className="font-medium text-slate-800 flex-1">{g.nomeBeneficiario}</span>
                          <span className="text-slate-500">{moeda(g.valorApresentado)}</span>
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-3 justify-end">
                      <button onClick={() => onShowAddGuias(null)} className="btn-secondary text-sm">Cancelar</button>
                      <button
                        onClick={onAddGuiasAoLote}
                        disabled={selectedGuias.size === 0}
                        className="btn-primary text-sm disabled:opacity-50"
                      >
                        Adicionar ({selectedGuias.size})
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Guias do lote expandido */}
            {expandedLote === lote.id && lote.guias.length > 0 && (
              <div className="mt-4 border-t border-surface-border pt-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-surface-border">
                      <th className="pb-2 pr-4">Nº Guia</th>
                      <th className="pb-2 pr-4">Beneficiário</th>
                      <th className="pb-2 pr-4">Tipo</th>
                      <th className="pb-2 pr-4">Valor</th>
                      <th className="pb-2 pr-4">Status</th>
                      {lote.status === "ABERTO" && <th className="pb-2" />}
                    </tr>
                  </thead>
                  <tbody>
                    {lote.guias.map(g => (
                      <tr key={g.id} className="border-b border-surface-border last:border-0">
                        <td className="py-2 pr-4 font-mono text-slate-700">{g.numeroGuia}</td>
                        <td className="py-2 pr-4 font-medium text-slate-800">{g.nomeBeneficiario}</td>
                        <td className="py-2 pr-4 text-slate-500">{g.tipo}</td>
                        <td className="py-2 pr-4 text-slate-700">{moeda(g.valorApresentado)}</td>
                        <td className="py-2 pr-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${GUIA_STATUS_COLOR[g.status as GuiaStatus]}`}>
                            {GUIA_STATUS_LABEL[g.status as GuiaStatus]}
                          </span>
                        </td>
                        {lote.status === "ABERTO" && (
                          <td className="py-2 text-right">
                            <button
                              onClick={() => onRemoverGuiaDoLote(lote.id, g.id)}
                              className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1"
                            >
                              <XCircle size={13} /> Remover
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
