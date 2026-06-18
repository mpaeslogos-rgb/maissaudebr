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
  LeadListResponse, Lead,
  Prescription,
  DoctorPaymentListResponse, DoctorPayment, DoctorPaymentSummaryItem,
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
    const raw = data.error as unknown
    let msg: string
    if (typeof raw === 'string') {
      msg = raw
    } else if (raw && typeof raw === 'object') {
      const fe = (raw as { fieldErrors?: Record<string, string[]> }).fieldErrors
      const msgs = fe ? Object.values(fe).flat() : []
      msg = msgs.length ? msgs.join('; ') : 'Erro de validação. Verifique os dados informados.'
    } else {
      msg = 'Erro desconhecido'
    }
    super(msg)
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

  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem('maissaudebr_user')
    if (typeof window !== 'undefined') {
      window.location.href = '/'
    }
    throw new ApiException(401, responseData as ApiError)
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

export function getPatient(id: string): Promise<Patient> {
  return apiGet<Patient>(`/patients/${id}`)
}

export function createPatient(data: Partial<Patient>): Promise<Patient> {
  return apiPost<Patient>('/patients', data)
}

export function updatePatient(id: string, data: Partial<Patient>): Promise<Patient> {
  return apiPatch<Patient>(`/patients/${id}`, data)
}

export function deletePatient(id: string): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/patients/${id}`)
}

export function getDeletedPatients(params?: {
  page?: number
  limit?: number
}): Promise<PatientListResponse> {
  const take = params?.limit ?? 50
  const skip = params?.page ? (params.page - 1) * take : 0
  return apiGet<PatientListResponse>(`/patients/deleted?take=${take}&skip=${skip}`)
}

export function uploadPatientPhoto(id: string, formData: FormData): Promise<{ photoUrl: string }> {
  return apiFetch<{ photoUrl: string }>(`/patients/${id}/photo`, { method: 'PATCH', body: formData, isFormData: true })
}

// ─── Prescrições ──────────────────────────────────────────────────────────────

export function getPrescriptions(patientId: string): Promise<{ data: Prescription[] }> {
  return apiGet<{ data: Prescription[] }>(`/patients/${patientId}/prescriptions`)
}

export function createPrescription(patientId: string, data: unknown): Promise<Prescription> {
  return apiPost<Prescription>(`/patients/${patientId}/prescriptions`, data)
}

export function deletePrescription(patientId: string, id: string): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/patients/${patientId}/prescriptions/${id}`)
}

// ─── Leads ────────────────────────────────────────────────────────────────────

export function getLeads(params?: { page?: number; limit?: number; search?: string }): Promise<LeadListResponse> {
  const query = new URLSearchParams()
  if (params?.limit)  query.set('take', String(params.limit))
  if (params?.page && params?.limit) query.set('skip', String((params.page - 1) * params.limit))
  if (params?.search) query.set('q', params.search)
  const qs = query.toString()
  return apiGet<LeadListResponse>(`/leads${qs ? `?${qs}` : ''}`)
}

export function deleteLead(id: string): Promise<void> {
  return apiDelete<void>(`/leads/${id}`)
}

export function convertLead(id: string, data: Partial<Patient>): Promise<Patient> {
  return apiPost<Patient>(`/leads/${id}/convert`, data)
}

