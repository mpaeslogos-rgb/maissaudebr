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

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface AuditLog {
  id:        string
  userId:    string | null
  action:    string
  entity:    string
  entityId:  string | null
  metadata:  unknown
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  user?: {
    id:    string
    name:  string
    email: string
    role:  UserRole
  } | null
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
  cpf?: string
  rg?: string
  birthDate?: string
  gender?: Gender
  phone: string
  email?: string
  // Endereço estruturado
  zipCode?: string
  street?: string
  number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
  // Clínico
  bloodType?: string
  allergies?: string
  notes?: string
  riskProfile?: 'NONE' | 'METABOLIC' | 'CARDIOMETABOLIC' | 'HIGH'
  // Convênio
  healthInsurance?: string
  healthInsuranceNumber?: string
  // Foto
  photoUrl?: string
  // LGPD
  deletedAt?: string | null
  // Relações (carregadas no detalhe)
  appointments?: PatientAppointmentSummary[]
  medicalRecords?: PatientMedicalRecordSummary[]
  createdAt: string
  updatedAt: string
}

export interface PatientAppointmentSummary {
  id: string
  startTime: string
  endTime: string
  status: AppointmentStatus
  reason?: string
  notes?: string
  doctor: {
    id: string
    crm: string
    crmState: string
    specialty: string
    user: { name: string }
  }
}

export interface PatientMedicalRecordSummary {
  id: string
  appointmentId?: string
  chiefComplaint?: string
  historyOfIllness?: string
  diagnosis?: string
  observations?: string
  transcript?: string
  bloodPressure?: string
  heartRate?: number
  temperature?: number
  weight?: number
  height?: number
  oxygenSaturation?: number
  currentMedications?: string
  pastConditions?: string
  pastSurgeries?: string
  familyHistory?: string
  smokingStatus?: string
  alcoholStatus?: string
  physicalActivity?: string
  createdAt: string
  updatedAt: string
}

export type PatientListResponse = PaginatedResponse<Patient>

// ─── Leads ───────────────────────────────────────────────────────────────────

export interface Lead {
  id: string
  name: string
  phone: string
  specialty?: string
  status: string
  cpf?: string
  rg?: string
  birthDate?: string
  gender?: string
  email?: string
  zipCode?: string
  street?: string
  number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
  bloodType?: string
  allergies?: string
  notes?: string
  healthInsurance?: string
  healthInsuranceNumber?: string
  createdAt: string
  updatedAt: string
}

export type LeadListResponse = PaginatedResponse<Lead>

// ─── Médicos ─────────────────────────────────────────────────────────────────

export type RepasseType = 'PERCENTAGE' | 'FIXED'
export type DoctorPaymentStatus = 'PENDING' | 'PAID' | 'CANCELLED'

export interface Doctor {
  id: string
  userId?: string
  crm: string
  crmState: string
  cpf?: string
  specialty: string
  phone?: string
  bio?: string
  consultationFee?: number
  workStartHour?: number
  workEndHour?: number
  isActive?: boolean
  repasseType?: RepasseType
  repasseValue?: number
  user?: {
    id?: string
    name: string
    email: string
    isActive?: boolean
  }
  createdAt: string
  updatedAt: string
}

export interface DoctorPayment {
  id: string
  doctorId: string
  appointmentId: string
  paymentId?: string
  amount: number
  status: DoctorPaymentStatus
  paidAt?: string
  nfNumber?: string
  nfFileUrl?: string
  notes?: string
  doctor?: {
    id: string
    crm: string
    crmState: string
    specialty: string
    repasseType: RepasseType
    repasseValue?: number
    user?: { name: string; email: string }
  }
  appointment?: {
    id: string
    startTime: string
    endTime: string
    status: string
    patient?: { id: string; fullName: string }
  }
  payment?: { id: string; amount: number; status: string; paidAt?: string }
  createdAt: string
  updatedAt: string
}

export type DoctorPaymentListResponse = PaginatedResponse<DoctorPayment>

export interface DoctorPaymentSummaryItem {
  doctor?: { id: string; specialty: string; repasseType: RepasseType; repasseValue?: number; user?: { name: string } }
  pending: { amount: number; count: number }
  paid:    { amount: number; count: number }
}

export type DoctorListResponse = PaginatedResponse<Doctor>

// ─── Chats ───────────────────────────────────────────────────────────────────

export type ChatStatus = 'ACTIVE' | 'TRANSFERRED_TO_DOCTOR' | 'CLOSED'

export type SchedulingStatus = 'agendado' | 'em_andamento' | 'cancelado' | 'sem_agendamento'

export interface ResolvedDoctor {
  id: string
  name: string | null
  specialty: string
}

export interface Chat {
  id: string
  phone: string
  patientId?: string
  status: ChatStatus
  aiPaused: boolean
  schedulingStatus: SchedulingStatus
  transferredToDoctorId?: string
  pendingTransferDoctorId?: string
  lastMessageAt: string
  createdAt: string
  updatedAt: string
  patient?: Patient
  doctor?: Doctor
  resolvedDoctor?: ResolvedDoctor | null
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
  insurancePlanId?: string | null
  startTime: string
  endTime: string
  status: AppointmentStatus
  reason?: string
  notes?: string
  patient: {
    id: string
    fullName: string
    cpf?: string
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
  // Sinais vitais
  bloodPressure?: string
  heartRate?: number
  temperature?: number
  weight?: number
  height?: number
  oxygenSaturation?: number
  // Histórico clínico
  currentMedications?: string
  pastConditions?: string
  pastSurgeries?: string
  familyHistory?: string
  smokingStatus?: 'NEVER' | 'FORMER' | 'CURRENT'
  alcoholStatus?: 'NEVER' | 'OCCASIONAL' | 'REGULAR'
  physicalActivity?: 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'INTENSE'
  specialtyData?: Record<string, unknown>
  // OCR / Anexos
  attachmentUrl?: string
  ocrText?: string
  ocrSummary?: string
  // Transcrição
  transcript?: string
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

// ─── Prescrições ──────────────────────────────────────────────────────────────

export interface PrescriptionItem {
  id: string
  prescriptionId: string
  medication: string
  dosage: string
  frequency: string
  duration?: string
  instructions?: string
  order: number
}

export interface Prescription {
  id: string
  patientId: string
  doctorId: string
  appointmentId?: string
  emittedAt: string
  validUntil?: string
  notes?: string
  items: PrescriptionItem[]
  doctor: {
    crm: string
    crmState: string
    specialty: string
    user: { name: string }
  }
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
