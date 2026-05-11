'use client'

import { useEffect, useState, useRef } from 'react'
import { getChats, getDoctors, sendChatMessage, transferChat, Chat, Doctor, ChatMessage as ApiChatMessage } from '@/lib/api'

type Message = {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function ChatsPage() {
  const [chats, setChats] = useState<Chat[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [activeChat, setActiveChat] = useState<Chat | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [patientTypes, setPatientTypes] = useState<Record<string, string>>({})

  useEffect(() => {
    loadChats()
    loadDoctors()
  }, [])

  useEffect(() => {
    if (activeChat) {
      // Simular mensagens do chat ativo
      setMessages([
        { role: 'assistant', content: 'Olá! Como posso ajudar?', timestamp: new Date() },
        { role: 'user', content: 'Gostaria de agendar uma consulta.', timestamp: new Date() },
      ])
    }
  }, [activeChat])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadChats = async () => {
    try {
      const res = await getChats({ limit: 50 })
      setChats(res.data)
      
      // Carregar tipos de paciente
      const types: Record<string, string> = {}
      for (const chat of res.data) {
        types[chat.id] = await getPatientType(chat)
      }
      setPatientTypes(types)
      
      if (res.data.length > 0 && !activeChat) {
        setActiveChat(res.data[0])
      }
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
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsSending(true)

    try {
      const apiMessages: ApiChatMessage[] = messages.concat(userMessage).map(m => ({
        role: m.role,
        content: m.content,
      }))

      const res = await sendChatMessage({ messages: apiMessages, phone: activeChat.phone })
      
      const assistantMessage: Message = { role: 'assistant', content: res.response, timestamp: new Date() }
      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error)
      const errorMessage: Message = { role: 'assistant', content: 'Desculpe, houve um erro. Tente novamente.', timestamp: new Date() }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsSending(false)
    }
  }

  const handleTransfer = async (doctorId: string) => {
    if (!activeChat) return
    try {
      await transferChat(activeChat.id, doctorId)
      // Atualizar status do chat
      setChats(prev => prev.map(c => c.id === activeChat.id ? { ...c, status: 'TRANSFERRED_TO_DOCTOR', transferredToDoctorId: doctorId } : c))
      setActiveChat(prev => prev ? { ...prev, status: 'TRANSFERRED_TO_DOCTOR', transferredToDoctorId: doctorId } : null)
    } catch (error) {
      console.error('Erro ao transferir chat:', error)
    }
  }

  const getPatientType = async (chat: Chat) => {
    if (!chat.patientId) return 'novo'
    
    try {
      // Buscar histórico de consultas do paciente
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/appointments?patientId=${chat.patientId}&take=1`)
      const data = await response.json()
      
      if (data.data && data.data.length > 0) {
        return 'retorno'
      } else {
        return 'antigo-convertido'
      }
    } catch (error) {
      console.error('Erro ao verificar histórico:', error)
      return 'retorno' // fallback
    }
  }

  if (loading) {
    return <div className="flex justify-center items-center h-64">Carregando chats...</div>
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Lista de chats - Lado esquerdo */}
      <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Chats Ativos</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {chats.map(chat => (
            <div
              key={chat.id}
              className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                activeChat?.id === chat.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
              }`}
              onClick={() => setActiveChat(chat)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-gray-800">{chat.phone}</p>
                  <p className="text-sm text-gray-500 truncate">
                    {chat.patient ? chat.patient.fullName : 'Paciente não identificado'}
                  </p>
                </div>
                <div className="flex flex-col items-end">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    patientTypes[chat.id] === 'novo' ? 'bg-green-100 text-green-800' :
                    patientTypes[chat.id] === 'retorno' ? 'bg-blue-100 text-blue-800' :
                    'bg-purple-100 text-purple-800'
                  }`}>
                    {patientTypes[chat.id] || 'carregando...'}
                  </span>
                  {chat.status === 'TRANSFERRED_TO_DOCTOR' && (
                    <span className="text-xs text-orange-600 mt-1">Transferido</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat ativo - Lado direito */}
      <div className="flex-1 flex flex-col">
        {activeChat ? (
          <>
            {/* Cabeçalho do chat */}
            <div className="bg-white border-b border-gray-200 p-4 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-gray-800">{activeChat.phone}</h3>
                <p className="text-sm text-gray-500">
                  {activeChat.patient ? activeChat.patient.fullName : 'Paciente não identificado'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="text-sm border border-gray-300 rounded px-2 py-1"
                  onChange={(e) => e.target.value && handleTransfer(e.target.value)}
                  defaultValue=""
                >
                  <option value="">Transferir para médico</option>
                  {doctors.map(doctor => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.specialty} - {doctor.crm}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, index) => (
                <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'
                  }`}>
                    <p>{msg.content}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {msg.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="bg-white border-t border-gray-200 p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Digite sua mensagem..."
                  className="flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isSending}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!input.trim() || isSending}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
                >
                  {isSending ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Selecione um chat para começar
          </div>
        )}
      </div>
    </div>
  )
}