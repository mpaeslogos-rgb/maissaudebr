'use client'

import { useEffect, useState } from 'react'
import { getToken } from '@/lib/api'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface ClinicConfig {
  id?: string
  key?: string

  clinicName: string
  whatsappNumber: string
  attendanceHours: string
  specialties: string

  telemedicinePlatform: string
  telemedicineLinkInfo: string
  telemedicineInstructions: string
  linkSendTime: string

  defaultConsultationFee: string
  pixKey: string
  paymentLink: string
  paymentMethods: string
  paymentInstructions: string

  confirmationPolicy: string
  cancellationPolicy: string

  welcomeMessage: string
  confirmationMessage: string
  reminderMessage: string
  paymentReminderMessage: string
  humanTransferMessage: string
  emergencyMessage: string

  otherSettings: string
}

const EMPTY_CONFIG: ClinicConfig = {
  clinicName: '',
  whatsappNumber: '',
  attendanceHours: '',
  specialties: '',

  telemedicinePlatform: '',
  telemedicineLinkInfo: '',
  telemedicineInstructions: '',
  linkSendTime: '',

  defaultConsultationFee: '',
  pixKey: '',
  paymentLink: '',
  paymentMethods: '',
  paymentInstructions: '',

  confirmationPolicy: '',
  cancellationPolicy: '',

  welcomeMessage: '',
  confirmationMessage: '',
  reminderMessage: '',
  paymentReminderMessage: '',
  humanTransferMessage: '',
  emergencyMessage: '',

  otherSettings: '',
}

