'use client'

import { useEffect, useState } from 'react'
import { Package, Plus, Pencil, ArrowDownCircle, ArrowUpCircle, X, AlertTriangle } from 'lucide-react'
import {
  getMaterials, createMaterial, updateMaterial, deleteMaterial,
  getStockMovements, createStockMovement,
  type Material, type StockMovement,
} from '@/lib/api'

// ─── Modal: Material ──────────────────────────────────────────────────────────

function MaterialModal({ item, onClose, onSaved }: {
  item?:    Material
  onClose:  () => void
  onSaved:  () => void
}) {
  const [name, setName]               = useState(item?.name ?? '')
  const [unit, setUnit]               = useState(item?.unit ?? '')
  const [minStock, setMinStock]       = useState(item ? String(item.minStock) : '0')
  const [currentStock, setCurrentStock] = useState(item ? String(item.currentStock) : '0')
  const [costPrice, setCostPrice]     = useState(item?.costPrice ? String(item.costPrice) : '')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !unit) return setError('Nome e unidade são obrigatórios.')
    setSaving(true)
    try {
      const data = {
        name,
        unit,
        minStock:     parseFloat(minStock) || 0,
        currentStock: parseFloat(currentStock) || 0,
        costPrice:    costPrice ? parseFloat(costPrice.replace(',', '.')) : null,
        isActive:     true,
      }
      if (item) await updateMaterial(item.id, data)
      else      await createMaterial(data)
      onSaved()
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-surface-border">
          <h2 className="text-lg font-semibold text-slate-800">{item ? 'Editar Material' : 'Novo Material'}</h2>
          <button onClick={onClose}><X size={20} className="text-slate-500 hover:text-slate-600" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome <span className="text-red-500">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} className="input" placeholder="Ex: Luva descartável" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Unidade <span className="text-red-500">*</span></label>
              <input value={unit} onChange={e => setUnit(e.target.value)} className="input" placeholder="caixa, unidade…" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Custo unitário (R$)</label>
              <input value={costPrice} onChange={e => setCostPrice(e.target.value)} className="input" placeholder="0,00" inputMode="decimal" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Estoque mínimo</label>
              <input value={minStock} onChange={e => setMinStock(e.target.value)} className="input" inputMode="decimal" />
            </div>
            {!item && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Estoque inicial</label>
                <input value={currentStock} onChange={e => setCurrentStock(e.target.value)} className="input" inputMode="decimal" />
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-outline flex-1">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal: Movimentação ──────────────────────────────────────────────────────

function MovementModal({ material, onClose, onSaved }: {
  material: Material
  onClose:  () => void
  onSaved:  () => void
}) {
  const [type, setType]         = useState<'IN' | 'OUT'>('IN')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason]     = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const qty = parseFloat(quantity)
    if (!qty || qty <= 0) return setError('Informe uma quantidade válida.')
    if (type === 'OUT' && qty > material.currentStock) return setError(`Estoque insuficiente. Disponível: ${material.currentStock} ${material.unit}`)
    setSaving(true)
    try {
      await createStockMovement({ materialId: material.id, type, quantity: qty, reason: reason || undefined })
      onSaved()
    } catch (err: any) {
      setError(err.message || 'Erro ao registrar movimentação.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-6 border-b border-surface-border">
          <h2 className="text-lg font-semibold text-slate-800">Movimentar Estoque</h2>
          <button onClick={onClose}><X size={20} className="text-slate-500 hover:text-slate-600" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
          <div className="bg-cream-50 rounded-lg p-3 text-sm">
            <p className="font-medium text-slate-700">{material.name}</p>
            <p className="text-slate-500">Saldo atual: <span className="font-semibold text-slate-700">{material.currentStock} {material.unit}</span></p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setType('IN')}
                className={`flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-colors ${type === 'IN' ? 'bg-green-100 border-green-400 text-green-700' : 'border-surface-border text-slate-600 hover:bg-cream-50'}`}>
                <ArrowDownCircle size={16} /> Entrada
              </button>
              <button type="button" onClick={() => setType('OUT')}
                className={`flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-colors ${type === 'OUT' ? 'bg-orange-100 border-orange-400 text-orange-700' : 'border-surface-border text-slate-600 hover:bg-cream-50'}`}>
                <ArrowUpCircle size={16} /> Saída
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade ({material.unit})</label>
            <input value={quantity} onChange={e => setQuantity(e.target.value)} className="input" inputMode="decimal" placeholder="0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Motivo / Observação</label>
            <input value={reason} onChange={e => setReason(e.target.value)} className="input" placeholder="Ex: Compra fornecedor, uso em consulta…" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-outline flex-1">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Salvando…' : 'Registrar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function EstoquePage() {
  const [tab, setTab] = useState<'materials' | 'movements'>('materials')
  const [materials, setMaterials]   = useState<Material[]>([])
  const [movements, setMovements]   = useState<StockMovement[]>([])
  const [loading, setLoading]       = useState(true)

  const [showMaterialModal, setShowMaterialModal] = useState(false)
  const [editingMaterial, setEditingMaterial]     = useState<Material | undefined>()
  const [movingMaterial, setMovingMaterial]       = useState<Material | undefined>()

  async function load() {
    setLoading(true)
    try {
      const [mats, movs] = await Promise.all([getMaterials(), getStockMovements()])
      setMaterials(mats)
      setMovements(movs)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleDelete(id: string) {
    if (!confirm('Desativar este material?')) return
    await deleteMaterial(id)
    load()
  }

  const lowStock = materials.filter(m => m.currentStock <= m.minStock && m.minStock > 0)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Package className="text-primary-600" size={26} />
            Estoque
          </h1>
          <p className="text-slate-500 text-sm mt-1">Gestão de materiais e insumos da clínica</p>
        </div>
        {tab === 'materials' && (
          <button onClick={() => { setEditingMaterial(undefined); setShowMaterialModal(true) }} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Novo Material
          </button>
        )}
      </div>

      {/* Alertas de estoque baixo */}
      {lowStock.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
          <div>
            <p className="text-sm font-medium text-amber-800">Estoque abaixo do mínimo</p>
            <p className="text-sm text-amber-700 mt-1">
              {lowStock.map(m => `${m.name} (${m.currentStock}/${m.minStock} ${m.unit})`).join(' • ')}
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-surface-border">
        {(['materials', 'movements'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === t ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t === 'materials' ? 'Materiais' : 'Movimentações'}
          </button>
        ))}
      </div>

      {/* Tab: Materiais */}
      {tab === 'materials' && (
        loading ? <p className="text-center text-slate-500 py-12">Carregando…</p> :
        materials.length === 0 ? (
          <div className="card text-center py-12">
            <Package className="mx-auto text-slate-300 mb-3" size={40} />
            <p className="text-slate-500">Nenhum material cadastrado.</p>
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-cream-50 border-b border-surface-border">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Material</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Unidade</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Saldo</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Mínimo</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Custo Unit.</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {materials.map(m => {
                  const isLow = m.currentStock <= m.minStock && m.minStock > 0
                  return (
                    <tr key={m.id} className="hover:bg-cream-50">
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-800">{m.name}</span>
                        {isLow && <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Baixo</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{m.unit}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${isLow ? 'text-amber-600' : 'text-slate-800'}`}>{m.currentStock}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{m.minStock}</td>
                      <td className="px-4 py-3 text-right text-slate-500">
                        {m.costPrice ? `R$ ${m.costPrice.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setMovingMaterial(m)} className="text-xs text-primary-600 hover:text-primary-800 font-medium">Movimentar</button>
                          <button onClick={() => { setEditingMaterial(m); setShowMaterialModal(true) }} className="p-1 text-slate-500 hover:text-primary-600 rounded">
                            <Pencil size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Tab: Movimentações */}
      {tab === 'movements' && (
        loading ? <p className="text-center text-slate-500 py-12">Carregando…</p> :
        movements.length === 0 ? (
          <div className="card text-center py-12">
            <Package className="mx-auto text-slate-300 mb-3" size={40} />
            <p className="text-slate-500">Nenhuma movimentação registrada.</p>
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-cream-50 border-b border-surface-border">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Material</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Tipo</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Qtd</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Motivo</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {movements.map(mv => (
                  <tr key={mv.id} className="hover:bg-cream-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{mv.material.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${mv.type === 'IN' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                        {mv.type === 'IN' ? <ArrowDownCircle size={12} /> : <ArrowUpCircle size={12} />}
                        {mv.type === 'IN' ? 'Entrada' : 'Saída'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700">{mv.quantity} {mv.material.unit}</td>
                    <td className="px-4 py-3 text-slate-500">{mv.reason ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{new Date(mv.createdAt).toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {showMaterialModal && (
        <MaterialModal
          item={editingMaterial}
          onClose={() => { setShowMaterialModal(false); setEditingMaterial(undefined) }}
          onSaved={() => { setShowMaterialModal(false); setEditingMaterial(undefined); load() }}
        />
      )}

      {movingMaterial && (
        <MovementModal
          material={movingMaterial}
          onClose={() => setMovingMaterial(undefined)}
          onSaved={() => { setMovingMaterial(undefined); load() }}
        />
      )}
    </div>
  )
}