export function bulkImportLeads(file: File): Promise<{ message: string; count: number }> {
  const formData = new FormData()
  formData.append('file', file)
  return apiUpload<{ message: string; count: number }>('/leads/bulk-import', formData)
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

// ─── Repasses aos médicos ─────────────────────────────────────────────────────

export function getDoctorPayments(params?: {
  doctorId?: string
  status?: DoctorPayment['status']
  from?: string
  to?: string
  take?: number
  skip?: number
}): Promise<DoctorPaymentListResponse> {
  const qs = new URLSearchParams()
  if (params?.doctorId) qs.set('doctorId', params.doctorId)
  if (params?.status)   qs.set('status',   params.status)
  if (params?.from)     qs.set('from',      params.from)
  if (params?.to)       qs.set('to',        params.to)
  if (params?.take)     qs.set('take',      String(params.take))
  if (params?.skip !== undefined) qs.set('skip', String(params.skip))
  return apiGet<DoctorPaymentListResponse>(`/doctor-payments?${qs}`)
}

export function getDoctorPaymentsSummary(): Promise<{ data: DoctorPaymentSummaryItem[] }> {
  return apiGet<{ data: DoctorPaymentSummaryItem[] }>('/doctor-payments/summary')
}

export function markDoctorPaymentsPaid(
  payments: { id: string; nfNumber: string }[],
  notes?: string,
): Promise<{ updated: number }> {
  return apiPost<{ updated: number }>('/doctor-payments/mark-paid', { payments, notes })
}

export function cancelDoctorPayment(id: string): Promise<DoctorPayment> {
  return apiPatch<DoctorPayment>(`/doctor-payments/${id}/cancel`, {})
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

export function transferChat(chatId: string, doctorId: string): Promise<{ data: Chat; pending: boolean; message: string }> {
  return apiPost<{ data: Chat; pending: boolean; message: string }>(`/api/chats/${chatId}/transfer`, { doctorId })
}

export function transferConfirmChat(chatId: string, doctorId: string): Promise<{ data: Chat }> {
  return apiPost<{ data: Chat }>(`/api/chats/${chatId}/transfer-confirm`, { doctorId })
}

export function getChatMessages(chatId: string): Promise<{ data: { id: string; role: 'user' | 'assistant'; content: string; timestamp: string }[] }> {
  return apiGet(`/api/chats/${chatId}/messages`)
}

export function toggleChatAI(chatId: string): Promise<{ data: Chat }> {
  return apiPost<{ data: Chat }>(`/api/chats/${chatId}/toggle-ai`, {})
}

export function returnChat(chatId: string): Promise<{ data: Chat }> {
  return apiPost<{ data: Chat }>(`/api/chats/${chatId}/return`, {})
}

export function sendDirectChatMessage(chatId: string, message: string): Promise<{ ok: boolean }> {
  return apiPost<{ ok: boolean }>(`/api/chats/${chatId}/send`, { message })
}

export interface BulkSendResult {
  sent: number
  failed: number
  total: number
  errors: { name: string; phone: string; reason: string }[]
}

export function sendBulkMessage(message: string): Promise<BulkSendResult> {
  return apiPost<BulkSendResult>('/api/whatsapp/bulk-send', { message })
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

export function deleteAccountPayable(id: string): Promise<{ data: AccountPayable }> {
  return apiDelete<{ data: AccountPayable }>(`/accounts-payable/${id}`)
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
  month:              string
  entradas:           number
  saidas:             number
  saldo:              number
  saldoAcumulado:     number
  projecaoEntradas:   number
  projecaoSaidas:     number
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

// ─── Catálogo de Exames ───────────────────────────────────────────────────────

export interface ExamCatalog {
  id:           string
  name:         string
  description:  string | null
  price:        number
  duration:     number | null
  repasseType:  string | null
  repasseValue: number | null
  isActive:     boolean
  createdAt:    string
  updatedAt:    string
}

export function getExamCatalog(): Promise<ExamCatalog[]> {
  return apiGet('/exam-catalog')
}

export function createExamCatalogItem(data: Omit<ExamCatalog, 'id' | 'createdAt' | 'updatedAt'>): Promise<ExamCatalog> {
  return apiPost('/exam-catalog', data)
}

export function updateExamCatalogItem(id: string, data: Partial<Omit<ExamCatalog, 'id' | 'createdAt' | 'updatedAt'>>): Promise<ExamCatalog> {
  return apiPatch(`/exam-catalog/${id}`, data)
}

export function deleteExamCatalogItem(id: string): Promise<void> {
  return apiDelete(`/exam-catalog/${id}`)
}

// ─── Pedidos de Exame ─────────────────────────────────────────────────────────

export interface ExamOrder {
  id:             string
  patientId:      string
  doctorId:       string
  catalogId:      string
  appointmentId:  string | null
  scheduledAt:    string | null
  completedAt:    string | null
  status:         'PENDING' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  notes:          string | null
  paymentId:      string | null
  doctorPaymentId: string | null
  catalog:        ExamCatalog
  patient:        { id: string; fullName: string }
  doctor:         { id: string; user: { name: string } }
  payment:        { amount: number; status: string } | null
  createdAt:      string
  updatedAt:      string
}

export function getExamOrders(params?: { patientId?: string; doctorId?: string; status?: string; from?: string; to?: string }): Promise<(ExamOrder & { computedStatus?: string })[]> {
  const sp = new URLSearchParams()
  if (params?.patientId) sp.set('patientId', params.patientId)
  if (params?.doctorId)  sp.set('doctorId',  params.doctorId)
  if (params?.status)    sp.set('status',    params.status)
  if (params?.from)      sp.set('from',      params.from)
  if (params?.to)        sp.set('to',        params.to)
  return apiGet(`/exam-orders${sp.toString() ? `?${sp}` : ''}`)
}

export function createExamOrder(data: {
  patientId: string
  doctorId:  string
  catalogId: string
  appointmentId?: string
  scheduledAt?:   string
  notes?:         string
}): Promise<ExamOrder> {
  return apiPost('/exam-orders', data)
}

export function updateExamOrder(id: string, data: { status?: string; notes?: string; completedAt?: string; scheduledAt?: string }): Promise<ExamOrder & { computedStatus?: string }> {
  return apiPatch(`/exam-orders/${id}`, data)
}

export function cancelExamOrder(id: string): Promise<void> {
  return apiDelete(`/exam-orders/${id}`)
}

// ─── Convênios ────────────────────────────────────────────────────────────────

export interface InsurancePlan {
  id:        string
  name:      string
  ansCode:   string | null
  phone:     string | null
  email:     string | null
  isActive:  boolean
  contracts: InsuranceContract[]
  createdAt: string
  updatedAt: string
}

export interface InsuranceContract {
  id:             string
  planId:         string
  startDate:      string
  endDate:        string | null
  consultationFee: number | null
  notes:          string | null
  procedures:     InsuranceProcedure[]
  createdAt:      string
  updatedAt:      string
}

export interface InsuranceProcedure {
  id:          string
  contractId:  string
  tussCode:    string
  description: string
  price:       number
  createdAt:   string
  updatedAt:   string
}

export function getInsurancePlans(): Promise<InsurancePlan[]> {
  return apiGet('/insurance-plans')
}

export function createInsurancePlan(data: Pick<InsurancePlan, 'name' | 'ansCode' | 'phone' | 'email'>): Promise<InsurancePlan> {
  return apiPost('/insurance-plans', data)
}

export function updateInsurancePlan(id: string, data: Partial<Pick<InsurancePlan, 'name' | 'ansCode' | 'phone' | 'email' | 'isActive'>>): Promise<InsurancePlan> {
  return apiPatch(`/insurance-plans/${id}`, data)
}

export function deleteInsurancePlan(id: string): Promise<void> {
  return apiDelete(`/insurance-plans/${id}`)
}

export function createInsuranceContract(data: Omit<InsuranceContract, 'id' | 'procedures' | 'createdAt' | 'updatedAt'>): Promise<InsuranceContract> {
  return apiPost('/insurance-contracts', data)
}

export function updateInsuranceContract(id: string, data: Partial<Omit<InsuranceContract, 'id' | 'planId' | 'procedures' | 'createdAt' | 'updatedAt'>>): Promise<InsuranceContract> {
  return apiPatch(`/insurance-contracts/${id}`, data)
}

export function deleteInsuranceContract(id: string): Promise<void> {
  return apiDelete(`/insurance-contracts/${id}`)
}

export function createInsuranceProcedure(data: Omit<InsuranceProcedure, 'id' | 'createdAt' | 'updatedAt'>): Promise<InsuranceProcedure> {
  return apiPost('/insurance-procedures', data)
}

export function updateInsuranceProcedure(id: string, data: Partial<Omit<InsuranceProcedure, 'id' | 'contractId' | 'createdAt' | 'updatedAt'>>): Promise<InsuranceProcedure> {
  return apiPatch(`/insurance-procedures/${id}`, data)
}

export function deleteInsuranceProcedure(id: string): Promise<void> {
  return apiDelete(`/insurance-procedures/${id}`)
}

// ─── Estoque ──────────────────────────────────────────────────────────────────

export interface Material {
  id:           string
  name:         string
  unit:         string
  minStock:     number
  currentStock: number
  costPrice:    number | null
  isActive:     boolean
  createdAt:    string
  updatedAt:    string
}

export interface StockMovement {
  id:            string
  materialId:    string
  type:          'IN' | 'OUT'
  quantity:      number
  reason:        string | null
  appointmentId: string | null
  userId:        string | null
  material:      Pick<Material, 'id' | 'name' | 'unit'> & { currentStock?: number }
  createdAt:     string
  updatedAt:     string
}

export function getMaterials(): Promise<Material[]> {
  return apiGet('/materials')
}

export function createMaterial(data: Omit<Material, 'id' | 'createdAt' | 'updatedAt'>): Promise<Material> {
  return apiPost('/materials', data)
}

export function updateMaterial(id: string, data: Partial<Omit<Material, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Material> {
  return apiPatch(`/materials/${id}`, data)
}

export function deleteMaterial(id: string): Promise<void> {
  return apiDelete(`/materials/${id}`)
}

export function getStockMovements(materialId?: string): Promise<StockMovement[]> {
  return apiGet(`/stock-movements${materialId ? `?materialId=${materialId}` : ''}`)
}

export function createStockMovement(data: {
  materialId:    string
  type:          'IN' | 'OUT'
  quantity:      number
  reason?:       string
  appointmentId?: string
}): Promise<StockMovement> {
  return apiPost('/stock-movements', data)
}

// ─── TISS — Faturamento ───────────────────────────────────────────────────────

export type GuiaTipo   = 'CONSULTA' | 'SP_SADT'
export type GuiaStatus = 'PENDENTE' | 'AUTORIZADA' | 'NEGADA' | 'FATURADA' | 'PAGA' | 'GLOSADA'
export type LoteStatus = 'ABERTO' | 'FECHADO' | 'ENVIADO' | 'LIQUIDADO'

export interface GuiaProcedimento {
  id:            string
  guiaId:        string
  tussCode:      string
  descricao:     string
  quantidade:    number
  valorUnitario: number
  valorTotal:    number
}

export interface GuiaFaturamento {
  id:                         string
  loteId:                     string | null
  insurancePlanId:            string
  appointmentId:              string | null
  tipo:                       GuiaTipo
  status:                     GuiaStatus
  numeroGuia:                 string
  numeroAutorizacao:          string | null
  dataAutorizacao:            string | null
  nomeBeneficiario:           string
  numeroCarteirinha:          string
  validadeCarteirinha:        string | null
  codigoPrestadorNaOperadora: string | null
  valorApresentado:           number
  valorAprovado:              number | null
  motivoGlosa:                string | null
  tipoConsulta:               number | null
  tussCode:                   string | null
  cbos:                       string | null
  crmExecutante:              string | null
  crmEstado:                  string | null
  nomeExecutante:             string | null
  indicacaoAcidente:          number
  createdAt:                  string
  updatedAt:                  string
  procedimentos:              GuiaProcedimento[]
  plan?:                      InsurancePlan
  appointment?:               any
}

export interface LoteFaturamento {
  id:              string
  insurancePlanId: string
  numeroLote:      number
  competencia:     string
  status:          LoteStatus
  valorTotal:      number
  dataEnvio:       string | null
  observacoes:     string | null
  createdAt:       string
  updatedAt:       string
  plan?:           InsurancePlan
  guias:           GuiaFaturamento[]
}

export function getGuias(params?: { planId?: string; status?: GuiaStatus; loteId?: string; sem_lote?: boolean }): Promise<GuiaFaturamento[]> {
  const q = new URLSearchParams()
  if (params?.planId)   q.set('planId',   params.planId)
  if (params?.status)   q.set('status',   params.status)
  if (params?.loteId)   q.set('loteId',   params.loteId)
  if (params?.sem_lote) q.set('sem_lote', 'true')
  return apiGet(`/tiss/guias${q.toString() ? '?' + q : ''}`)
}

export function createGuiaFromAppointment(appointmentId: string): Promise<GuiaFaturamento> {
  return apiPost(`/tiss/guias/from-appointment/${appointmentId}`, {})
}

export function createGuia(data: Partial<GuiaFaturamento> & { insurancePlanId: string; tipo: GuiaTipo; nomeBeneficiario: string; numeroCarteirinha: string; valorApresentado: number }): Promise<GuiaFaturamento> {
  return apiPost('/tiss/guias', data)
}

export function updateGuia(id: string, data: Partial<GuiaFaturamento>): Promise<GuiaFaturamento> {
  return apiPatch(`/tiss/guias/${id}`, data)
}

export function deleteGuia(id: string): Promise<void> {
  return apiDelete(`/tiss/guias/${id}`)
}

export function getLotes(planId?: string): Promise<LoteFaturamento[]> {
  return apiGet(`/tiss/lotes${planId ? '?planId=' + planId : ''}`)
}

export function createLote(data: { insurancePlanId: string; competencia: string; observacoes?: string }): Promise<LoteFaturamento> {
  return apiPost('/tiss/lotes', data)
}

export function updateLote(id: string, data: {
  status?:        LoteStatus
  observacoes?:   string
  dataEnvio?:     string
  addGuiaIds?:    string[]
  removeGuiaIds?: string[]
}): Promise<LoteFaturamento> {
  return apiPatch(`/tiss/lotes/${id}`, data)
}

export function deleteLote(id: string): Promise<void> {
  return apiDelete(`/tiss/lotes/${id}`)
}

export function getConsultasElegiveis(planId?: string): Promise<any[]> {
  return apiGet(`/tiss/consultas-elegiveis${planId ? '?planId=' + planId : ''}`)
}

export function downloadXmlTiss(loteId: string): Promise<string> {
  const token = getToken()
  const base  = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  return fetch(`${base}/api/tiss/lotes/${loteId}/xml`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => {
    if (!r.ok) throw new Error('Erro ao gerar XML')
    return r.text()
  })
}

// ─── Atestados ────────────────────────────────────────────────────────────────

export interface AtestadoPayload {
  patientId: string
  doctorId: string
  appointmentId?: string
  dias: number
  cid?: string
  finalidade: 'trabalho' | 'escola' | 'outro'
  observacoes?: string
  dataAtestado?: string
}

export interface Atestado {
  id: string
  patientId: string
  doctorId: string
  appointmentId?: string
  dias: number
  cid?: string
  finalidade: string
  observacoes?: string
  dataAtestado: string
  signatureId?: string
  signature?: DigitalSignatureSummary
  patient?: { id: string; fullName: string; cpf?: string }
  doctor?: { id: string; user: { name: string }; crm: string; crmState: string; specialty: string }
  createdAt: string
}

export function createAtestado(data: AtestadoPayload): Promise<Atestado> {
  return apiPost('/atestados', data)
}

export function getAtestados(params?: { patientId?: string; doctorId?: string }): Promise<Atestado[]> {
  const qs = new URLSearchParams(params as Record<string, string>).toString()
  return apiGet(`/atestados${qs ? '?' + qs : ''}`)
}

// ─── Médico (perfil próprio) ──────────────────────────────────────────────────

export interface DoctorProfile {
  id: string
  userId: string
  crm: string
  crmState: string
  cpf?: string | null
  specialty: string
  phone?: string | null
  bio?: string | null
  consultationFee?: number | null
  signatureProvider?: SignatureProvider | null
  user: { id: string; name: string; email: string; isActive: boolean }
}

export function getDoctorMe(): Promise<DoctorProfile> {
  return apiGet<DoctorProfile>('/doctors/me')
}

export function updateMySignatureProvider(
  provider: SignatureProvider
): Promise<{ signatureProvider: SignatureProvider }> {
  return apiPatch('/doctors/me/signature-provider', { signatureProvider: provider })
}

// ─── Assinatura Digital ───────────────────────────────────────────────────────

export type SignatureProvider = 'MOCK' | 'VIDAAS' | 'BIRDID'
export type SignatureStatus   = 'PENDING' | 'SIGNED' | 'FAILED'
export type SignedDocumentType = 'ATESTADO' | 'RECEITA' | 'LAUDO' | 'RECEITA_TEXTO' | 'SOLICITACAO'

export interface DigitalSignatureSummary {
  id: string
  status: SignatureStatus
  provider: SignatureProvider
  signedAt?: string
  signerName?: string
  signedPdfPath?: string
}

export interface DigitalSignature extends DigitalSignatureSummary {
  documentType: SignedDocumentType
  referenceId: string
  doctorId: string
  patientId: string
  patient?: { id: string; fullName: string }
  doctor?: { id: string; user: { name: string } }
  createdAt: string
}

export function initSignature(data: {
  documentType: SignedDocumentType
  referenceId: string
  provider?: SignatureProvider
}): Promise<{ signatureId: string; redirectUrl: string }> {
  return apiPost('/digital-signature/init', data)
}

export function getSignatures(params?: {
  patientId?: string
  doctorId?: string
  status?: SignatureStatus
}): Promise<DigitalSignature[]> {
  const qs = new URLSearchParams(params as Record<string, string>).toString()
  return apiGet(`/digital-signature${qs ? '?' + qs : ''}`)
}

export function getSignature(id: string): Promise<DigitalSignature> {
  return apiGet(`/digital-signature/${id}`)
}

export function downloadSignedPdf(signatureId: string): void {
  const token = getToken()
  const base  = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  const url   = `${base}/digital-signature/${signatureId}/download`
  const a     = document.createElement('a')
  a.href      = url
  a.setAttribute('download', `documento-assinado-${signatureId}.pdf`)
  // Fetch com token e força download
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.blob())
    .then(blob => {
      a.href = URL.createObjectURL(blob)
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    })
}