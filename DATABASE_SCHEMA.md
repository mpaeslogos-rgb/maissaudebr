# MaisSaúde BR — Estrutura do Banco de Dados

> Banco: **PostgreSQL** | ORM: **Prisma 5** | Gerado em: 25/06/2026
> Fonte: `backend/prisma/schema.prisma`

---

## Sumário

1. [Enums (tipos enumerados)](#1-enums)
2. [Config](#2-config)
3. [User](#3-user)
4. [Doctor](#4-doctor)
5. [Patient](#5-patient)
6. [Consent](#6-consent)
7. [PreAppointment](#7-preappointment)
8. [Appointment](#8-appointment)
9. [MedicalRecord](#9-medicalrecord)
10. [Exam](#10-exam)
11. [Payment](#11-payment)
12. [DoctorPayment](#12-doctorpayment)
13. [AccountPayable](#13-accountpayable)
14. [AuditLog](#14-auditlog)
15. [Lead](#15-lead)
16. [Chat](#16-chat)
17. [ChatLog](#17-chatlog)
18. [Prescription](#18-prescription)
19. [PrescriptionItem](#19-prescriptionitem)
20. [InsurancePlan](#20-insuranceplan)
21. [InsuranceContract](#21-insurancecontract)
22. [InsuranceProcedure](#22-insuranceprocedure)
23. [ExamCatalog](#23-examcatalog)
24. [ExamPackage](#24-exampackage)
25. [ExamPackageItem](#25-exampackageitem)
26. [ExamOrder](#26-examorder)
27. [Material](#27-material)
28. [StockMovement](#28-stockmovement)
29. [LoteFaturamento](#29-lotefaturamento)
30. [GuiaFaturamento](#30-guiafaturamento)
31. [GuiaProcedimento](#31-guiaprocedimento)
32. [PreventivoProgram](#32-preventivoprogram)
33. [PatientEnrollment](#33-patientenrollment)
34. [MetabolicMarker](#34-metabolicmarker)
35. [NpsResponse](#35-npsresponse)
36. [CheckIn](#36-checkin)
37. [DigitalSignature](#37-digitalsignature)
38. [Atestado](#38-atestado)
39. [Diagrama de Relações](#39-diagrama-de-relações)

---

## 1. Enums

| Enum | Valores | Usado em |
|------|---------|----------|
| `Role` | `ADMIN`, `DOCTOR`, `RECEPTIONIST`, `PATIENT` | User.role |
| `Gender` | `MALE`, `FEMALE`, `OTHER` | Patient.gender |
| `RiskProfile` | `NONE`, `METABOLIC`, `CARDIOMETABOLIC`, `HIGH` | Patient.riskProfile |
| `AppointmentStatus` | `SCHEDULED`, `CONFIRMED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `NO_SHOW` | Appointment.status |
| `PaymentStatus` | `PENDING`, `PAID`, `OVERDUE`, `CANCELLED`, `REFUNDED` | Payment.status |
| `PaymentMethod` | `CASH`, `CREDIT_CARD`, `DEBIT_CARD`, `PIX`, `BANK_TRANSFER`, `HEALTH_INSURANCE` | Payment.method |
| `DoctorPaymentStatus` | `PENDING`, `PAID`, `CANCELLED` | DoctorPayment.status |
| `AccountPayableStatus` | `PENDING`, `PAID`, `OVERDUE`, `CANCELLED` | AccountPayable.status |
| `RepasseType` | `PERCENTAGE`, `FIXED` | Doctor.repasseType, ExamCatalog.repasseType |
| `ExamType` | `LABORATORY`, `IMAGING`, `REPORT`, `OTHER` | Exam.type |
| `ExamOrderStatus` | `PENDING`, `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED` | ExamOrder.status |
| `StockMovementType` | `IN`, `OUT` | StockMovement.type |
| `EnrollmentStatus` | `ACTIVE`, `PAUSED`, `CANCELLED`, `COMPLETED` | PatientEnrollment.status |
| `JourneyStage` | `ONBOARDING`, `ACTIVE`, `AT_RISK`, `COMPLETED`, `CHURNED` | PatientEnrollment.journeyStage |
| `CheckInType` | `INITIAL_ASSESSMENT`, `MONTHLY_REVIEW`, `METABOLIC_REVIEW`, `LAB_RESULTS`, `FOLLOWUP` | CheckIn.type |
| `ChatStatus` | `ACTIVE`, `TRANSFERRED_TO_DOCTOR`, `CLOSED` | Chat.status |
| `GuiaTipo` | `CONSULTA`, `SP_SADT` | GuiaFaturamento.tipo |
| `GuiaStatus` | `PENDENTE`, `AUTORIZADA`, `NEGADA`, `FATURADA`, `PAGA`, `GLOSADA` | GuiaFaturamento.status |
| `LoteStatus` | `ABERTO`, `FECHADO`, `ENVIADO`, `LIQUIDADO` | LoteFaturamento.status |
| `SignatureProvider` | `MOCK`, `VIDAAS`, `BIRDID` | DigitalSignature.provider, Doctor.signatureProvider |
| `SignatureStatus` | `PENDING`, `SIGNED`, `FAILED` | DigitalSignature.status |
| `SignedDocumentType` | `ATESTADO`, `RECEITA`, `LAUDO`, `RECEITA_TEXTO`, `SOLICITACAO` | DigitalSignature.documentType |

---

## 2. Config

> Tabela: `configs` — Configurações globais da clínica (registro único)

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|:-----------:|---------|-----------|
| `id` | String | PK | cuid() | |
| `key` | String | Unique | `"clinic"` | Chave do registro (sempre "clinic") |
| `clinicName` | String | Sim | `"maissaudebr"` | Nome da clínica |
| `cnpj` | String | Sim | `""` | CNPJ da clínica |
| `cnes` | String | Sim | `""` | Cadastro Nacional de Estabelecimentos de Saúde |
| `address` | String | Sim | `""` | Endereço completo |
| `whatsappNumber` | String | Sim | `""` | WhatsApp da clínica |
| `attendanceHours` | String | Sim | `""` | Horário de funcionamento |
| `specialties` | String | Sim | `""` | Especialidades disponíveis |
| `telemedicinePlatform` | String | Sim | `""` | Plataforma de telemedicina |
| `telemedicineLinkInfo` | String | Sim | `""` | Link/informações da telemedicina |
| `telemedicineInstructions` | String | Sim | `""` | Instruções de telemedicina |
| `linkSendTime` | String | Sim | `""` | Horário de envio do link |
| `defaultConsultationFee` | String | Sim | `""` | Valor padrão da consulta |
| `pixKey` | String | Sim | `""` | Chave PIX |
| `paymentLink` | String | Sim | `""` | Link de pagamento |
| `paymentMethods` | String | Sim | `""` | Métodos de pagamento aceitos |
| `paymentInstructions` | String | Sim | `""` | Instruções de pagamento |
| `confirmationPolicy` | String | Sim | `""` | Política de confirmação |
| `cancellationPolicy` | String | Sim | `""` | Política de cancelamento |
| `welcomeMessage` | String | Sim | `""` | Msg boas-vindas WhatsApp |
| `confirmationMessage` | String | Sim | `""` | Msg confirmação WhatsApp |
| `reminderMessage` | String | Sim | `""` | Msg lembrete WhatsApp |
| `paymentReminderMessage` | String | Sim | `""` | Msg cobrança WhatsApp |
| `humanTransferMessage` | String | Sim | `""` | Msg transferência p/ humano |
| `emergencyMessage` | String | Sim | `""` | Msg emergência WhatsApp |
| `otherSettings` | String | Sim | `""` | Regras adicionais da IA |
| `createdAt` | DateTime | Sim | `now()` | |
| `updatedAt` | DateTime | Sim | auto | |

---

## 3. User

> Tabela: `users` — Usuários do sistema (autenticação)

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|:-----------:|---------|-----------|
| `id` | String | PK | cuid() | |
| `email` | String | Unique | — | E-mail de login |
| `passwordHash` | String | Sim | — | Hash bcrypt da senha |
| `name` | String | Sim | — | Nome completo |
| `role` | Role | Sim | `RECEPTIONIST` | Papel no sistema |
| `isActive` | Boolean | Sim | `true` | Ativo/inativo |
| `createdAt` | DateTime | Sim | `now()` | |
| `updatedAt` | DateTime | Sim | auto | |

**Relações:** `doctor` (1:1), `patient` (1:1), `auditLogs` (1:N), `stockMovements` (1:N)
**Índices:** `email`

---

## 4. Doctor

> Tabela: `doctors` — Perfil médico (vinculado a User 1:1)

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|:-----------:|---------|-----------|
| `id` | String | PK | cuid() | |
| `userId` | String | Unique/FK | — | → User.id |
| `crm` | String | Unique | — | Registro CRM |
| `crmState` | String | Sim | — | UF do CRM (ex: "SP") |
| `cpf` | String | Não | — | CPF (obrigatório para assinatura digital) |
| `specialty` | String | Sim | — | Especialidade médica |
| `phone` | String | Não | — | Telefone |
| `bio` | String | Não | — | Biografia |
| `consultationFee` | Float | Não | — | Valor da consulta (R$) |
| `workStartHour` | Int | Sim | `8` | Hora início expediente |
| `workEndHour` | Int | Sim | `18` | Hora fim expediente |
| `repasseType` | RepasseType | Sim | `PERCENTAGE` | Tipo de repasse |
| `repasseValue` | Float | Não | — | % (0-100) ou valor fixo R$ |
| `signatureProvider` | SignatureProvider | Não | — | Provedor preferido ICP-Brasil |
| `createdAt` | DateTime | Sim | `now()` | |
| `updatedAt` | DateTime | Sim | auto | |

**Relações:** `user` (N:1), `appointments` (1:N), `medicalRecords` (1:N), `prescriptions` (1:N), `transferredChats` (1:N), `doctorPayments` (1:N), `examOrders` (1:N), `atestados` (1:N), `digitalSignatures` (1:N), `examPackages` (1:N)
**Índices:** `crm`, `specialty`

---

## 5. Patient

> Tabela: `patients` — Pacientes da clínica

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|:-----------:|---------|-----------|
| `id` | String | PK | cuid() | |
| `userId` | String | Unique/FK | — | → User.id (opcional) |
| `fullName` | String | Sim | — | Nome completo |
| `cpf` | String | Unique | — | CPF (criptografia determinística) |
| `rg` | String | Não | — | RG (criptografado) |
| `birthDate` | DateTime | Não | — | Data de nascimento |
| `gender` | Gender | Não | — | Sexo |
| `email` | String | Não | — | E-mail |
| `phone` | String | Sim | — | Telefone (criptografado) |
| `zipCode` | String | Não | — | CEP |
| `street` | String | Não | — | Logradouro |
| `number` | String | Não | — | Número |
| `complement` | String | Não | — | Complemento |
| `neighborhood` | String | Não | — | Bairro |
| `city` | String | Não | — | Cidade |
| `state` | String | Não | — | UF |
| `bloodType` | String | Não | — | Tipo sanguíneo |
| `allergies` | String | Não | — | Alergias (criptografado) |
| `notes` | String | Não | — | Observações |
| `riskProfile` | RiskProfile | Sim | `NONE` | Perfil de risco |
| `healthInsurance` | String | Não | — | Nome do convênio |
| `healthInsuranceNumber` | String | Não | — | Nº da carteirinha |
| `photoUrl` | String | Não | — | URL da foto |
| `deletedAt` | DateTime | Não | — | LGPD soft delete |
| `createdAt` | DateTime | Sim | `now()` | |
| `updatedAt` | DateTime | Sim | auto | |

**Relações:** `user` (N:1), `appointments` (1:N), `medicalRecords` (1:N), `payments` (1:N), `chats` (1:N), `exams` (1:N), `prescriptions` (1:N), `consents` (1:N), `examOrders` (1:N), `enrollments` (1:N), `metabolicMarkers` (1:N), `npsResponses` (1:N), `checkIns` (1:N), `atestados` (1:N), `digitalSignatures` (1:N)
**Índices:** `cpf`, `fullName`

---

## 6. Consent

> Tabela: `consents` — Consentimento LGPD (Art. 7 e Art. 9)

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|:-----------:|---------|-----------|
| `id` | String | PK | cuid() | |
| `patientId` | String | FK | — | → Patient.id |
| `purpose` | String | Sim | — | Finalidade (ex: "tratamento_clinico") |
| `granted` | Boolean | Sim | `true` | Consentiu / Revogou |
| `grantedAt` | DateTime | Sim | `now()` | Data do consentimento |
| `revokedAt` | DateTime | Não | — | Data da revogação |
| `ipAddress` | String | Não | — | IP do consentimento |
| `userAgent` | String | Não | — | User agent do navegador |
| `notes` | String | Não | — | Observações |

**Índices:** `patientId`, `[patientId, purpose]`

---

## 7. PreAppointment

> Tabela: `pre_appointments` — Pré-agendamentos (pipeline de leads)

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|:-----------:|---------|-----------|
| `id` | String | PK | cuid() | |
| `leadId` | String | Sim | — | ID do lead |
| `doctorId` | String | Sim | — | ID do médico |
| `date` | String | Sim | — | Data (YYYY-MM-DD) |
| `time` | String | Sim | — | Hora (HH:MM) |
| `specialty` | String | Sim | — | Especialidade |
| `status` | String | Sim | `"PENDING"` | PENDING, CONFIRMED, CANCELLED |
| `createdAt` | DateTime | Sim | `now()` | |
| `updatedAt` | DateTime | Sim | auto | |

---

## 8. Appointment

> Tabela: `appointments` — Agendamentos / Consultas

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|:-----------:|---------|-----------|
| `id` | String | PK | cuid() | |
| `patientId` | String | FK | — | → Patient.id |
| `doctorId` | String | FK | — | → Doctor.id |
| `startTime` | DateTime | Sim | — | Início da consulta |
| `endTime` | DateTime | Sim | — | Fim da consulta |
| `status` | AppointmentStatus | Sim | `SCHEDULED` | Status |
| `reason` | String | Não | — | Motivo da consulta |
| `notes` | String | Não | — | Observações |
| `isReturn` | Boolean | Sim | `false` | Consulta de retorno |
| `insurancePlanId` | String | FK | — | → InsurancePlan.id |
| `createdAt` | DateTime | Sim | `now()` | |
| `updatedAt` | DateTime | Sim | auto | |

**Relações:** `patient` (N:1), `doctor` (N:1), `insurancePlan` (N:1), `medicalRecord` (1:1), `prescription` (1:1), `payment` (1:1), `doctorPayment` (1:1), `examOrders` (1:N), `stockMovements` (1:N), `guia` (1:1), `npsResponse` (1:1), `atestados` (1:N)
**Índices:** `patientId`, `doctorId`, `startTime`, `status`

---

## 9. MedicalRecord

> Tabela: `medical_records` — Prontuários eletrônicos

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|:-----------:|---------|-----------|
| `id` | String | PK | cuid() | |
| `patientId` | String | FK | — | → Patient.id |
| `doctorId` | String | FK | — | → Doctor.id |
| `appointmentId` | String | Unique/FK | — | → Appointment.id (1:1 opcional) |
| `chiefComplaint` | String | Não | — | Queixa principal |
| `historyOfIllness` | String | Não | — | História da doença atual |
| `diagnosis` | String | Não | — | Diagnóstico |
| `prescription` | String | Não | — | Prescrição (texto) |
| `observations` | String | Não | — | Observações |
| `bloodPressure` | String | Não | — | Pressão arterial (ex: "120/80") |
| `heartRate` | Int | Não | — | Frequência cardíaca (bpm) |
| `temperature` | Float | Não | — | Temperatura (°C) |
| `weight` | Float | Não | — | Peso (kg) |
| `height` | Float | Não | — | Altura (cm) |
| `oxygenSaturation` | Float | Não | — | SpO2 (%) |
| `currentMedications` | String | Não | — | Medicamentos em uso |
| `pastConditions` | String | Não | — | Antecedentes pessoais |
| `pastSurgeries` | String | Não | — | Cirurgias anteriores |
| `familyHistory` | String | Não | — | Histórico familiar |
| `smokingStatus` | String | Não | — | NEVER / FORMER / CURRENT |
| `alcoholStatus` | String | Não | — | NEVER / OCCASIONAL / REGULAR |
| `physicalActivity` | String | Não | — | SEDENTARY / LIGHT / MODERATE / INTENSE |
| `specialtyData` | Json | Não | — | Dados específicos da especialidade |
| `attachmentUrl` | String | Não | — | URL do arquivo original |
| `ocrText` | String | Não | — | Texto extraído via OCR |
| `ocrSummary` | String | Não | — | Resumo gerado pela IA |
| `transcript` | String | Não | — | Transcrição da consulta |
| `createdAt` | DateTime | Sim | `now()` | |
| `updatedAt` | DateTime | Sim | auto | |

**Relações:** `patient` (N:1), `doctor` (N:1), `appointment` (1:1), `exams` (1:N)
**Índices:** `patientId`, `doctorId`, `appointmentId`

---

## 10. Exam

> Tabela: `exams` — Resultados de exames (upload/OCR)

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|:-----------:|---------|-----------|
| `id` | String | PK | cuid() | |
| `patientId` | String | FK | — | → Patient.id |
| `medicalRecordId` | String | FK | — | → MedicalRecord.id |
| `name` | String | Sim | — | Nome do exame |
| `type` | ExamType | Sim | `OTHER` | Tipo |
| `fileUrl` | String | Não | — | URL do arquivo |
| `fileName` | String | Não | — | Nome do arquivo |
| `fileSize` | Int | Não | — | Tamanho (bytes) |
| `mimeType` | String | Não | — | MIME type |
| `ocrText` | String | Não | — | Texto extraído via OCR |
| `notes` | String | Não | — | Observações |
| `examDate` | DateTime | Não | — | Data do exame |
| `createdAt` | DateTime | Sim | `now()` | |
| `updatedAt` | DateTime | Sim | auto | |

**Índices:** `patientId`, `medicalRecordId`

---

## 11. Payment

> Tabela: `payments` — Contas a receber (pagamentos de pacientes)

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|:-----------:|---------|-----------|
| `id` | String | PK | cuid() | |
| `patientId` | String | FK | — | → Patient.id |
| `appointmentId` | String | Unique/FK | — | → Appointment.id (1:1) |
| `enrollmentId` | String | FK | — | → PatientEnrollment.id |
| `amount` | Float | Sim | — | Valor (R$) |
| `status` | PaymentStatus | Sim | `PENDING` | Status |
| `method` | PaymentMethod | Não | — | Forma de pagamento |
| `dueDate` | DateTime | Sim | — | Vencimento |
| `paidAt` | DateTime | Não | — | Data do pagamento |
| `description` | String | Não | — | Descrição |
| `invoiceUrl` | String | Não | — | URL da nota fiscal |
| `createdAt` | DateTime | Sim | `now()` | |
| `updatedAt` | DateTime | Sim | auto | |

**Relações:** `patient` (N:1), `appointment` (1:1), `enrollment` (N:1), `doctorPayment` (1:1), `examOrder` (1:1)
**Índices:** `patientId`, `status`, `dueDate`

---

## 12. DoctorPayment

> Tabela: `doctor_payments` — Repasses aos médicos

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|:-----------:|---------|-----------|
| `id` | String | PK | cuid() | |
| `doctorId` | String | FK | — | → Doctor.id |
| `appointmentId` | String | Unique/FK | — | → Appointment.id |
| `paymentId` | String | Unique/FK | — | → Payment.id (que gerou o repasse) |
| `amount` | Float | Sim | — | Valor do repasse (R$) |
| `status` | DoctorPaymentStatus | Sim | `PENDING` | Status |
| `paidAt` | DateTime | Não | — | Data do pagamento |
| `nfNumber` | String | Não | — | Nº da NF/Recibo |
| `nfFileUrl` | String | Não | — | URL do arquivo da NF |
| `notes` | String | Não | — | Observações |
| `createdAt` | DateTime | Sim | `now()` | |
| `updatedAt` | DateTime | Sim | auto | |

**Relações:** `doctor` (N:1), `appointment` (1:1), `payment` (1:1), `examOrder` (1:1)
**Índices:** `doctorId`, `status`, `appointmentId`

---

## 13. AccountPayable

> Tabela: `accounts_payable` — Contas a pagar (despesas da clínica)

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|:-----------:|---------|-----------|
| `id` | String | PK | cuid() | |
| `description` | String | Sim | — | Descrição da despesa |
| `category` | String | Não | — | Categoria (Aluguel, Energia...) |
| `supplier` | String | Não | — | Fornecedor |
| `supplierCnpj` | String | Não | — | CNPJ do fornecedor |
| `digitableLine` | String | Não | — | Linha digitável (boleto OCR) |
| `barcode` | String | Não | — | Código de barras |
| `bankCode` | String | Não | — | Código do banco |
| `fileUrl` | String | Não | — | URL do arquivo |
| `ocrRawText` | String | Não | — | Texto bruto do OCR |
| `ocrConfidence` | Float | Não | — | Confiança do OCR (0-1) |
| `ocrStatus` | String | Sim | `"PENDING"` | Status do OCR |
| `amount` | Float | Sim | — | Valor (R$) |
| `status` | AccountPayableStatus | Sim | `PENDING` | Status |
| `dueDate` | DateTime | Sim | — | Vencimento |
| `paidAt` | DateTime | Não | — | Data do pagamento |
| `notes` | String | Não | — | Observações |
| `createdAt` | DateTime | Sim | `now()` | |
| `updatedAt` | DateTime | Sim | auto | |

**Índices:** `status`, `dueDate`, `category`

---

## 14. AuditLog

> Tabela: `audit_logs` — Log de auditoria (LGPD / rastreabilidade)

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|:-----------:|---------|-----------|
| `id` | String | PK | cuid() | |
| `userId` | String | FK | — | → User.id |
| `action` | String | Sim | — | CREATE, UPDATE, DELETE, LOGIN, LOGOUT |
| `entity` | String | Sim | — | Entidade (Patient, Appointment...) |
| `entityId` | String | Não | — | ID da entidade |
| `metadata` | Json | Não | — | Dados adicionais (antes/depois) |
| `ipAddress` | String | Não | — | IP do usuário |
| `userAgent` | String | Não | — | User agent |
| `createdAt` | DateTime | Sim | `now()` | |

**Índices:** `userId`, `[entity, entityId]`, `createdAt`

---

## 15. Lead

> Tabela: `leads` — Leads / captação de pacientes

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|:-----------:|---------|-----------|
| `id` | String | PK | cuid() | |
| `name` | String | Sim | — | Nome |
| `phone` | String | Sim | — | Telefone |
| `specialty` | String | Não | — | Especialidade de interesse |
| `status` | String | Sim | `"NOVO"` | NOVO, CONTACTED, SCHEDULED, CONVERTED... |
| `cpf` | String | Não | — | CPF |
| `rg` | String | Não | — | RG |
| `birthDate` | DateTime | Não | — | Data de nascimento |
| `gender` | String | Não | — | Sexo |
| `email` | String | Não | — | E-mail |
| `zipCode` | String | Não | — | CEP |
| `street` | String | Não | — | Logradouro |
| `number` | String | Não | — | Número |
| `complement` | String | Não | — | Complemento |
| `neighborhood` | String | Não | — | Bairro |
| `city` | String | Não | — | Cidade |
| `state` | String | Não | — | UF |
| `bloodType` | String | Não | — | Tipo sanguíneo |
| `allergies` | String | Não | — | Alergias |
| `notes` | String | Não | — | Observações |
| `healthInsurance` | String | Não | — | Convênio |
| `healthInsuranceNumber` | String | Não | — | Nº carteirinha |
| `createdAt` | DateTime | Sim | `now()` | |
| `updatedAt` | DateTime | Sim | auto | |

---

## 16. Chat

> Tabela: `chats` — Conversas WhatsApp (IA híbrida)

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|:-----------:|---------|-----------|
| `id` | String | PK | cuid() | |
| `phone` | String | Unique | — | Telefone do paciente |
| `patientId` | String | FK | — | → Patient.id |
| `status` | ChatStatus | Sim | `ACTIVE` | Status da conversa |
| `aiPaused` | Boolean | Sim | `false` | IA pausada manualmente |
| `transferredToDoctorId` | String | FK | — | → Doctor.id (médico que assumiu) |
| `pendingTransferDoctorId` | String | Não | — | Médico aguardando aceitar transferência |
| `lastMessageAt` | DateTime | Sim | `now()` | Última mensagem |
| `createdAt` | DateTime | Sim | `now()` | |
| `updatedAt` | DateTime | Sim | auto | |

---

## 17. ChatLog

> Tabela: `chat_logs` — Histórico de mensagens do chat

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|:-----------:|---------|-----------|
| `id` | String | PK | cuid() | |
| `phone` | String | Sim | `"simulador"` | Telefone |
| `intent` | String | Não | — | Intenção classificada |
| `message` | String | Sim | — | Conteúdo da mensagem |
| `isUser` | Boolean | Sim | `true` | true=paciente, false=IA |
| `createdAt` | DateTime | Sim | `now()` | |

---

## 18. Prescription

> Tabela: `prescriptions` — Prescrições médicas (receitas)

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|:-----------:|---------|-----------|
| `id` | String | PK | cuid() | |
| `patientId` | String | FK | — | → Patient.id |
| `doctorId` | String | FK | — | → Doctor.id |
| `appointmentId` | String | Unique/FK | — | → Appointment.id (1:1) |
| `emittedAt` | DateTime | Sim | `now()` | Data de emissão |
| `validUntil` | DateTime | Não | — | Validade |
| `notes` | String | Não | — | Observações |
| `signatureId` | String | Unique/FK | — | → DigitalSignature.id (1:1) |

**Relações:** `patient` (N:1), `doctor` (N:1), `appointment` (1:1), `items` (1:N), `signature` (1:1)
**Índices:** `patientId`, `doctorId`

---

## 19. PrescriptionItem

> Tabela: `prescription_items` — Itens da prescrição (medicamentos)

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|:-----------:|---------|-----------|
| `id` | String | PK | cuid() | |
| `prescriptionId` | String | FK | — | → Prescription.id |
| `medication` | String | Sim | — | Nome do medicamento |
| `dosage` | String | Sim | — | Dosagem |
| `frequency` | String | Sim | — | Frequência |
| `duration` | String | Não | — | Duração |
| `instructions` | String | Não | — | Instruções de uso |
| `order` | Int | Sim | `0` | Ordem de exibição |

**Índices:** `prescriptionId`

---

## 20. InsurancePlan

> Tabela: `insurance_plans` — Convênios / Planos de saúde

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|:-----------:|---------|-----------|
| `id` | String | PK | cuid() | |
| `name` | String | Sim | — | Nome do convênio |
| `ansCode` | String | Não | — | Código ANS |
| `phone` | String | Não | — | Telefone |
| `email` | String | Não | — | E-mail |
| `isActive` | Boolean | Sim | `true` | Ativo |
| `codigoPrestadorNaOperadora` | String | Não | — | Código da clínica na operadora (XML TISS) |
| `createdAt` | DateTime | Sim | `now()` | |
| `updatedAt` | DateTime | Sim | auto | |

**Relações:** `contracts` (1:N), `appointments` (1:N), `examOrders` (1:N), `guias` (1:N), `lotes` (1:N)
**Índices:** `name`

---

## 21. InsuranceContract

> Tabela: `insurance_contracts` — Contratos com convênios

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|:-----------:|---------|-----------|
| `id` | String | PK | cuid() | |
| `planId` | String | FK | — | → InsurancePlan.id |
| `startDate` | DateTime | Sim | — | Início do contrato |
| `endDate` | DateTime | Não | — | Fim do contrato |
| `consultationFee` | Float | Não | — | Valor da consulta (sobrescreve padrão) |
| `notes` | String | Não | — | Observações |
| `createdAt` | DateTime | Sim | `now()` | |
| `updatedAt` | DateTime | Sim | auto | |

**Relações:** `plan` (N:1), `procedures` (1:N)
**Índices:** `planId`

---

## 22. InsuranceProcedure

> Tabela: `insurance_procedures` — Procedimentos TUSS do contrato

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|:-----------:|---------|-----------|
| `id` | String | PK | cuid() | |
| `contractId` | String | FK | — | → InsuranceContract.id |
| `tussCode` | String | Sim | — | Código TUSS |
| `description` | String | Sim | — | Descrição do procedimento |
| `price` | Float | Sim | — | Valor (R$) |
| `createdAt` | DateTime | Sim | `now()` | |
| `updatedAt` | DateTime | Sim | auto | |

**Índices:** `contractId`, `tussCode`

---

## 23. ExamCatalog

> Tabela: `exam_catalog` — Catálogo de exames da clínica

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|:-----------:|---------|-----------|
| `id` | String | PK | cuid() | |
| `name` | String | Sim | — | Nome do exame |
| `tussCode` | String | Não | — | Código TUSS |
| `description` | String | Não | — | Descrição |
| `price` | Float | Sim | — | Preço (R$) |
| `duration` | Int | Não | — | Duração estimada (minutos) |
| `repasseType` | RepasseType | Não | — | Tipo de repasse |
| `repasseValue` | Float | Não | — | Valor do repasse |
| `isActive` | Boolean | Sim | `true` | Ativo |
| `createdAt` | DateTime | Sim | `now()` | |
| `updatedAt` | DateTime | Sim | auto | |

**Relações:** `orders` (1:N), `packageItems` (1:N)
**Índices:** `name`, `tussCode`

---

## 24. ExamPackage

> Tabela: `exam_packages` — Pacotes de exames

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|:-----------:|---------|-----------|
| `id` | String | PK | cuid() | |
| `name` | String | Sim | — | Nome do pacote |
| `description` | String | Não | — | Descrição |
| `doctorId` | String | FK | — | → Doctor.id (médico dono) |
| `createdAt` | DateTime | Sim | `now()` | |
| `updatedAt` | DateTime | Sim | auto | |

**Relações:** `doctor` (N:1), `items` (1:N)

---

## 25. ExamPackageItem

> Tabela: `exam_package_items` — Itens do pacote de exames

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|:-----------:|---------|-----------|
| `id` | String | PK | cuid() | |
| `packageId` | String | FK | — | → ExamPackage.id |
| `catalogId` | String | FK | — | → ExamCatalog.id |

**Constraint:** `@@unique([packageId, catalogId])`

---

## 26. ExamOrder

> Tabela: `exam_orders` — Solicitações de exames

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|:-----------:|---------|-----------|
| `id` | String | PK | cuid() | |
| `patientId` | String | FK | — | → Patient.id |
| `doctorId` | String | FK | — | → Doctor.id |
| `catalogId` | String | FK | — | → ExamCatalog.id |
| `appointmentId` | String | FK | — | → Appointment.id |
| `insurancePlanId` | String | FK | — | → InsurancePlan.id |
| `guiaId` | String | FK | — | → GuiaFaturamento.id |
| `scheduledAt` | DateTime | Não | — | Data agendada |
| `completedAt` | DateTime | Não | — | Data de conclusão |
| `status` | ExamOrderStatus | Sim | `PENDING` | Status |
| `notes` | String | Não | — | Observações |
| `laudoContent` | String | Não | — | Conteúdo do laudo |
| `paymentId` | String | Unique/FK | — | → Payment.id |
| `doctorPaymentId` | String | Unique/FK | — | → DoctorPayment.id |
| `signatureId` | String | Unique/FK | — | → DigitalSignature.id |
| `createdAt` | DateTime | Sim | `now()` | |
| `updatedAt` | DateTime | Sim | auto | |

**Relações:** `patient` (N:1), `doctor` (N:1), `catalog` (N:1), `appointment` (N:1), `insurancePlan` (N:1), `guia` (N:1), `payment` (1:1), `doctorPayment` (1:1), `signature` (1:1)
**Índices:** `patientId`, `doctorId`, `insurancePlanId`, `guiaId`, `status`

---

## 27. Material

> Tabela: `materials` — Materiais / insumos da clínica

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|:-----------:|---------|-----------|
| `id` | String | PK | cuid() | |
| `name` | String | Sim | — | Nome do material |
| `unit` | String | Sim | — | Unidade (unidade, caixa, frasco) |
| `minStock` | Float | Sim | `0` | Estoque mínimo |
| `currentStock` | Float | Sim | `0` | Estoque atual |
| `costPrice` | Float | Não | — | Custo unitário (R$) |
| `isActive` | Boolean | Sim | `true` | Ativo |
| `createdAt` | DateTime | Sim | `now()` | |
| `updatedAt` | DateTime | Sim | auto | |

**Relações:** `movements` (1:N)
**Índices:** `name`

---

## 28. StockMovement

> Tabela: `stock_movements` — Movimentações de estoque

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|:-----------:|---------|-----------|
| `id` | String | PK | cuid() | |
| `materialId` | String | FK | — | → Material.id |
| `type` | StockMovementType | Sim | — | IN (entrada) / OUT (saída) |
| `quantity` | Float | Sim | — | Quantidade |
| `reason` | String | Não | — | Motivo |
| `appointmentId` | String | FK | — | → Appointment.id |
| `userId` | String | FK | — | → User.id |
| `createdAt` | DateTime | Sim | `now()` | |
| `updatedAt` | DateTime | Sim | auto | |

**Índices:** `materialId`, `type`

---

## 29. LoteFaturamento

> Tabela: `lotes_faturamento` — Lotes de faturamento TISS

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|:-----------:|---------|-----------|
| `id` | String | PK | cuid() | |
| `insurancePlanId` | String | FK | — | → InsurancePlan.id |
| `numeroLote` | Int | Sim | — | Número sequencial do lote |
| `competencia` | String | Sim | — | Competência "YYYY-MM" |
| `status` | LoteStatus | Sim | `ABERTO` | Status |
| `valorTotal` | Float | Sim | `0` | Valor total do lote |
| `dataEnvio` | DateTime | Não | — | Data de envio à operadora |
| `observacoes` | String | Não | — | Observações |
| `createdAt` | DateTime | Sim | `now()` | |
| `updatedAt` | DateTime | Sim | auto | |

**Constraint:** `@@unique([insurancePlanId, numeroLote])`
**Índices:** `insurancePlanId`, `status`

---

## 30. GuiaFaturamento

> Tabela: `guias_faturamento` — Guias TISS (consulta ou SP/SADT)

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|:-----------:|---------|-----------|
| `id` | String | PK | cuid() | |
| `loteId` | String | FK | — | → LoteFaturamento.id |
| `insurancePlanId` | String | FK | — | → InsurancePlan.id |
| `appointmentId` | String | Unique/FK | — | → Appointment.id (1:1) |
| `tipo` | GuiaTipo | Sim | — | CONSULTA ou SP_SADT |
| `status` | GuiaStatus | Sim | `PENDENTE` | Status da guia |
| `numeroGuia` | String | Sim | — | Número da guia |
| `numeroAutorizacao` | String | Não | — | Nº da autorização |
| `dataAutorizacao` | DateTime | Não | — | Data da autorização |
| `nomeBeneficiario` | String | Sim | — | Nome do paciente |
| `numeroCarteirinha` | String | Sim | — | Nº da carteirinha |
| `validadeCarteirinha` | String | Não | — | Validade (MM/YYYY) |
| `codigoPrestadorNaOperadora` | String | Não | — | Código da clínica na operadora |
| `valorApresentado` | Float | Sim | — | Valor apresentado (R$) |
| `valorAprovado` | Float | Não | — | Valor aprovado (R$) |
| `motivoGlosa` | String | Não | — | Motivo da glosa |
| `tipoConsulta` | Int | Não | — | 1=1º atend, 2=retorno, 3=pré-natal |
| `tussCode` | String | Não | — | Código TUSS principal |
| `cbos` | String | Não | — | CBOS do executante |
| `crmExecutante` | String | Não | — | CRM do médico |
| `crmEstado` | String | Não | — | UF do CRM |
| `nomeExecutante` | String | Não | — | Nome do médico |
| `indicacaoAcidente` | Int | Sim | `9` | 9=outros, 1=trabalho, 2=trânsito |
| `createdAt` | DateTime | Sim | `now()` | |
| `updatedAt` | DateTime | Sim | auto | |

**Relações:** `lote` (N:1), `plan` (N:1), `appointment` (1:1), `procedimentos` (1:N), `examOrders` (1:N)
**Índices:** `insurancePlanId`, `loteId`, `status`

---

## 31. GuiaProcedimento

> Tabela: `guia_procedimentos` — Procedimentos da guia TISS

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|:-----------:|---------|-----------|
| `id` | String | PK | cuid() | |
| `guiaId` | String | FK | — | → GuiaFaturamento.id |
| `tussCode` | String | Sim | — | Código TUSS |
| `descricao` | String | Sim | — | Descrição do procedimento |
| `quantidade` | Float | Sim | `1` | Quantidade |
| `valorUnitario` | Float | Sim | — | Valor unitário (R$) |
| `valorTotal` | Float | Sim | — | Valor total (R$) |

**Índices:** `guiaId`

---

## 32. PreventivoProgram

> Tabela: `preventivo_programs` — Programas preventivos

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|:-----------:|---------|-----------|
| `id` | String | PK | cuid() | |
| `name` | String | Sim | — | Nome do programa |
| `description` | String | Não | — | Descrição |
| `durationDays` | Int | Sim | — | Duração total (dias) |
| `monthlyFee` | Float | Sim | — | Mensalidade (R$) |
| `entryFee` | Float | Sim | `0` | Taxa de entrada (R$) |
| `clinicScope` | String | Não | — | Escopo clínico |
| `isActive` | Boolean | Sim | `true` | Ativo |
| `createdAt` | DateTime | Sim | `now()` | |
| `updatedAt` | DateTime | Sim | auto | |

**Relações:** `enrollments` (1:N)
**Índices:** `isActive`

---

## 33. PatientEnrollment

> Tabela: `patient_enrollments` — Inscrições de pacientes em programas

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|:-----------:|---------|-----------|
| `id` | String | PK | cuid() | |
| `patientId` | String | FK | — | → Patient.id |
| `programId` | String | FK | — | → PreventivoProgram.id |
| `startDate` | DateTime | Sim | — | Data de início |
| `endDate` | DateTime | Não | — | Data de fim (auto-calculada) |
| `status` | EnrollmentStatus | Sim | `ACTIVE` | Status |
| `journeyStage` | JourneyStage | Sim | `ONBOARDING` | Estágio da jornada |
| `monthlyFee` | Float | Sim | — | Mensalidade (pode sobrescrever programa) |
| `nextBillingDate` | DateTime | Sim | — | Próxima cobrança |
| `cancelReason` | String | Não | — | Motivo do cancelamento |
| `cancelledAt` | DateTime | Não | — | Data do cancelamento |
| `notes` | String | Não | — | Observações |
| `createdAt` | DateTime | Sim | `now()` | |
| `updatedAt` | DateTime | Sim | auto | |

**Relações:** `patient` (N:1), `program` (N:1), `payments` (1:N), `checkIns` (1:N), `npsResponses` (1:N)
**Índices:** `patientId`, `status`, `journeyStage`, `nextBillingDate`

---

## 34. MetabolicMarker

> Tabela: `metabolic_markers` — Marcadores metabólicos (exames laboratoriais)

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|:-----------:|---------|-----------|
| `id` | String | PK | cuid() | |
| `patientId` | String | FK | — | → Patient.id |
| `date` | DateTime | Sim | — | Data da coleta |
| `weight` | Float | Não | — | Peso (kg) |
| `bmi` | Float | Não | — | IMC (kg/m²) |
| `systolicBP` | Float | Não | — | Pressão sistólica (mmHg) |
| `diastolicBP` | Float | Não | — | Pressão diastólica (mmHg) |
| `glucose` | Float | Não | — | Glicemia em jejum (mg/dL) |
| `hba1c` | Float | Não | — | Hemoglobina glicada (%) |
| `totalChol` | Float | Não | — | Colesterol total (mg/dL) |
| `ldl` | Float | Não | — | LDL (mg/dL) |
| `hdl` | Float | Não | — | HDL (mg/dL) |
| `triglycerides` | Float | Não | — | Triglicerídeos (mg/dL) |
| `notes` | String | Não | — | Observações |
| `createdAt` | DateTime | Sim | `now()` | |
| `updatedAt` | DateTime | Sim | auto | |

**Índices:** `patientId`, `date`

---

## 35. NpsResponse

> Tabela: `nps_responses` — Respostas NPS (satisfação pós-consulta)

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|:-----------:|---------|-----------|
| `id` | String | PK | cuid() | |
| `patientId` | String | FK | — | → Patient.id |
| `appointmentId` | String | Unique/FK | — | → Appointment.id |
| `enrollmentId` | String | FK | — | → PatientEnrollment.id |
| `score` | Int | Sim | — | Score NPS (0-10) |
| `comment` | String | Não | — | Comentário |
| `sentAt` | DateTime | Não | — | Quando a msg Z-API foi enviada |
| `respondedAt` | DateTime | Não | — | Quando o paciente respondeu |
| `createdAt` | DateTime | Sim | `now()` | |
| `updatedAt` | DateTime | Sim | auto | |

**Índices:** `patientId`, `enrollmentId`, `score`

---

## 36. CheckIn

> Tabela: `check_ins` — Check-ins preventivos (PREVIA Digital)

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|:-----------:|---------|-----------|
| `id` | String | PK | cuid() | |
| `patientId` | String | FK | — | → Patient.id |
| `enrollmentId` | String | FK | — | → PatientEnrollment.id |
| `scheduledAt` | DateTime | Sim | — | Data agendada |
| `completedAt` | DateTime | Não | — | Data de conclusão |
| `type` | CheckInType | Sim | `MONTHLY_REVIEW` | Tipo |
| `notes` | String | Não | — | Observações |
| `createdAt` | DateTime | Sim | `now()` | |
| `updatedAt` | DateTime | Sim | auto | |

**Índices:** `patientId`, `enrollmentId`, `scheduledAt`

---

## 37. DigitalSignature

> Tabela: `digital_signatures` — Assinaturas digitais ICP-Brasil

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|:-----------:|---------|-----------|
| `id` | String | PK | cuid() | |
| `documentType` | SignedDocumentType | Sim | — | ATESTADO, RECEITA, LAUDO, RECEITA_TEXTO, SOLICITACAO |
| `provider` | SignatureProvider | Sim | `MOCK` | MOCK, VIDAAS, BIRDID |
| `status` | SignatureStatus | Sim | `PENDING` | PENDING, SIGNED, FAILED |
| `doctorId` | String | FK | — | → Doctor.id |
| `patientId` | String | FK | — | → Patient.id |
| `referenceId` | String | Sim | — | ID do documento assinado |
| `oauthState` | String | Unique | — | Estado OAuth (para callback) |
| `pdfPath` | String | Não | — | Caminho do PDF original |
| `signedPdfPath` | String | Não | — | Caminho do PDF assinado |
| `pdfData` | Bytes | Não | — | PDF original (binário) |
| `signedPdfData` | Bytes | Não | — | PDF assinado (binário) |
| `documentHash` | String | Não | — | Hash SHA-256 do documento |
| `signerName` | String | Não | — | Nome do signatário |
| `signerCpf` | String | Não | — | CPF do signatário |
| `signedAt` | DateTime | Não | — | Data/hora da assinatura |
| `metadata` | Json | Não | — | Dados adicionais |
| `createdAt` | DateTime | Sim | `now()` | |
| `updatedAt` | DateTime | Sim | auto | |

**Relações:** `doctor` (N:1), `patient` (N:1), `atestado` (1:1), `receita` (1:1), `examOrder` (1:1)
**Índices:** `status`, `doctorId`, `referenceId`

---

## 38. Atestado

> Tabela: `atestados` — Atestados médicos

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|:-----------:|---------|-----------|
| `id` | String | PK | cuid() | |
| `patientId` | String | FK | — | → Patient.id |
| `doctorId` | String | FK | — | → Doctor.id |
| `appointmentId` | String | FK | — | → Appointment.id |
| `dias` | Int | Sim | — | Número de dias de afastamento |
| `cid` | String | Não | — | Código CID-10 |
| `finalidade` | String | Sim | — | "trabalho", "escola", "outro" |
| `observacoes` | String | Não | — | Observações |
| `dataAtestado` | DateTime | Sim | `now()` | Data do atestado |
| `signatureId` | String | Unique/FK | — | → DigitalSignature.id (1:1) |
| `createdAt` | DateTime | Sim | `now()` | |
| `updatedAt` | DateTime | Sim | auto | |

**Relações:** `patient` (N:1), `doctor` (N:1), `appointment` (N:1), `signature` (1:1)
**Índices:** `patientId`, `doctorId`

---

## 39. Diagrama de Relações

```
User ──1:1──► Doctor ──1:N──► Appointment ◄──N:1── Patient
  │              │                 │                    │
  │              │                 ├── 1:1 ─► MedicalRecord
  │              │                 ├── 1:1 ─► Payment ──1:1──► DoctorPayment
  │              │                 ├── 1:1 ─► Prescription ──► PrescriptionItem[]
  │              │                 ├── 1:1 ─► GuiaFaturamento ──► GuiaProcedimento[]
  │              │                 ├── 1:N ─► ExamOrder
  │              │                 ├── 1:N ─► StockMovement
  │              │                 ├── 1:1 ─► NpsResponse
  │              │                 └── 1:N ─► Atestado
  │              │
  │              ├── 1:N ─► ExamPackage ──► ExamPackageItem[] ──► ExamCatalog
  │              └── 1:N ─► DigitalSignature
  │
  ├── 1:1 ─► Patient ──1:N──► Consent
  │              ├── 1:N ─► PatientEnrollment ──► PreventivoProgram
  │              │              ├── 1:N ─► CheckIn
  │              │              ├── 1:N ─► Payment
  │              │              └── 1:N ─► NpsResponse
  │              ├── 1:N ─► MetabolicMarker
  │              ├── 1:N ─► Exam
  │              └── 1:N ─► Chat
  │
  └── 1:N ─► AuditLog

InsurancePlan ──1:N──► InsuranceContract ──1:N──► InsuranceProcedure
     ├── 1:N ─► LoteFaturamento ──1:N──► GuiaFaturamento
     ├── 1:N ─► Appointment
     └── 1:N ─► ExamOrder

Material ──1:N──► StockMovement
AccountPayable (standalone)
Lead (standalone)
ChatLog (standalone)
PreAppointment (standalone)
Config (standalone — registro único)
```

---

## Resumo Quantitativo

| Categoria | Tabelas |
|-----------|---------|
| Configuração | 1 (Config) |
| Auth & Usuários | 1 (User) |
| Clínico | 5 (Doctor, Patient, MedicalRecord, Exam, Atestado) |
| Agendamento | 2 (Appointment, PreAppointment) |
| Prescrições | 2 (Prescription, PrescriptionItem) |
| Exames | 4 (ExamCatalog, ExamPackage, ExamPackageItem, ExamOrder) |
| Financeiro | 3 (Payment, DoctorPayment, AccountPayable) |
| Convênios & TISS | 6 (InsurancePlan, InsuranceContract, InsuranceProcedure, GuiaFaturamento, GuiaProcedimento, LoteFaturamento) |
| Programas Preventivos | 4 (PreventivoProgram, PatientEnrollment, MetabolicMarker, CheckIn) |
| Comunicação | 3 (Chat, ChatLog, NpsResponse) |
| Estoque | 2 (Material, StockMovement) |
| Compliance | 3 (Consent, AuditLog, DigitalSignature) |
| Captação | 1 (Lead) |
| **Total** | **37 tabelas** + **21 enums** |
