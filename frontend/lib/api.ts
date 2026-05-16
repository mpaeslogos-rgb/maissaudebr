// lib/api.ts
// Fetch wrapper centralizado — formato real do backend confirmado

import type {
  LoginResponse,
  PatientListResponse, Patient,
  DoctorListResponse, Doctor,
  AppointmentListResponse, Appointment,
  PaymentListResponse, Payment, PaymentSummary,
  AccountPayableListResponse, AccountPayable,
  MedicalRecordListResponse, MedicalRecord,
  ChatListResponse, Chat, ChatMessage,
  ApiError,
  Exam,
} from './types'

// ─── URL base ────────────────────────────────────────────────────────────────
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// ─── Chave do localStorage ────────────────────────────────────────────────────
export const TOKEN_KEY = 'maissaudebr_token'

// ─── Helpers de token ─────────────────────────────────────────────────────────

export function saveToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export function isAuthenticated(): boolean {
  return !!getToken()
}

// ─── Classe de erro customizada ───────────────────────────────────────────────

export class ApiException extends Error {
  public status: number
  public data: ApiError

  constructor(status: number, data: ApiError) {
    super(data.error || 'Erro desconhecido')
    this.name = 'ApiException'
    this.status = status
    this.data = data
  }
}

// ─── Função base de fetch ─────────────────────────────────────────────────────

interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  token?: string
  isFormData?: boolean
}

async function apiFetch<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { method = 'GET', body, isFormData = false } = options
  const token = options.token ?? getToken()
  const headers: HeadersInit = {}

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  if (!isFormData && body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const config: RequestInit = { method, headers }

  if (body !== undefined) {
    config.body = isFormData
      ? (body as FormData)
      : JSON.stringify(body)
  }

  let response: Response
  try {
    response = await fetch(`${API_URL}${endpoint}`, config)
  } catch {
    throw new ApiException(0, {
      error: 'Não foi possível conectar ao servidor. Verifique sua conexão.',
    })
  }

  let responseData: unknown
  try {
    responseData = await response.json()
  } catch {
    responseData = {}
  }

  if (!response.ok) {
    throw new ApiException(response.status, responseData as ApiError)
  }

  return responseData as T
}

// ─── Métodos HTTP ─────────────────────────────────────────────────────────────

export function apiGet<T>(endpoint: string): Promise<T> {
  return apiFetch<T>(endpoint, { method: 'GET' })
}

export function apiPost<T>(endpoint: string, body: unknown): Promise<T> {
  return apiFetch<T>(endpoint, { method: 'POST', body })
}

export function apiPut<T>(endpoint: string, body: unknown): Promise<T> {
  return apiFetch<T>(endpoint, { method: 'PUT', body })
}

export function apiPatch<T>(endpoint: string, body: unknown): Promise<T> {
  return apiFetch<T>(endpoint, { method: 'PATCH', body })
}

export function apiDelete<T>(endpoint: string): Promise<T> {
  return apiFetch<T>(endpoint, { method: 'DELETE' })
}

export function apiUpload<T>(endpoint: string, formData: FormData): Promise<T> {
  return apiFetch<T>(endpoint, { method: 'POST', body: formData, isFormData: true })
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function loginUser(
  email: string,
  password: string
): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
    token: undefined,
  })
}

export async function registerUser(data: {
  name: string
  email: string
  password: string
  role?: string
}): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/register', {
    method: 'POST',
    body: data,
    token: undefined,
  })
}

// ─── Pacientes ────────────────────────────────────────────────────────────────

export function getPatients(params?: {
  page?: number
  limit?: number
  search?: string
}): Promise<PatientListResponse> {
  const query = new URLSearchParams()
  if (params?.page)   query.set('page', String(params.page))
  if (params?.limit)  query.set('limit', String(params.limit))
  if (params?.search) query.set('search', params.search)
  const qs = query.toString()
  return apiGet<PatientListResponse>(`/patients${qs ? `?${qs}` : ''}`)
}

export function getPatient(id: string): Promise<{ data: Patient }> {
  return apiGet<{ data: Patient }>(`/patients/${id}`)
}

export function createPatient(data: Partial<Patient>): Promise<{ data: Patient }> {
  return apiPost<{ data: Patient }>('/patients', data)
}

export function updatePatient(id: string, data: Partial<Patient>): Promise<{ data: Patient }> {
  return apiPatch<{ data: Patient }>(`/patients/${id}`, data)
}

