"use client";

import { useState, useEffect, useCallback } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { getAuditLogs, getAuditLogsSummary } from "@/lib/api";
import type { AuditLog } from "@/lib/types";
import {
  Search,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Shield,
  User,
  Calendar,
  Globe,
} from "lucide-react";

// ─── Cores por tipo de ação ───────────────────────────────────────────────────

const ACTION_COLOR: Record<string, string> = {
  LOGIN:              "bg-purple-100 text-purple-700",
  LOGIN_FAILED:       "bg-red-100 text-red-700",
  CREATE:             "bg-green-100 text-green-700",
  UPDATE:             "bg-blue-100 text-blue-700",
  DELETE:             "bg-red-100 text-red-700",
  CANCEL:             "bg-orange-100 text-orange-700",
}

function actionColor(action: string): string {
  const key = Object.keys(ACTION_COLOR).find(k => action.startsWith(k))
  return key ? ACTION_COLOR[key] : "bg-slate-100 text-slate-600"
}

// ─── Linha da tabela expansível ───────────────────────────────────────────────

function LogRow({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false)
  const hasMetadata = log.metadata && Object.keys(log.metadata as object).length > 0

  return (
    <>
      <tr
        className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${hasMetadata ? 'cursor-pointer' : ''}`}
        onClick={() => hasMetadata && setExpanded(e => !e)}
      >
        <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
          {new Date(log.createdAt).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
          })}
        </td>
        <td className="px-4 py-3">
          {log.user ? (
            <div>
              <p className="text-sm font-medium text-slate-700">{log.user.name}</p>
              <p className="text-xs text-slate-400">{log.user.email}</p>
            </div>
          ) : (
            <span className="text-xs text-slate-400 italic">Sistema</span>
          )}
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${actionColor(log.action)}`}>
            {log.action}
          </span>
        </td>
        <td className="px-4 py-3">
          <p className="text-sm text-slate-700 font-medium">{log.entity}</p>
          {log.entityId && <p className="text-xs text-slate-400 font-mono">{log.entityId.slice(0, 8)}…</p>}
        </td>
        <td className="px-4 py-3 text-xs text-slate-400 font-mono">
          {log.ipAddress ?? '—'}
        </td>
        <td className="px-4 py-3 text-xs">
          {hasMetadata
            ? expanded
              ? <ChevronDown size={14} className="text-slate-400" />
              : <ChevronRight size={14} className="text-slate-400" />
            : null
          }
        </td>
      </tr>
      {expanded && hasMetadata && (
        <tr className="bg-slate-50">
          <td colSpan={6} className="px-6 pb-3 pt-0">
            <pre className="text-xs text-slate-600 bg-white border border-slate-200 rounded-lg p-3 overflow-x-auto">
              {JSON.stringify(log.metadata, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Cards de resumo ──────────────────────────────────────────────────────────

interface SummaryData {
  byAction:    { action: string; count: number }[]
  byEntity:    { entity: string; count: number }[]
  recentUsers: { userId: string | null; name?: string; email?: string; lastAction: string; lastEntity: string; at: string }[]
}

function SummaryCards({ summary }: { summary: SummaryData }) {
  const totalEvents = summary.byAction.reduce((s, a) => s + a.count, 0)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="text-xs text-slate-500 mb-1">Eventos (30 dias)</p>
        <p className="text-2xl font-bold text-slate-800">{totalEvents}</p>
        <div className="mt-2 space-y-1">
          {summary.byAction.slice(0, 4).map(a => (
            <div key={a.action} className="flex items-center justify-between">
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${actionColor(a.action)}`}>{a.action}</span>
              <span className="text-xs text-slate-500">{a.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="text-xs text-slate-500 mb-1">Por entidade</p>
        <div className="space-y-1.5 mt-2">
          {summary.byEntity.slice(0, 5).map(e => (
            <div key={e.entity} className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700">{e.entity}</span>
              <div className="flex items-center gap-2">
                <div className="w-20 bg-slate-100 rounded-full h-1.5">
                  <div
                    className="bg-primary-500 h-1.5 rounded-full"
                    style={{ width: `${Math.min(100, (e.count / (summary.byEntity[0]?.count || 1)) * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500 w-6 text-right">{e.count}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="text-xs text-slate-500 mb-2">Últimos usuários ativos</p>
        <div className="space-y-2">
          {summary.recentUsers.slice(0, 5).map((u, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-primary-700">
                  {(u.name ?? '?').charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-700 truncate">{u.name ?? '—'}</p>
                <p className="text-xs text-slate-400">{u.lastAction} · {u.lastEntity}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

const ENTITY_OPTIONS = ['User', 'Patient', 'Appointment', 'MedicalRecord', 'Exam']
const ACTION_OPTIONS = ['LOGIN', 'LOGIN_FAILED', 'CREATE', 'UPDATE', 'DELETE', 'CANCEL',
  'STATUS_CONFIRMED', 'STATUS_IN_PROGRESS', 'STATUS_COMPLETED', 'STATUS_CANCELLED']

export default function AuditLogsPage() {
  const [logs,       setLogs]       = useState<AuditLog[]>([])
  const [total,      setTotal]      = useState(0)
  const [summary,    setSummary]    = useState<SummaryData | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [entity,     setEntity]     = useState('')
  const [action,     setAction]     = useState('')
  const [from,       setFrom]       = useState('')
  const [to,         setTo]         = useState('')
  const [skip,       setSkip]       = useState(0)
  const TAKE = 50

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [res, sum] = await Promise.all([
        getAuditLogs({ search: search || undefined, entity: entity || undefined, action: action || undefined,
                       from: from || undefined, to: to || undefined, take: TAKE, skip }),
        summary === null ? getAuditLogsSummary() : Promise.resolve(null),
      ])
      setLogs(res.data)
      setTotal(res.total)
      if (sum) setSummary(sum)
    } finally {
      setLoading(false)
    }
  }, [search, entity, action, from, to, skip, summary])

  useEffect(() => { load() }, [load])

  function handleFilter() { setSkip(0); load() }

  return (
    <RoleGuard roles={['ADMIN']}>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Logs de Acesso e Ações</h1>
            <p className="text-sm text-slate-500 mt-0.5">{total} registro{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={load}
            className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50"
            title="Atualizar"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-slate-400' : 'text-slate-500'} />
          </button>
        </div>

        {/* Summary */}
        {summary && <SummaryCards summary={summary} />}

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-48">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Buscar entidade, ação, ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleFilter()}
            />
          </div>

          <select
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={entity}
            onChange={e => { setEntity(e.target.value); setSkip(0) }}
          >
            <option value="">Todas as entidades</option>
            {ENTITY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>

          <select
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={action}
            onChange={e => { setAction(e.target.value); setSkip(0) }}
          >
            <option value="">Todas as ações</option>
            {ACTION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>

          <input
            type="date"
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={from}
            onChange={e => setFrom(e.target.value)}
            title="De"
          />
          <input
            type="date"
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={to}
            onChange={e => setTo(e.target.value)}
            title="Até"
          />
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  <Calendar size={12} className="inline mr-1" />Data/Hora
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <User size={12} className="inline mr-1" />Usuário
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Ação</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <Shield size={12} className="inline mr-1" />Entidade
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <Globe size={12} className="inline mr-1" />IP
                </th>
                <th className="px-4 py-3 w-6"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400 text-sm">Carregando…</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400 text-sm">Nenhum registro encontrado.</td>
                </tr>
              ) : logs.map(log => <LogRow key={log.id} log={log} />)}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {total > TAKE && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-slate-500">
              {skip + 1}–{Math.min(skip + TAKE, total)} de {total}
            </p>
            <div className="flex gap-2">
              <button
                disabled={skip === 0}
                onClick={() => setSkip(s => Math.max(0, s - TAKE))}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm disabled:opacity-40 hover:bg-slate-50"
              >
                Anterior
              </button>
              <button
                disabled={skip + TAKE >= total}
                onClick={() => setSkip(s => s + TAKE)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm disabled:opacity-40 hover:bg-slate-50"
              >
                Próximo
              </button>
            </div>
          </div>
        )}
      </div>
    </RoleGuard>
  )
}
