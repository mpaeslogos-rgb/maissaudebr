'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { getChats, getDoctors, sendChatMessage, transferChat, returnChat, getContacts, sendWhatsAppMessage, getChatMessages, toggleChatAI, sendBulkMessage } from '@/lib/api'
import type { BulkSendResult } from '@/lib/api'
import type { Chat, Doctor, ChatMessage as ApiChatMessage } from '@/lib/types'
import type { Contact } from '@/lib/api'

// ─── Tipos locais ─────────────────────────────────────────────────────────────

type Message = {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

// ─── Labels e cores ───────────────────────────────────────────────────────────

const TYPE_LABEL: Record<Contact['type'], string> = {
  patient: 'Paciente',
  doctor: 'Médico',
  supplier: 'Fornecedor',
}

const TYPE_ICON: Record<Contact['type'], string> = {
  patient: '👤',
  doctor: '🩺',
  supplier: '🏢',
}

// ─── Helper: resolve nome de exibição do chat ─────────────────────────────────

function resolveChatName(chat: Chat): string {
  if (chat.patient?.fullName) return chat.patient.fullName
  if (chat.resolvedDoctor?.name) return `Dr(a). ${chat.resolvedDoctor.name}`
  return chat.phone
}

function resolveChatSubtitle(chat: Chat): string {
  if (chat.patient?.fullName) return 'Paciente'
  if (chat.resolvedDoctor) return `Médico · ${chat.resolvedDoctor.specialty}`
  return 'Não identificado'
}

// ─── Modal: Nova Mensagem ─────────────────────────────────────────────────────

function NewMessageModal({ onClose }: { onClose: () => void }) {
  const [search, setSearch] = useState('')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [selected, setSelected] = useState<Contact | null>(null)
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadContacts = useCallback(async (q?: string) => {
    setLoadingContacts(true)
    try {
      const res = await getContacts(q)
      setContacts(res.data)
    } catch {
      setContacts([])
    } finally {
      setLoadingContacts(false)
    }
  }, [])

  useEffect(() => { loadContacts() }, [loadContacts])

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setSearch(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => loadContacts(val || undefined), 400)
  }

  function handleSelectContact(c: Contact) {
    setSelected(c)
    setPhone(c.phone ?? '')
    setError('')
  }

  async function handleSend() {
    setError('')
    const dest = phone.trim()
    if (!dest) return setError('Informe o número do WhatsApp do destinatário.')
    if (!message.trim()) return setError('Digite uma mensagem.')

    setSending(true)
    try {
      await sendWhatsAppMessage(dest, message.trim())
      setSuccess(true)
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message)
      else setError('Erro ao enviar mensagem. Verifique a configuração do WhatsApp.')
    } finally {
      setSending(false)
    }
  }

  const grouped = contacts.reduce<Record<Contact['type'], Contact[]>>(
    (acc, c) => { acc[c.type].push(c); return acc },
    { patient: [], doctor: [], supplier: [] }
  )

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-8 text-center space-y-4">
          <div className="text-4xl">✅</div>
          <h3 className="text-lg font-semibold text-slate-800">Mensagem enviada!</h3>
          <p className="text-slate-500 text-sm">
            Mensagem enviada para <strong>{selected?.name ?? phone}</strong> via WhatsApp.
          </p>
          <button onClick={onClose} className="btn-primary w-full">Fechar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-surface-border shrink-0">
          <h2 className="text-base font-semibold text-slate-800">Nova Mensagem WhatsApp</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-64 border-r border-surface-border flex flex-col shrink-0">
            <div className="p-3 border-b border-surface-border">
              <input value={search} onChange={handleSearchChange} placeholder="Buscar contato…" className="input text-sm" />
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingContacts && <p className="text-center text-slate-400 text-sm py-6">Buscando…</p>}
              {!loadingContacts && contacts.length === 0 && <p className="text-center text-slate-400 text-sm py-6">Nenhum contato encontrado.</p>}
              {!loadingContacts && (['patient', 'doctor', 'supplier'] as Contact['type'][]).map(type => {
                const list = grouped[type]
                if (list.length === 0) return null
                return (
                  <div key={type}>
                    <p className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-cream-50 border-b border-surface-border">
                      {TYPE_ICON[type]} {TYPE_LABEL[type]}s
                    </p>
                    {list.map(c => (
                      <button
                        key={c.id}
                        onClick={() => handleSelectContact(c)}
                        className={`w-full text-left px-3 py-2.5 border-b border-surface-border hover:bg-cream-100 transition-colors ${selected?.id === c.id ? 'bg-primary-50 border-l-4 border-l-primary-500' : ''}`}
                      >
                        <p className="text-sm font-medium text-slate-800 truncate">{c.name}</p>
                        <p className="text-xs text-slate-400 truncate">{c.phone ?? 'Sem telefone'} · {c.detail}</p>
                      </button>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex-1 flex flex-col p-5 space-y-4">
            {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
            {selected ? (
              <div className="bg-primary-50 border border-primary-200 rounded-lg px-4 py-3 flex items-center gap-3">
                <span className="text-xl">{TYPE_ICON[selected.type]}</span>
                <div>
                  <p className="text-sm font-medium text-primary-800">{selected.name}</p>
                  <p className="text-xs text-primary-600">{TYPE_LABEL[selected.type]} · {selected.detail}</p>
                </div>
                <button onClick={() => { setSelected(null); setPhone('') }} className="ml-auto text-primary-400 hover:text-primary-600">×</button>
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">← Selecione um contato ou informe o número abaixo.</p>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Número WhatsApp <span className="text-red-500">*</span>
                {selected && !selected.phone && <span className="ml-2 text-xs text-amber-600 font-normal">Este contato não tem telefone cadastrado</span>}
              </label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 99999-0000" className="input" />
              <p className="text-xs text-slate-400 mt-1">DDD + número. O código +55 é adicionado automaticamente.</p>
            </div>
            <div className="flex-1 flex flex-col">
              <label className="block text-sm font-medium text-slate-700 mb-1">Mensagem <span className="text-red-500">*</span></label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Digite sua mensagem…" className="input resize-none flex-1 min-h-[120px]" />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={onClose} className="btn-outline">Cancelar</button>
              <button onClick={handleSend} disabled={sending || !phone.trim() || !message.trim()} className="btn-primary disabled:opacity-50">
                {sending ? 'Enviando…' : '📱 Enviar via WhatsApp'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: Mensagem em Massa ─────────────────────────────────────────────────

function BulkMessageModal({ onClose }: { onClose: () => void }) {
  const [message, setMessage] = useState('')
  const [step, setStep] = useState<'compose' | 'confirm' | 'sending' | 'done'>('compose')
  const [result, setResult] = useState<BulkSendResult | null>(null)
  const [error, setError] = useState('')

  async function handleSend() {
    setStep('sending')
    setError('')
    try {
      const res = await sendBulkMessage(message.trim())
      setResult(res)
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar mensagens.')
      setStep('confirm')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between p-5 border-b border-surface-border">
          <div>
            <h2 className="text-base font-semibold text-slate-800">📢 Mensagem em Massa</h2>
            <p className="text-xs text-slate-400 mt-0.5">Envia para todos os pacientes com WhatsApp cadastrado</p>
          </div>
          {step !== 'sending' && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
          )}
        </div>

        <div className="p-5 space-y-4">
          {/* Resultado */}
          {step === 'done' && result && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-2xl font-bold text-green-700">{result.sent}</p>
                  <p className="text-xs text-green-600 mt-0.5">Enviados</p>
                </div>
                <div className={`border rounded-lg p-3 ${result.failed > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                  <p className={`text-2xl font-bold ${result.failed > 0 ? 'text-red-700' : 'text-slate-500'}`}>{result.failed}</p>
                  <p className={`text-xs mt-0.5 ${result.failed > 0 ? 'text-red-600' : 'text-slate-400'}`}>Falhas</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-2xl font-bold text-slate-700">{result.total}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Total</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <details className="text-xs text-slate-500 cursor-pointer">
                  <summary className="font-medium text-slate-600 hover:text-slate-800">
                    Ver falhas ({result.errors.length})
                  </summary>
                  <ul className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                    {result.errors.map((e, i) => (
                      <li key={i} className="text-red-600">{e.name} ({e.phone}): {e.reason}</li>
                    ))}
                  </ul>
                </details>
              )}
              <button onClick={onClose} className="btn-primary w-full">Fechar</button>
            </div>
          )}

          {/* Enviando */}
          {step === 'sending' && (
            <div className="text-center py-8 space-y-3">
              <div className="text-4xl animate-pulse">📱</div>
              <p className="text-slate-700 font-medium">Enviando mensagens…</p>
              <p className="text-xs text-slate-400">Aguarde. O envio pode demorar alguns minutos<br/>dependendo da quantidade de pacientes.</p>
            </div>
          )}

          {/* Confirmação */}
          {step === 'confirm' && (
            <div className="space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <p className="text-sm font-medium text-amber-800">⚠️ Confirmar envio em massa</p>
                <p className="text-xs text-amber-700 mt-1">
                  Esta ação enviará a mensagem abaixo para <strong>todos os pacientes</strong> com WhatsApp cadastrado. Não é possível cancelar após iniciar.
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700 border border-slate-200 whitespace-pre-wrap max-h-32 overflow-y-auto">
                {message}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep('compose')} className="btn-outline flex-1">Editar</button>
                <button onClick={handleSend} className="btn-primary flex-1">Confirmar e Enviar</button>
              </div>
            </div>
          )}

          {/* Composição */}
          {step === 'compose' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Mensagem <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Digite a mensagem que será enviada para todos os pacientes…"
                  className="input resize-none min-h-[140px]"
                  maxLength={4096}
                />
                <p className="text-xs text-slate-400 mt-1 text-right">{message.length}/4096</p>
              </div>
              <div className="flex gap-3">
                <button onClick={onClose} className="btn-outline flex-1">Cancelar</button>
                <button
                  onClick={() => setStep('confirm')}
                  disabled={!message.trim()}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  Continuar →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Modal: Chat Pegado (Pegar Chat) ─────────────────────────────────────────

function TakenChatModal({
  chat,
  onReturn,
}: {
  chat: Chat
  onReturn: () => void
}) {
  // Mensagens do servidor (paciente) — sobrescritas a cada polling
  const [serverMessages, setServerMessages] = useState<Message[]>([])
  // Mensagens enviadas pelo atendente nesta sessão — nunca sobrescritas pelo polling
  const [sentMessages, setSentMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const loadMessages = useCallback(async () => {
    try {
      const res = await getChatMessages(chat.id)
      setServerMessages(res.data.map((m: any) => ({
        role: m.role,
        content: m.content,
        timestamp: new Date(m.timestamp),
      })))
    } catch {
      // mantém o que tinha
    }
  }, [chat.id])

  useEffect(() => {
    loadMessages()
    const interval = setInterval(loadMessages, 5000)
    return () => clearInterval(interval)
  }, [loadMessages])

  // Combina mensagens do servidor com as enviadas localmente, ordenadas por timestamp
  const allMessages = [...serverMessages, ...sentMessages].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  )

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [allMessages.length])

  const handleSend = async () => {
    if (!input.trim() || isSending) return
    const text = input.trim()
    setInput('')
    setIsSending(true)
    setSendError('')
    try {
      // Usa endpoint existente /api/whatsapp/send — não depende de deploy novo
      await sendWhatsAppMessage(chat.phone, text)
      // Adiciona ao estado local para aparecer imediatamente (não sobrescrito pelo polling)
      setSentMessages(prev => [...prev, { role: 'assistant' as const, content: text, timestamp: new Date() }])
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Erro ao enviar.')
      setInput(text)
    } finally {
      setIsSending(false)
    }
  }

  const displayName = resolveChatName(chat)
  const subtitle = resolveChatSubtitle(chat)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl h-[85vh] flex flex-col border border-surface-border">
        {/* Cabeçalho */}
        <div className="bg-primary-600 text-white px-5 py-4 rounded-t-xl flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-semibold text-base">{displayName}</h3>
            <p className="text-primary-200 text-xs">{subtitle} · {chat.phone}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-white/20 rounded text-xs font-medium">IA pausada</span>
            <button
              onClick={onReturn}
              className="flex items-center gap-1.5 px-4 py-2 bg-white text-primary-700 rounded-lg text-sm font-semibold hover:bg-primary-50 transition-colors"
            >
              ↩ Devolver
            </button>
          </div>
        </div>

        {/* Mensagens */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-cream-50">
          {allMessages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl text-sm ${
                msg.role === 'user'
                  ? 'bg-primary-600 text-white rounded-br-none'
                  : 'bg-white text-slate-800 border border-surface-border rounded-bl-none'
              }`}>
                <p>{msg.content}</p>
                <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-primary-200' : 'text-slate-400'}`}>
                  {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="bg-white border-t border-surface-border p-4 rounded-b-xl shrink-0">
          {sendError && <p className="text-xs text-red-600 mb-2">{sendError}</p>}
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Digite sua mensagem…"
              className="input flex-1"
              disabled={isSending}
            />
            <button onClick={handleSend} disabled={!input.trim() || isSending} className="btn-primary disabled:opacity-50">
              {isSending ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ChatsPage() {
  const [chats, setChats] = useState<Chat[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [activeChat, setActiveChat] = useState<Chat | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showNewMessage, setShowNewMessage] = useState(false)
  const [showBulkMessage, setShowBulkMessage] = useState(false)
  const [isTogglingAI, setIsTogglingAI] = useState(false)
  const [toggleError, setToggleError] = useState('')
  const [takenChat, setTakenChat] = useState<Chat | null>(null)
  const [transferInfo, setTransferInfo] = useState<{ chatId: string; message: string } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  // Rastreia chats cujo clique duplo está em andamento (para evitar clique simples concorrente)
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    loadChats()
    loadDoctors()
    const interval = setInterval(loadChats, 10000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadMessages = useCallback(async (chat: Chat) => {
    try {
      const res = await getChatMessages(chat.id)
      setMessages(res.data.map((m: any) => ({
        role: m.role,
        content: m.content,
        timestamp: new Date(m.timestamp),
      })))
    } catch {
      setMessages([])
    }
  }, [])

  useEffect(() => {
    if (!activeChat) return
    loadMessages(activeChat)
    const interval = setInterval(() => loadMessages(activeChat), 5000)
    return () => clearInterval(interval)
  }, [activeChat, loadMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadChats = async () => {
    try {
      const res = await getChats({ limit: 50 })
      setChats(res.data)
      setActiveChat(prev => {
        if (!prev) return res.data[0] ?? null
        return res.data.find((c: Chat) => c.id === prev.id) ?? prev
      })
    } catch (error) {
      console.error('Erro ao carregar chats:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadDoctors = async () => {
    try {
      const res = await getDoctors({ limit: 100 })
      setDoctors(res.data)
    } catch (error) {
      console.error('Erro ao carregar médicos:', error)
    }
  }

  const handleSendMessage = async () => {
    if (!input.trim() || !activeChat || isSending) return

    const userMessage: Message = { role: 'user', content: input, timestamp: new Date() }
    setMessages((prev: Message[]) => [...prev, userMessage])
    setInput('')
    setIsSending(true)

    try {
      const apiMessages: ApiChatMessage[] = messages.concat(userMessage).map(m => ({
        role: m.role,
        content: m.content,
      }))
      const res = await sendChatMessage({ messages: apiMessages, phone: activeChat.phone })
      setMessages((prev: Message[]) => [...prev, { role: 'assistant', content: res.response, timestamp: new Date() }])
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error)
      setMessages((prev: Message[]) => [...prev, { role: 'assistant', content: 'Desculpe, houve um erro. Tente novamente.', timestamp: new Date() }])
    } finally {
      setIsSending(false)
    }
  }

  const handleToggleAI = async () => {
    if (!activeChat || isTogglingAI) return
    setIsTogglingAI(true)
    setToggleError('')
    try {
      const res = await toggleChatAI(activeChat.id)
      const updated = res.data
      setActiveChat(prev => prev ? { ...prev, aiPaused: updated.aiPaused } : null)
      setChats(prev => prev.map(c => c.id === updated.id ? { ...c, aiPaused: updated.aiPaused } : c))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao alternar IA'
      setToggleError(msg)
      setTimeout(() => setToggleError(''), 4000)
    } finally {
      setIsTogglingAI(false)
    }
  }

  const handleTransfer = async (doctorId: string) => {
    if (!activeChat) return
    try {
      const res = await transferChat(activeChat.id, doctorId)
      // Se o médico não tem telefone, a transferência foi imediata (pending=false)
      if (!res.pending) {
        setChats(prev => prev.map(c => c.id === activeChat.id ? { ...c, status: 'TRANSFERRED_TO_DOCTOR' as const, transferredToDoctorId: doctorId } : c))
        setActiveChat(prev => prev ? { ...prev, status: 'TRANSFERRED_TO_DOCTOR' as const, transferredToDoctorId: doctorId } : null)
      } else {
        // Marca como aguardando confirmação
        setChats(prev => prev.map(c => c.id === activeChat.id ? { ...c, pendingTransferDoctorId: doctorId } : c))
        setActiveChat(prev => prev ? { ...prev, pendingTransferDoctorId: doctorId } : null)
        setTransferInfo({ chatId: activeChat.id, message: res.message })
        setTimeout(() => setTransferInfo(null), 8000)
      }
    } catch (error) {
      console.error('Erro ao transferir chat:', error)
    }
  }

  const handleReturn = async () => {
    if (!activeChat) return
    try {
      await returnChat(activeChat.id)
      setChats(prev => prev.map(c => c.id === activeChat.id ? { ...c, status: 'ACTIVE' as const, transferredToDoctorId: undefined, pendingTransferDoctorId: undefined } : c))
      setActiveChat(prev => prev ? { ...prev, status: 'ACTIVE' as const, transferredToDoctorId: undefined, pendingTransferDoctorId: undefined } : null)
    } catch (error) {
      console.error('Erro ao retornar chat:', error)
    }
  }

  // ── Pegar Chat (duplo clique) ──────────────────────────────────────────────
  const handleChatClick = (chat: Chat) => {
    if (clickTimerRef.current) {
      // Segundo clique dentro de 400ms = duplo clique
      clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
      handleTakeChat(chat)
    } else {
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null
        setActiveChat(chat)
      }, 400)
    }
  }

  const handleTakeChat = async (chat: Chat) => {
    // Pausa a IA se ainda não estiver pausada
    if (!chat.aiPaused) {
      try {
        await toggleChatAI(chat.id)
        setChats(prev => prev.map(c => c.id === chat.id ? { ...c, aiPaused: true } : c))
        setActiveChat(prev => prev?.id === chat.id ? { ...prev, aiPaused: true } : prev)
      } catch {
        // continua mesmo se falhar
      }
    }
    setTakenChat({ ...chat, aiPaused: true })
  }

  const handleReturnTakenChat = async () => {
    if (!takenChat) return
    // Retoma a IA
    try {
      await toggleChatAI(takenChat.id)
      setChats(prev => prev.map(c => c.id === takenChat.id ? { ...c, aiPaused: false } : c))
      setActiveChat(prev => prev?.id === takenChat.id ? { ...prev, aiPaused: false } : prev)
    } catch {
      // continua mesmo se falhar
    }
    setTakenChat(null)
  }

  if (loading) {
    return <div className="flex justify-center items-center h-64 text-slate-500">Carregando chats…</div>
  }

  return (
    <div className="flex h-full max-h-full bg-white rounded-xl border border-surface-border overflow-hidden">
      {/* ── Lista de chats ─────────────────────────────────────── */}
      <div className="w-72 border-r border-surface-border flex flex-col shrink-0">
        <div className="p-4 border-b border-surface-border flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Chats</h2>
            <p className="text-xs text-slate-400 mt-0.5">Duplo clique = pegar chat</p>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => setShowBulkMessage(true)}
              className="btn-outline text-xs px-2.5 py-1.5"
              title="Enviar mensagem para todos os pacientes"
            >
              📢 Em massa
            </button>
            <button onClick={() => setShowNewMessage(true)} className="btn-primary text-xs px-3 py-1.5">
              + Nova mensagem
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-surface-border">
          {chats.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-10">Nenhum chat ativo.</p>
          )}
          {chats.map(chat => {
            const displayName = resolveChatName(chat)
            const subtitle = resolveChatSubtitle(chat)
            return (
              <button
                key={chat.id}
                onClick={() => handleChatClick(chat)}
                title="Clique para ver · Duplo clique para pegar o chat"
                className={`w-full text-left p-4 hover:bg-cream-50 transition-colors ${
                  activeChat?.id === chat.id ? 'bg-primary-50 border-l-4 border-l-primary-500' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 text-sm truncate">{displayName}</p>
                    <p className="text-xs text-slate-500 truncate">{subtitle}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {chat.aiPaused && (
                      <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-slate-100 text-slate-500">
                        IA off
                      </span>
                    )}
                    {chat.pendingTransferDoctorId && (
                      <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-blue-100 text-blue-700">
                        Aguard. médico
                      </span>
                    )}
                    {chat.schedulingStatus === 'agendado' && (
                      <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-green-100 text-green-700">
                        Agendado
                      </span>
                    )}
                    {chat.schedulingStatus === 'em_andamento' && (
                      <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-yellow-100 text-yellow-700">
                        Em andamento
                      </span>
                    )}
                    {chat.schedulingStatus === 'cancelado' && (
                      <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-red-100 text-red-700">
                        Desistiu
                      </span>
                    )}
                    {chat.status === 'TRANSFERRED_TO_DOCTOR' && (
                      <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-amber-100 text-amber-700">
                        Transferido
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Área de conversa ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeChat ? (
          <>
            {/* Cabeçalho do chat */}
            <div className="bg-white border-b border-surface-border p-4 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-semibold text-slate-800">{resolveChatName(activeChat)}</h3>
                <p className="text-sm text-slate-500">{resolveChatSubtitle(activeChat)} · {activeChat.phone}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {toggleError && <span className="text-xs text-red-600">{toggleError}</span>}
                {transferInfo && transferInfo.chatId === activeChat.id && (
                  <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">{transferInfo.message}</span>
                )}
                <div className="flex items-center gap-2">
                  {/* Botão Pausar/Retomar IA — toggle manual apenas */}
                  <button
                    onClick={handleToggleAI}
                    disabled={isTogglingAI}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 ${
                      activeChat.aiPaused
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    }`}
                    title={activeChat.aiPaused ? 'IA pausada — clique para retomar' : 'IA ativa — clique para pausar'}
                  >
                    {isTogglingAI ? '…' : activeChat.aiPaused ? '▶ Retomar IA' : '⏸ Pausar IA'}
                  </button>

                  {/* Transferência ou retorno */}
                  {activeChat.status === 'TRANSFERRED_TO_DOCTOR' ? (
                    <button
                      onClick={handleReturn}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                    >
                      ↩ Retornar chat
                    </button>
                  ) : activeChat.pendingTransferDoctorId ? (
                    <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-100 text-blue-700">
                      ⏳ Aguardando médico…
                    </span>
                  ) : (
                    <select
                      className="input text-sm max-w-[220px]"
                      onChange={e => e.target.value && handleTransfer(e.target.value)}
                      value=""
                    >
                      <option value="">Transferir para médico…</option>
                      {doctors.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.specialty} — {d.user?.name ?? d.crm}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-cream-50">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary-600 text-white rounded-br-none'
                      : 'bg-white text-slate-800 border border-surface-border rounded-bl-none'
                  }`}>
                    <p>{msg.content}</p>
                    <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-primary-200' : 'text-slate-400'}`}>
                      {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="bg-white border-t border-surface-border p-4 shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  placeholder="Digite sua mensagem…"
                  className="input flex-1"
                  disabled={isSending}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!input.trim() || isSending}
                  className="btn-primary disabled:opacity-50"
                >
                  {isSending ? 'Enviando…' : 'Enviar'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <div className="text-center space-y-2">
              <p className="text-4xl">💬</p>
              <p className="text-sm">Selecione um chat para começar</p>
              <p className="text-xs">ou clique em <strong>+ Nova mensagem</strong> para iniciar uma conversa</p>
              <p className="text-xs text-slate-300">Dica: duplo clique em um chat para pegá-lo</p>
            </div>
          </div>
        )}
      </div>

      {/* Modal de nova mensagem */}
      {showNewMessage && <NewMessageModal onClose={() => setShowNewMessage(false)} />}

      {/* Modal de mensagem em massa */}
      {showBulkMessage && <BulkMessageModal onClose={() => setShowBulkMessage(false)} />}

      {/* Modal: Chat Pegado */}
      {takenChat && (
        <TakenChatModal
          chat={takenChat}
          onReturn={handleReturnTakenChat}
        />
      )}
    </div>
  )
}