export function deletePatient(id: string): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/patients/${id}`)
}

export function bulkImportPatients(file: File): Promise<{ message: string; data: Patient[] }> {
  const formData = new FormData()
  formData.append('file', file)
  return apiUpload<{ message: string; data: Patient[] }>('/patients/bulk-import', formData)
}

// ─── Médicos ──────────────────────────────────────────────────────────────────

export function getDoctors(params?: {
  page?: number
  limit?: number
  search?: string
}): Promise<DoctorListResponse> {
  const query = new URLSearchParams()
  if (params?.limit)  query.set('take', String(params.limit))
  if (params?.page && params?.limit) query.set('skip', String((params.page - 1) * params.limit))
  if (params?.search) query.set('q', params.search)
  const qs = query.toString()
  return apiGet<DoctorListResponse>(`/doctors${qs ? `?${qs}` : ''}`)
}

export function getDoctor(id: string): Promise<Doctor> {
  return apiGet<Doctor>(`/doctors/${id}`)
}

export function createDoctor(data: unknown): Promise<Doctor> {
  return apiPost<Doctor>('/doctors', data)
}

export function updateDoctor(id: string, data: unknown): Promise<Doctor> {
  return apiPatch<Doctor>(`/doctors/${id}`, data)
}

export function deleteDoctor(id: string): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/doctors/${id}`)
}

// ─── Agendamentos ─────────────────────────────────────────────────────────────

export function getAppointments(params?: {
  page?: number
  limit?: number
  patientId?: string
  doctorId?: string
  status?: string
}): Promise<AppointmentListResponse> {
  const query = new URLSearchParams()
  if (params?.page)      query.set('page', String(params.page))
  if (params?.limit)     query.set('limit', String(params.limit))
  if (params?.patientId) query.set('patientId', params.patientId)
  if (params?.doctorId)  query.set('doctorId', params.doctorId)
  if (params?.status)    query.set('status', params.status)
  const qs = query.toString()
  return apiGet<AppointmentListResponse>(`/appointments${qs ? `?${qs}` : ''}`)
}

export function getAppointment(id: string): Promise<{ data: Appointment }> {
  return apiGet<{ data: Appointment }>(`/appointments/${id}`)
}

export function createAppointment(data: unknown): Promise<{ data: Appointment }> {
  return apiPost<{ data: Appointment }>('/appointments', data)
}

export function updateAppointment(id: string, data: unknown): Promise<{ data: Appointment }> {
  return apiPatch<{ data: Appointment }>(`/appointments/${id}`, data)
}

export function cancelAppointment(id: string): Promise<{ data: Appointment }> {
  return apiPatch<{ data: Appointment }>(`/appointments/${id}`, { status: 'CANCELLED' })
}

export function confirmAppointment(id: string): Promise<{ data: Appointment }> {
  return apiPatch<{ data: Appointment }>(`/appointments/${id}`, { status: 'CONFIRMED' })
}

// ─── Pagamentos ───────────────────────────────────────────────────────────────

export function getPayments(params?: {
  take?: number
  skip?: number
  status?: string
  patientId?: string
  from?: string
  to?: string
  overdueOnly?: boolean
}): Promise<PaymentListResponse> {
  const query = new URLSearchParams()
  if (params?.take)        query.set('take', String(params.take))
  if (params?.skip)        query.set('skip', String(params.skip))
  if (params?.status)      query.set('status', params.status)
  if (params?.patientId)   query.set('patientId', params.patientId)
  if (params?.from)        query.set('from', params.from)
  if (params?.to)          query.set('to', params.to)
  if (params?.overdueOnly) query.set('overdueOnly', 'true')
  const qs = query.toString()
  return apiGet<PaymentListResponse>(`/payments${qs ? `?${qs}` : ''}`)
}

export function getPayment(id: string): Promise<{ data: Payment }> {
  return apiGet<{ data: Payment }>(`/payments/${id}`)
}

export function createPayment(data: unknown): Promise<{ data: Payment }> {
  return apiPost<{ data: Payment }>('/payments', data)
}

export function payPayment(
  id: string,
  data?: { method?: string; paidAt?: string }
): Promise<{ data: Payment }> {
  return apiPost<{ data: Payment }>(`/payments/${id}/pay`, data ?? {})
}

export function refundPayment(id: string): Promise<{ data: Payment }> {
  return apiPost<{ data: Payment }>(`/payments/${id}/refund`, {})
}

// ─── Chats ───────────────────────────────────────────────────────────────────

export function getChats(params?: {
  page?: number
  limit?: number
  search?: string
}): Promise<ChatListResponse> {
  const query = new URLSearchParams()
  if (params?.limit)  query.set('take', String(params.limit))
  if (params?.page && params?.limit) query.set('skip', String((params.page - 1) * params.limit))
  if (params?.search) query.set('search', params.search)
  const qs = query.toString()
  return apiGet<ChatListResponse>(`/api/chats${qs ? `?${qs}` : ''}`)
}