export default function ConfiguracoesPage() {
  const [config, setConfig] = useState<ClinicConfig>(EMPTY_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    async function loadConfig() {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`${API_URL}/api/config`, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${getToken() ?? ''}` },
        })

        if (!response.ok) {
          throw new Error(`Erro ${response.status}`)
        }

        const json = await response.json()

        setConfig({
          ...EMPTY_CONFIG,
          ...json.data,
        })
      } catch (err) {
        console.error('[CONFIG LOAD ERROR]', err)
        setError('Não foi possível carregar as configurações.')
      } finally {
        setLoading(false)
      }
    }

    loadConfig()
  }, [])

  function updateField(field: keyof ClinicConfig, value: string) {
    setConfig((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const response = await fetch(`${API_URL}/api/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken() ?? ''}`,
        },
        body: JSON.stringify(config),
      })

      if (!response.ok) {
        throw new Error(`Erro ${response.status}`)
      }

      const json = await response.json()

      setConfig({
        ...EMPTY_CONFIG,
        ...json.data,
      })

      setSuccess('Configurações salvas com sucesso.')
    } catch (err) {
      console.error('[CONFIG SAVE ERROR]', err)
      setError('Não foi possível salvar as configurações.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3 rounded-xl bg-white px-5 py-4 shadow-sm border border-gray-200">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <span className="text-sm text-gray-600">Carregando configurações...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50">
      <div className="border-b border-gray-200 bg-white px-6 py-5 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Configurações do Atendimento WhatsApp
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure as informações usadas pela IA para atender pacientes da clínica de telemedicina.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto max-w-6xl px-6 py-6">
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            ✅ {success}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Section
            title="Dados da clínica"
            description="Informações básicas que a IA poderá usar no atendimento."
          >
            <Input
              label="Nome da clínica"
              value={config.clinicName}
              onChange={(value) => updateField('clinicName', value)}
              placeholder="Ex: maissaudebr"
            />

            <Input
              label="WhatsApp oficial"
              value={config.whatsappNumber}
              onChange={(value) => updateField('whatsappNumber', value)}
              placeholder="Ex: +55 11 99999-9999"
            />

            <Textarea
              label="Horário de atendimento"
              value={config.attendanceHours}
              onChange={(value) => updateField('attendanceHours', value)}
              placeholder="Ex: Segunda a sexta, das 08:00 às 18:00"
              rows={3}
            />

            <Textarea
              label="Especialidades atendidas"
              value={config.specialties}
              onChange={(value) => updateField('specialties', value)}
              placeholder="Ex: Clínica médica, psiquiatria, dermatologia, nutrição..."
              rows={4}
            />
          </Section>

          <Section
            title="Telemedicina"
            description="Explique como funciona a consulta online."
          >
            <Input
              label="Plataforma de telemedicina"
              value={config.telemedicinePlatform}
              onChange={(value) => updateField('telemedicinePlatform', value)}
              placeholder="Ex: Google Meet, Zoom, plataforma própria..."
            />

            <Textarea
              label="Informação sobre envio do link"
              value={config.telemedicineLinkInfo}
              onChange={(value) => updateField('telemedicineLinkInfo', value)}
              placeholder="Ex: O link será enviado pelo WhatsApp antes da consulta."
              rows={3}
            />

            <Input
              label="Quando o link é enviado?"
              value={config.linkSendTime}
              onChange={(value) => updateField('linkSendTime', value)}
              placeholder="Ex: Após confirmação do pagamento."
            />

            <Textarea
              label="Instruções para a teleconsulta"
              value={config.telemedicineInstructions}
              onChange={(value) => updateField('telemedicineInstructions', value)}
              placeholder="Ex: Estar em local tranquilo, com internet estável..."
              rows={5}
            />
          </Section>

          <Section
            title="Pagamentos"
            description="Informações para a IA orientar o paciente sobre pagamento."
          >
            <Input
              label="Valor padrão da consulta"
              value={config.defaultConsultationFee}
              onChange={(value) => updateField('defaultConsultationFee', value)}
              placeholder="Ex: R$ 150,00"
            />

            <Input
              label="Chave PIX"
              value={config.pixKey}
              onChange={(value) => updateField('pixKey', value)}
              placeholder="Ex: CNPJ, e-mail, telefone ou chave aleatória"
            />

            <Input
              label="Link de pagamento"
              value={config.paymentLink}
              onChange={(value) => updateField('paymentLink', value)}
              placeholder="Ex: link do checkout ou gateway"
            />

            <Textarea
              label="Formas de pagamento"
              value={config.paymentMethods}
              onChange={(value) => updateField('paymentMethods', value)}
              placeholder="Ex: PIX, cartão de crédito, cartão de débito..."
              rows={3}
            />

            <Textarea
              label="Instruções de pagamento"
              value={config.paymentInstructions}
              onChange={(value) => updateField('paymentInstructions', value)}
              placeholder="Ex: A consulta será confirmada após identificação do pagamento."
              rows={4}
            />
          </Section>

          <Section
            title="Políticas da clínica"
            description="Regras para confirmação, cancelamento e remarcação."
          >
            <Textarea
              label="Política de confirmação"
              value={config.confirmationPolicy}
              onChange={(value) => updateField('confirmationPolicy', value)}
              placeholder="Ex: O horário é confirmado após pagamento."
              rows={5}
            />

            <Textarea
              label="Política de cancelamento/remarcação"
              value={config.cancellationPolicy}
              onChange={(value) => updateField('cancellationPolicy', value)}
              placeholder="Ex: Remarcações devem ser solicitadas com antecedência..."
              rows={5}
            />
          </Section>

          <Section
            title="Mensagens automáticas"
            description="Modelos de mensagens que a IA pode usar no WhatsApp."
          >
            <Textarea
              label="Mensagem de boas-vindas"
              value={config.welcomeMessage}
              onChange={(value) => updateField('welcomeMessage', value)}
              rows={4}
            />

            <Textarea
              label="Mensagem de confirmação"
              value={config.confirmationMessage}
              onChange={(value) => updateField('confirmationMessage', value)}
              rows={4}
            />

            <Textarea
              label="Mensagem de lembrete"
              value={config.reminderMessage}
              onChange={(value) => updateField('reminderMessage', value)}
              rows={4}
            />

            <Textarea
              label="Mensagem de cobrança/pagamento pendente"
              value={config.paymentReminderMessage}
              onChange={(value) => updateField('paymentReminderMessage', value)}
              rows={4}
            />
          </Section>

          <Section
            title="Segurança e encaminhamento"
            description="Regras para atendimento humano e situações de urgência."
          >
            <Textarea
              label="Mensagem para encaminhar ao humano"
              value={config.humanTransferMessage}
              onChange={(value) => updateField('humanTransferMessage', value)}
              rows={4}
            />

            <Textarea
              label="Mensagem para urgência/emergência"
              value={config.emergencyMessage}
              onChange={(value) => updateField('emergencyMessage', value)}
              rows={5}
            />

            <Textarea
              label="Regras adicionais para a IA"
              value={config.otherSettings}
              onChange={(value) => updateField('otherSettings', value)}
              placeholder="Ex: A IA não deve prescrever, diagnosticar ou interpretar exames..."
              rows={7}
            />
          </Section>
        </div>

        <div className="sticky bottom-0 mt-6 border-t border-gray-200 bg-gray-50 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-500">
              Essas informações serão usadas para orientar o atendimento automático no WhatsApp.
            </p>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {saving ? 'Salvando...' : 'Salvar configurações'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>

      <div className="space-y-4">{children}</div>
    </section>
  )
}

function Input({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  )
}

function Textarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="block w-full resize-y rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  )
}