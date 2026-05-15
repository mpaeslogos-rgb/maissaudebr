// lib/types.ts

// ─── Auth ────────────────────────────────────────────────────────────────────

export type UserRole = 'ADMIN' | 'DOCTOR' | 'RECEPTIONIST' | 'PATIENT'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
}

export interface LoginResponse {
  token: string
  user: AuthUser
}

// ─── Paginação ───────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  take: number
  skip: number
}

// ─── Pacientes ───────────────────────────────────────────────────────────────

export type Gender = 'MALE' | 'FEMALE' | 'OTHER'

export interface Patient {
  id: string
  fullName: string
  cpf: string
  birthDate: string
  gender: Gender
  phone: string
  email?: string
  address?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export type PatientListResponse = PaginatedResponse<Patient>

// ─── Médicos ─────────────────────────────────────────────────────────────────

export interface Doctor {
  id: string
  userId?: string
  crm: string
  crmState: string
  specialty: string
  phone?: string
  bio?: string
  consultationFee?: number
  isActive?: boolean
  user?: {
    id?: string
    name: string
    email: string
    isActive?: boolean
  }
  createdAt: string
  updatedAt: string
}

export type DoctorListResponse = PaginatedResponse<Doctor>

// ─── Chats ───────────────────────────────────────────────────────────────────

export type ChatStatus = 'ACTIVE' | 'TRANSFERRED_TO_DOCTOR' | 'CLOSED'

export interface Chat {
  id: string
  phone: string
  patientId?: string
  status: ChatStatus
  transferredToDoctorId?: string
  lastMessageAt: string
  createdAt: string
  updatedAt: string
  patient?: Patient
  doctor?: Doctor
}

export type ChatListResponse = PaginatedResponse<Chat>

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string | null
  tool_calls?: any[]
  tool_call_id?: string
}

// ─── Agendamentos ─────────────────────────────────────────────────────────────

export type AppointmentStatus =
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'

export interface Appointment {
  id: string
  patientId: string
  doctorId: string
  startTime: string
  endTime: string
  status: AppointmentStatus
  reason?: string
  notes?: string
  patient: {
    id: string
    fullName: string
    cpf: string
    phone: string
    email?: string
  }
  doctor: {
    id: string
    crm: string
    crmState: string
    specialty: string
    user: { id: string; name: string; email: string }
  }
  createdAt: string
  updatedAt: string
}

export type AppointmentListResponse = PaginatedResponse<Appointment>

// ─── Pagamentos ───────────────────────────────────────────────────────────────

export type PaymentStatus =
  | 'PENDING'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED'
  | 'REFUNDED'

export type PaymentMethod =
  | 'CASH'
  | 'CREDIT_CARD'
  | 'DEBIT_CARD'
  | 'PIX'
  | 'BANK_TRANSFER'
  | 'HEALTH_INSURANCE'

export interface Payment {
  id: string
  patientId: string
  appointmentId?: string
  amount: string
  status: PaymentStatus
  method?: PaymentMethod
  dueDate: string
  paidAt?: string
  description?: string
  invoiceUrl?: string
  patient: {
    id: string
    fullName: string
    email?: string
    phone: string
  }
  appointment?: {
    id: string
    startTime: string
    endTime: string
    status: string
  }
  createdAt: string
  updatedAt: string
}

export type PaymentListResponse = PaginatedResponse<Payment>

export interface PaymentSummaryByStatus {
  status: PaymentStatus
  count: number
  amount: number
}

export interface PaymentSummaryByMethod {
  method: PaymentMethod
  count: number
  amount: number
}

export interface PaymentSummary {
  period: {
    from: string | null
    to: string | null
    dateField: string
  }
  totals: {
    count: number
    amount: number
  }
  byStatus: PaymentSummaryByStatus[]
  byMethod: PaymentSummaryByMethod[]
}

// ─── Contas a Pagar ───────────────────────────────────────────────────────────

export type AccountPayableStatus =
  | 'PENDING'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED'

export interface AccountPayable {
  id: string
  description: string
  category?: string
  supplier?: string
  amount: string
  status: AccountPayableStatus
  dueDate: string
  paidAt?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export type AccountPayableListResponse = PaginatedResponse<AccountPayable>

// ─── Prontuários ──────────────────────────────────────────────────────────────

export interface MedicalRecord {
  id: string
  patientId: string
  doctorId: string
  appointmentId?: string
  chiefComplaint?: string
  historyOfIllness?: string
  diagnosis?: string
  prescription?: string
  observations?: string
  attachmentUrl?: string
  ocrText?: string
  ocrSummary?: string
  patient: { fullName: string; cpf?: string }
  doctor: {
    crm: string
    crmState?: string
    specialty: string
    user?: { name: string; email: string }
  }
  createdAt: string
  updatedAt: string
}

export type MedicalRecordListResponse = PaginatedResponse<MedicalRecord>

// ─── Exames ───────────────────────────────────────────────────────────────────

export type ExamType = 'LABORATORY' | 'IMAGING' | 'REPORT' | 'OTHER'

export const EXAM_TYPE_LABEL: Record<ExamType, string> = {
  LABORATORY: 'Laboratorial',
  IMAGING:    'Imagem',
  REPORT:     'Laudo',
  OTHER:      'Outro',
}

export interface Exam {
  id:              string
  patientId:       string
  medicalRecordId?: string
  name:            string
  type:            ExamType
  fileUrl?:        string
  fileName?:       string
  fileSize?:       number
  mimeType?:       string
  ocrText?:        string
  notes?:          string
  examDate?:       string
  createdAt:       string
  updatedAt:       string
}

// ─── Erros da API ─────────────────────────────────────────────────────────────

export interface ApiError {
  error: string
  details?: {
    fieldErrors?: Record<string, string[]>
    formErrors?: string[]
  }
  fields?: string[]
}