export function getChat(id: string): Promise<{ data: Chat }> {
  return apiGet<{ data: Chat }>(`/api/chats/${id}`)
}

export function sendChatMessage(data: { messages: ChatMessage[]; phone?: string }): Promise<{ response: string }> {
  return apiPost<{ response: string }>('/api/chat', data)
}

export function transferChat(chatId: string, doctorId: string): Promise<{ data: Chat }> {
  return apiPost<{ data: Chat }>(`/api/chats/${chatId}/transfer`, { doctorId })
}

// ─── WhatsApp ─────────────────────────────────────────────────────────────────

export interface Contact {
  id: string
  name: string
  phone: string | null
  detail?: string
  type: 'patient' | 'doctor' | 'supplier'
}

export function getContacts(search?: string): Promise<{ data: Contact[]; total: number }> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : ''
  return apiGet<{ data: Contact[]; total: number }>(`/api/whatsapp/contacts${qs}`)
}

export function sendWhatsAppMessage(to: string, message: string): Promise<{ success: boolean }> {
  return apiPost<{ success: boolean }>('/api/whatsapp/send', { to, message })
}

// Retorna o formato real do backend
export function getPaymentSummary(): Promise<PaymentSummary> {
  return apiGet<PaymentSummary>('/payments/summary')
}

// ─── Contas a Pagar ───────────────────────────────────────────────────────────

export function getAccountsPayable(params?: {
  take?: number
  skip?: number
  status?: string
  category?: string
  overdueOnly?: boolean
  from?: string
  to?: string
}): Promise<AccountPayableListResponse> {
  const query = new URLSearchParams()
  if (params?.take)        query.set('take', String(params.take))
  if (params?.skip)        query.set('skip', String(params.skip))
  if (params?.status)      query.set('status', params.status)
  if (params?.category)    query.set('category', params.category)
  if (params?.overdueOnly) query.set('overdueOnly', 'true')
  if (params?.from)        query.set('from', params.from)
  if (params?.to)          query.set('to', params.to)
  const qs = query.toString()
  return apiGet<AccountPayableListResponse>(`/accounts-payable${qs ? `?${qs}` : ''}`)
}

export function createAccountPayable(data: unknown): Promise<{ data: AccountPayable }> {
  return apiPost<{ data: AccountPayable }>('/accounts-payable', data)
}

export function payAccountPayable(id: string): Promise<{ data: AccountPayable }> {
  return apiPost<{ data: AccountPayable }>(`/accounts-payable/${id}/pay`, {})
}

// ─── Prontuários ──────────────────────────────────────────────────────────────

export function getMedicalRecords(params?: {
  limit?: number
  patientId?: string
  doctorId?: string
  appointmentId?: string
}): Promise<MedicalRecordListResponse> {
  const query = new URLSearchParams()
  if (params?.limit)         query.set('take', String(params.limit))
  if (params?.patientId)     query.set('patientId', params.patientId)
  if (params?.doctorId)      query.set('doctorId', params.doctorId)
  if (params?.appointmentId) query.set('appointmentId', params.appointmentId)
  const qs = query.toString()
  return apiGet<MedicalRecordListResponse>(`/medical-records${qs ? `?${qs}` : ''}`)
}

export function getMedicalRecord(id: string): Promise<MedicalRecord> {
  return apiGet<MedicalRecord>(`/medical-records/${id}`)
}

export function createMedicalRecord(data: unknown): Promise<MedicalRecord> {
  return apiPost<MedicalRecord>('/medical-records', data)
}

export function updateMedicalRecord(id: string, data: unknown): Promise<MedicalRecord> {
  return apiPatch<MedicalRecord>(`/medical-records/${id}`, data)
}


// ─── Configuração da clínica ─────────────────────────────────────────────────

export interface ClinicConfig {
  clinicName: string
  whatsappNumber: string
  attendanceHours: string
  specialties: string
  pixKey: string
  paymentLink: string
  confirmationPolicy: string
  cancellationPolicy: string
}

export function getClinicConfig(): Promise<ClinicConfig> {
  return apiGet<ClinicConfig>('/api/config')
}

// ─── OCR ──────────────────────────────────────────────────────────────────────

export function ocrAnalyze(formData: FormData): Promise<unknown> {
  return apiUpload('/ocr/analyze', formData)
}

export function ocrCreateMedicalRecord(
  formData: FormData
): Promise<{ medicalRecord: MedicalRecord }> {
  return apiUpload<{ medicalRecord: MedicalRecord }>('/ocr/medical-records', formData)
}

