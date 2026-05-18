'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { getChats, getDoctors, sendChatMessage, transferChat, returnChat, getContacts, sendWhatsAppMessage, getChatMessages, toggleChatAI } from '@/lib/api'
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

  // Agrupa contatos por tipo
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
        {/* Cabeçalho */}
        <div className="flex items-center justify-between p-5 border-b border-surface-border shrink-0">
          <h2 className="text-base font-semibold text-slate-800">Nova Mensagem WhatsApp</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Painel esquerdo: lista de contatos */}
          <div className="w-64 border-r border-surface-border flex flex-col shrink-0">
            <div className="p-3 border-b border-surface-border">
              <input
                value={search}
                onChange={handleSearchChange}
                placeholder="Buscar contato…"
                className="input text-sm"
              />
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingContacts && (
                <p className="text-center text-slate-400 text-sm py-6">Buscando…</p>
              )}

              {!loadingContacts && contacts.length === 0 && (
                <p className="text-center text-slate-400 text-sm py-6">Nenhum contato encontrado.</p>
              )}

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
                        className={`w-full text-left px-3 py-2.5 border-b border-surface-border hover:bg-cream-100 transition-colors ${
                          selected?.id === c.id ? 'bg-primary-50 border-l-4 border-l-primary-500' : ''
                        }`}
                      >
                        <p className="text-sm font-medium text-slate-800 truncate">{c.name}</p>
                        <p className="text-xs text-slate-400 truncate">
                          {c.phone ?? 'Sem telefone'} · {c.detail}
                        </p>
                      </button>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Painel direito: composição da mensagem */}
          <div className="flex-1 flex flex-col p-5 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
            )}

            {/* Contato selecionado */}
            {selected ? (
              <div className="bg-primary-50 border border-primary-200 rounded-lg px-4 py-3 flex items-center gap-3">
                <span className="text-xl">{TYPE_ICON[selected.type]}</span>
                <div>
                  <p className="text-sm font-medium text-primary-800">{selected.name}</p>
                  <p className="text-xs text-primary-600">{TYPE_LABEL[selected.type]} · {selected.detail}</p>
                </div>
                <button
                  onClick={() => { setSelected(null); setPhone('') }}
                  className="ml-auto text-primary-400 hover:text-primary-600"
                >×</button>
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">← Selecione um contato ou informe o número abaixo.</p>
            )}

            {/* Número (editável — obrigatório para fornecedores sem telefone) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Número WhatsApp <span className="text-red-500">*</span>
                {selected && !selected.phone && (
                  <span className="ml-2 text-xs text-amber-600 font-normal">Este contato não tem telefone cadastrado</span>
                )}
              </label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="(11) 99999-0000"
                className="input"
              />
              <p className="text-xs text-slate-400 mt-1">DDD + número. O código +55 é adicionado automaticamente.</p>
            </div>

            {/* Mensagem */}
            <div className="flex-1 flex flex-col">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Mensagem <span className="text-red-500">*</span>
              </label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Digite sua mensagem…"
                className="input resize-none flex-1 min-h-[120px]"
              />
            </div>

            {/* Rodapé */}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={onClose} className="btn-outline">Cancelar</button>
              <button
                onClick={handleSend}
                disabled={sending || !phone.trim() || !message.trim()}
                className="btn-primary disabled:opacity-50"
              >
                {sending ? 'Enviando…' : '📱 Enviar via WhatsApp'}
              </button>
            </div>
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
  const [isTogglingAI, setIsTogglingAI] = useState(false)
  const [toggleError, setToggleError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

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
      setMessages(res.data.map(m => ({
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
        return res.data.find(c => c.id === prev.id) ?? prev
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

      const assistantMessage: Message = { role: 'assistant', content: res.response, timestamp: new Date() }
      setMessages((prev: Message[]) => [...prev, assistantMessage])
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error)
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Desculpe, houve um erro. Tente novamente.',
        timestamp: new Date(),
      }
      setMessages((prev: Message[]) => [...prev, errorMessage])
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
      await transferChat(activeChat.id, doctorId)
      setChats(prev =>
        prev.map(c =>
          c.id === activeChat.id
            ? { ...c, status: 'TRANSFERRED_TO_DOCTOR' as const, transferredToDoctorId: doctorId }
            : c
        )
      )
      setActiveChat(prev =>
        prev ? { ...prev, status: 'TRANSFERRED_TO_DOCTOR' as const, transferredToDoctorId: doctorId } : null
      )
    } catch (error) {
      console.error('Erro ao transferir chat:', error)
    }
  }

  const handleReturn = async () => {
    if (!activeChat) return
    try {
      await returnChat(activeChat.id)
      setChats(prev =>
        prev.map(c =>
          c.id === activeChat.id
            ? { ...c, status: 'ACTIVE' as const, transferredToDoctorId: undefined }
            : c
        )
      )
      setActiveChat(prev =>
        prev ? { ...prev, status: 'ACTIVE' as const, transferredToDoctorId: undefined } : null
      )
    } catch (error) {
      console.error('Erro ao retornar chat:', error)
    }
  }

  if (loading) {
    return <div className="flex justify-center items-center h-64 text-slate-500">Carregando chats…</div>
  }

  return (
    <div className="flex h-full max-h-full bg-white rounded-xl border border-surface-border overflow-hidden">
      {/* ── Lista de chats ─────────────────────────────────────── */}
      <div className="w-72 border-r border-surface-border flex flex-col shrink-0">
        <div className="p-4 border-b border-surface-border flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">Chats</h2>
          <button
            onClick={() => setShowNewMessage(true)}
            className="btn-primary text-xs px-3 py-1.5"
          >
            + Nova mensagem
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-surface-border">
          {chats.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-10">Nenhum chat ativo.</p>
          )}
          {chats.map(chat => (
            <button
              key={chat.id}
              onClick={() => setActiveChat(chat)}
              className={`w-full text-left p-4 hover:bg-cream-50 transition-colors ${
                activeChat?.id === chat.id ? 'bg-primary-50 border-l-4 border-l-primary-500' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 text-sm truncate">{chat.phone}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {chat.patient ? chat.patient.fullName : 'Paciente não identificado'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
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
          ))}
        </div>
      </div>

      {/* ── Área de conversa ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeChat ? (
          <>
            {/* Cabeçalho do chat */}
            <div className="bg-white border-b border-surface-border p-4 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-semibold text-slate-800">{activeChat.phone}</h3>
                <p className="text-sm text-slate-500">
                  {activeChat.patient ? activeChat.patient.fullName : 'Paciente não identificado'}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {toggleError && (
                  <span className="text-xs text-red-600">{toggleError}</span>
                )}
                <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleAI}
                  disabled={isTogglingAI}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 ${
                    activeChat.aiPaused
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                  }`}
                  title={activeChat.aiPaused ? 'Clique para reativar a IA' : 'Clique para pausar a IA'}
                >
                  {isTogglingAI ? '…' : activeChat.aiPaused ? '▶ Retomar IA' : '⏸ Pausar IA'}
                </button>
                {activeChat.status === 'TRANSFERRED_TO_DOCTOR' ? (
                  <button
                    onClick={handleReturn}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                  >
                    ↩ Retornar chat
                  </button>
                ) : (
                  <select
                    className="input text-sm max-w-[220px]"
                    onChange={e => e.target.value && handleTransfer(e.target.value)}
                    defaultValue=""
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
            </div>
          </div>
        )}
      </div>

      {/* Modal de nova mensagem */}
      {showNewMessage && <NewMessageModal onClose={() => setShowNewMessage(false)} />}
    </div>
  )
}