export function ocrAttachToMedicalRecord(
  id: string,
  formData: FormData
): Promise<{ medicalRecord: MedicalRecord }> {
  return apiUpload<{ medicalRecord: MedicalRecord }>(
    `/ocr/medical-records/${id}`,
    formData
  )
}

// ─── Exames ───────────────────────────────────────────────────────────────────

export function getExams(params: { patientId?: string; medicalRecordId?: string }): Promise<{ data: Exam[]; total: number }> {
  const qs = new URLSearchParams()
  if (params.patientId)       qs.set('patientId',       params.patientId)
  if (params.medicalRecordId) qs.set('medicalRecordId', params.medicalRecordId)
  return apiGet<{ data: Exam[]; total: number }>(`/api/exams?${qs}`)
}

export function uploadExam(formData: FormData): Promise<Exam> {
  return apiUpload<Exam>('/api/exams', formData)
}

export function deleteExam(id: string): Promise<void> {
  return apiDelete(`/api/exams/${id}`)
}

// ─── Usuários (ADMIN) ──────────────────────────────────────────────────────

export function getUsers(params?: {
  q?: string
  role?: string
  active?: boolean
  take?: number
  skip?: number
}): Promise<{ data: import('./types').User[]; total: number; take: number; skip: number }> {
  const sp = new URLSearchParams()
  if (params?.q)      sp.set('q', params.q)
  if (params?.role)   sp.set('role', params.role)
  if (params?.active !== undefined) sp.set('active', String(params.active))
  if (params?.take)   sp.set('take', String(params.take))
  if (params?.skip)   sp.set('skip', String(params.skip))
  const qs = sp.toString()
  return apiGet(`/api/users${qs ? `?${qs}` : ''}`)
}

export function createUser(data: {
  email: string
  name: string
  role: string
  password: string
}): Promise<import('./types').User> {
  return apiPost('/api/users', data)
}

export function updateUser(id: string, data: {
  name?: string
  role?: string
  isActive?: boolean
}): Promise<import('./types').User> {
  return apiPatch(`/api/users/${id}`, data)
}

export function resetUserPassword(id: string, password: string): Promise<{ success: boolean }> {
  return apiPost(`/api/users/${id}/reset-password`, { password })
}

export function deactivateUser(id: string): Promise<void> {
  return apiDelete(`/api/users/${id}`)
}

// ─── Audit Logs (ADMIN) ────────────────────────────────────────────────────

export function getAuditLogs(params?: {
  entity?: string
  action?: string
  userId?: string
  search?: string
  from?: string
  to?: string
  take?: number
  skip?: number
}): Promise<{ data: import('./types').AuditLog[]; total: number; take: number; skip: number }> {
  const sp = new URLSearchParams()
  if (params?.entity) sp.set('entity', params.entity)
  if (params?.action) sp.set('action', params.action)
  if (params?.userId) sp.set('userId', params.userId)
  if (params?.search) sp.set('search', params.search)
  if (params?.from)   sp.set('from',   params.from)
  if (params?.to)     sp.set('to',     params.to)
  if (params?.take)   sp.set('take',   String(params.take))
  if (params?.skip)   sp.set('skip',   String(params.skip))
  const qs = sp.toString()
  return apiGet(`/api/audit-logs${qs ? `?${qs}` : ''}`)
}

// ─── Fluxo de Caixa ───────────────────────────────────────────────────────────

export interface CashflowMonth {
  month:           string
  entradas:        number
  saidas:          number
  saldo:           number
  saldoAcumulado:  number
}

export interface CashflowData {
  months: CashflowMonth[]
  totals: { entradas: number; saidas: number; saldo: number }
  current: {
    thisMonthEntradas:       number
    thisMonthSaidas:         number
    thisMonthSaldo:          number
    pendingEntradas:         number
    pendingEntradasCount:    number
    pendingSaidas:           number
    pendingSaidasCount:      number
    overdueEntradas:         number
    overdueEntradasCount:    number
    overdueSaidas:           number
    overdueSaidasCount:      number
    upcoming30Entradas:      number
    upcoming30EntradasCount: number
    upcoming30Saidas:        number
    upcoming30SaidasCount:   number
  }
}

export function getCashflow(months = 12): Promise<CashflowData> {
  return apiGet(`/api/financeiro/cashflow?months=${months}`)
}

export function getAuditLogsSummary(): Promise<{
  byAction:    { action: string; count: number }[]
  byEntity:    { entity: string; count: number }[]
  recentUsers: { userId: string | null; name?: string; email?: string; lastAction: string; lastEntity: string; at: string }[]
}> {
  return apiGet('/api/audit-logs/summary')
}