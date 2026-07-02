# MaisSaúde BR — Plano de Testes Cypress

> Documento de referência com **todas as funcionalidades** do sistema mapeadas para cobertura de testes end-to-end.
> Gerado em: 25/06/2026

---

## Sumário

1. [Autenticação & Controle de Acesso](#1-autenticação--controle-de-acesso)
2. [Gestão de Pacientes](#2-gestão-de-pacientes)
3. [Agenda & Agendamento](#3-agenda--agendamento)
4. [Prontuário Eletrônico](#4-prontuário-eletrônico)
5. [Prescrições (Receitas)](#5-prescrições-receitas)
6. [Atestados Médicos](#6-atestados-médicos)
7. [Catálogo de Exames](#7-catálogo-de-exames)
8. [Solicitações de Exames (Exam Orders)](#8-solicitações-de-exames-exam-orders)
9. [Pacotes de Exames](#9-pacotes-de-exames)
10. [Resultados de Exames (Upload/OCR)](#10-resultados-de-exames-uploadocr)
11. [Assinatura Digital (ICP-Brasil)](#11-assinatura-digital-icp-brasil)
12. [Financeiro — Contas a Receber (Pagamentos)](#12-financeiro--contas-a-receber-pagamentos)
13. [Financeiro — Repasses Médicos](#13-financeiro--repasses-médicos)
14. [Financeiro — Contas a Pagar](#14-financeiro--contas-a-pagar)
15. [Financeiro — Boletos (OCR)](#15-financeiro--boletos-ocr)
16. [Convênios & Planos de Saúde](#16-convênios--planos-de-saúde)
17. [TISS — Faturamento de Convênios](#17-tiss--faturamento-de-convênios)
18. [Programas Preventivos & Inscrições](#18-programas-preventivos--inscrições)
19. [Marcadores Metabólicos](#19-marcadores-metabólicos)
20. [Check-Ins (PREVIA Digital)](#20-check-ins-previa-digital)
21. [NPS (Satisfação do Paciente)](#21-nps-satisfação-do-paciente)
22. [WhatsApp — Envio de Mensagens](#22-whatsapp--envio-de-mensagens)
23. [WhatsApp — Chat (IA Híbrida)](#23-whatsapp--chat-ia-híbrida)
24. [Gestão de Médicos](#24-gestão-de-médicos)
25. [Gestão de Usuários (Admin)](#25-gestão-de-usuários-admin)
26. [Leads & Captação](#26-leads--captação)
27. [Estoque & Materiais](#27-estoque--materiais)
28. [Analytics & Dashboards](#28-analytics--dashboards)
29. [Relatórios](#29-relatórios)
30. [Configurações da Clínica](#30-configurações-da-clínica)
31. [Auditoria & LGPD](#31-auditoria--lgpd)
32. [Manual do Sistema](#32-manual-do-sistema)

---

## 1. Autenticação & Controle de Acesso

**Rota frontend:** `/` (página de login)
**API:** `POST /auth/login`, `POST /auth/logout`, `POST /auth/register`
**Arquivo:** `backend/src/routes/auth.routes.ts`

### Casos de Teste

| # | Caso de Teste | Tipo | Prioridade |
|---|--------------|------|------------|
| 1.1 | Login com credenciais válidas (ADMIN) | Positivo | Alta |
| 1.2 | Login com credenciais válidas (DOCTOR) | Positivo | Alta |
| 1.3 | Login com credenciais válidas (RECEPTIONIST) | Positivo | Alta |
| 1.4 | Login com email inválido | Negativo | Alta |
| 1.5 | Login com senha incorreta | Negativo | Alta |
| 1.6 | Login com campos vazios | Negativo | Alta |
| 1.7 | Rate limiting — bloqueia após 10 tentativas em 15 min | Negativo | Média |
| 1.8 | Logout — token é revogado | Positivo | Alta |
| 1.9 | Acesso a rota protegida sem token — redireciona para login | Negativo | Alta |
| 1.10 | Acesso a rota admin por usuário não-admin — nega acesso | Negativo | Alta |
| 1.11 | Token expirado — redireciona para login | Negativo | Média |
| 1.12 | Persistência de sessão — recarregar página mantém autenticação | Positivo | Média |

---

## 2. Gestão de Pacientes

**Rota frontend:** `/pacientes`, `/pacientes/[id]`, `/pacientes/excluidos`
**API:** `GET/POST /patients`, `GET/PATCH/DELETE /patients/:id`
**Arquivo:** `backend/src/routes/patients.routes.ts`

### Casos de Teste

| # | Caso de Teste | Tipo | Prioridade |
|---|--------------|------|------------|
| 2.1 | Listar pacientes — exibe tabela com dados | Positivo | Alta |
| 2.2 | Buscar paciente por nome | Positivo | Alta |
| 2.3 | Buscar paciente por CPF | Positivo | Alta |
| 2.4 | Criar paciente com todos os campos obrigatórios | Positivo | Alta |
| 2.5 | Criar paciente — CPF com máscara (000.000.000-00) é salvo corretamente | Positivo | Alta |
| 2.6 | Criar paciente — CPF duplicado é rejeitado | Negativo | Alta |
| 2.7 | Criar paciente — campos obrigatórios vazios mostra validação | Negativo | Alta |
| 2.8 | Editar dados do paciente (nome, telefone, endereço) | Positivo | Alta |
| 2.9 | Visualizar detalhes do paciente (página individual) | Positivo | Alta |
| 2.10 | Excluir paciente (soft delete) — paciente some da lista principal | Positivo | Média |
| 2.11 | Listar pacientes excluídos em `/pacientes/excluidos` | Positivo | Média |
| 2.12 | Preencher endereço — CEP busca endereço automaticamente | Positivo | Média |
| 2.13 | Selecionar convênio e número da carteirinha | Positivo | Média |
| 2.14 | Selecionar perfil de risco (NONE, METABOLIC, CARDIOMETABOLIC, HIGH) | Positivo | Média |
| 2.15 | Upload de foto do paciente | Positivo | Baixa |
| 2.16 | Campos de tipo sanguíneo, alergias, observações | Positivo | Baixa |
| 2.17 | Modal de criação rápida (PatientCreateModal) abre e funciona | Positivo | Alta |

---

## 3. Agenda & Agendamento

**Rota frontend:** `/agenda`
**API:** `GET/POST /appointments`, `GET/PATCH/DELETE /appointments/:id`
**Arquivo:** `backend/src/routes/appointments.routes.ts`

### Casos de Teste

| # | Caso de Teste | Tipo | Prioridade |
|---|--------------|------|------------|
| 3.1 | Visualizar agenda — calendário carrega corretamente | Positivo | Alta |
| 3.2 | Criar agendamento com paciente, médico, data/hora | Positivo | Alta |
| 3.3 | Criar agendamento — selecionar convênio (insurancePlanId) | Positivo | Alta |
| 3.4 | Criar agendamento — marcar como retorno (isReturn) | Positivo | Média |
| 3.5 | Criar agendamento — conflito de horário é validado | Negativo | Alta |
| 3.6 | Criar agendamento — campos obrigatórios vazios mostra erro | Negativo | Alta |
| 3.7 | Editar agendamento — alterar data/hora | Positivo | Alta |
| 3.8 | Editar agendamento — alterar status para CONFIRMED | Positivo | Alta |
| 3.9 | Editar agendamento — alterar status para IN_PROGRESS | Positivo | Alta |
| 3.10 | Editar agendamento — alterar status para COMPLETED | Positivo | Alta |
| 3.11 | Cancelar agendamento — status muda para CANCELLED | Positivo | Alta |
| 3.12 | Marcar como NO_SHOW (falta) | Positivo | Média |
| 3.13 | Filtrar agenda por médico | Positivo | Média |
| 3.14 | Filtrar agenda por data | Positivo | Média |
| 3.15 | Excluir agendamento | Positivo | Média |
| 3.16 | Navegação entre dias/semana/mês no calendário | Positivo | Média |

---

## 4. Prontuário Eletrônico

**Rota frontend:** `/prontuarios`, `/prontuarios/[id]`
**API:** `GET/POST/PATCH/DELETE /medical-records`
**Arquivo:** `backend/src/routes/medical-records.routes.ts`

### Casos de Teste

| # | Caso de Teste | Tipo | Prioridade |
|---|--------------|------|------------|
| 4.1 | Listar prontuários | Positivo | Alta |
| 4.2 | Criar prontuário vinculado a consulta | Positivo | Alta |
| 4.3 | Criar prontuário avulso (sem consulta) | Positivo | Alta |
| 4.4 | Preencher queixa principal (chiefComplaint) | Positivo | Alta |
| 4.5 | Preencher história da doença atual | Positivo | Alta |
| 4.6 | Preencher diagnóstico | Positivo | Alta |
| 4.7 | Preencher prescrição no corpo do prontuário | Positivo | Alta |
| 4.8 | Registrar sinais vitais (PA, FC, temp, peso, altura, SpO2) | Positivo | Alta |
| 4.9 | Registrar história clínica (medicações, condições, cirurgias, família) | Positivo | Média |
| 4.10 | Registrar estilo de vida (tabagismo, álcool, atividade física) | Positivo | Média |
| 4.11 | Preencher dados de especialidade (JSON flexível) | Positivo | Média |
| 4.12 | Editar prontuário existente | Positivo | Alta |
| 4.13 | Visualizar prontuário detalhado (página individual) | Positivo | Alta |
| 4.14 | Excluir prontuário | Positivo | Média |
| 4.15 | Buscar/filtrar prontuários por paciente | Positivo | Média |

### OCR — Análise de Documentos

| # | Caso de Teste | Tipo | Prioridade |
|---|--------------|------|------------|
| 4.16 | Upload de imagem para análise OCR (preview) | Positivo | Média |
| 4.17 | Criar prontuário a partir de OCR | Positivo | Média |
| 4.18 | Anexar OCR a prontuário existente | Positivo | Média |
| 4.19 | Upload de formato inválido — erro exibido | Negativo | Baixa |

---

## 5. Prescrições (Receitas)

**Rota frontend:** Via prontuário / página do paciente
**API:** `GET/POST/DELETE /patients/:patientId/prescriptions`
**Arquivo:** `backend/src/routes/prescriptions.routes.ts`

### Casos de Teste

| # | Caso de Teste | Tipo | Prioridade |
|---|--------------|------|------------|
| 5.1 | Criar prescrição para paciente | Positivo | Alta |
| 5.2 | Adicionar item de medicação (medicamento, dosagem, frequência, duração) | Positivo | Alta |
| 5.3 | Adicionar múltiplos itens à prescrição | Positivo | Alta |
| 5.4 | Preencher instruções de uso por item | Positivo | Média |
| 5.5 | Criar prescrição tipo RECEITA (padrão) | Positivo | Alta |
| 5.6 | Criar prescrição tipo RECEITA_TEXTO (texto livre) | Positivo | Alta |
| 5.7 | Listar prescrições do paciente | Positivo | Alta |
| 5.8 | Excluir prescrição | Positivo | Média |
| 5.9 | Iniciar assinatura digital da prescrição | Positivo | Alta |
| 5.10 | Campos obrigatórios vazios — validação | Negativo | Alta |

---

## 6. Atestados Médicos

**Rota frontend:** Via prontuário / página do paciente
**API:** `GET/POST/DELETE /atestados`
**Arquivo:** `backend/src/routes/atestados.routes.ts`

### Casos de Teste

| # | Caso de Teste | Tipo | Prioridade |
|---|--------------|------|------------|
| 6.1 | Criar atestado com número de dias | Positivo | Alta |
| 6.2 | Selecionar CID-10 (busca por código/descrição) | Positivo | Alta |
| 6.3 | Definir finalidade: trabalho, escola, outro | Positivo | Alta |
| 6.4 | Preencher observações | Positivo | Média |
| 6.5 | Listar atestados do paciente | Positivo | Alta |
| 6.6 | Excluir atestado | Positivo | Média |
| 6.7 | Iniciar assinatura digital do atestado | Positivo | Alta |
| 6.8 | Campos obrigatórios vazios — validação | Negativo | Alta |

---

## 7. Catálogo de Exames

**Rota frontend:** `/exames` (aba de catálogo)
**API:** `GET/POST/PATCH/DELETE /exam-catalog`
**Arquivo:** `backend/src/routes/exam-catalog.routes.ts`

### Casos de Teste

| # | Caso de Teste | Tipo | Prioridade |
|---|--------------|------|------------|
| 7.1 | Listar exames do catálogo | Positivo | Alta |
| 7.2 | Criar exame com nome, código TUSS, preço | Positivo | Alta |
| 7.3 | Definir regra de repasse (percentual ou fixo) | Positivo | Média |
| 7.4 | Preencher descrição e duração estimada | Positivo | Média |
| 7.5 | Editar exame do catálogo | Positivo | Alta |
| 7.6 | Excluir exame do catálogo | Positivo | Média |
| 7.7 | Buscar exame por nome ou código TUSS | Positivo | Média |
| 7.8 | Nome duplicado — validação | Negativo | Média |

---

## 8. Solicitações de Exames (Exam Orders)

**Rota frontend:** Via prontuário / agenda
**API:** `GET/POST/PATCH/DELETE /exam-orders`, `POST /exam-orders/batch`
**Arquivo:** `backend/src/routes/exam-orders.routes.ts`

### Casos de Teste

| # | Caso de Teste | Tipo | Prioridade |
|---|--------------|------|------------|
| 8.1 | Criar solicitação de exame individual | Positivo | Alta |
| 8.2 | Criar solicitação em lote (batch) — múltiplos exames | Positivo | Alta |
| 8.3 | Selecionar exame do catálogo via modal (ExamSelectorModal) | Positivo | Alta |
| 8.4 | Vincular solicitação ao convênio (insurancePlanId) | Positivo | Alta |
| 8.5 | Listar solicitações — filtrar por paciente | Positivo | Alta |
| 8.6 | Listar solicitações — filtrar por status | Positivo | Média |
| 8.7 | Alterar status: PENDING → SCHEDULED | Positivo | Alta |
| 8.8 | Alterar status: SCHEDULED → IN_PROGRESS | Positivo | Alta |
| 8.9 | Alterar status: IN_PROGRESS → COMPLETED | Positivo | Alta |
| 8.10 | Cancelar solicitação | Positivo | Média |
| 8.11 | Agendar data para realização | Positivo | Média |
| 8.12 | Editar solicitação existente | Positivo | Média |
| 8.13 | Excluir solicitação | Positivo | Média |
| 8.14 | Iniciar assinatura digital da solicitação | Positivo | Alta |
| 8.15 | Geração automática de Guia SP/SADT a partir da solicitação | Positivo | Alta |

---

## 9. Pacotes de Exames

**Rota frontend:** `/exames` (aba de pacotes)
**API:** `GET/POST/PATCH/DELETE /exam-packages`
**Arquivo:** `backend/src/routes/exam-packages.routes.ts`

### Casos de Teste

| # | Caso de Teste | Tipo | Prioridade |
|---|--------------|------|------------|
| 9.1 | Criar pacote de exames com nome | Positivo | Alta |
| 9.2 | Adicionar exames do catálogo ao pacote | Positivo | Alta |
| 9.3 | Associar pacote a médico específico | Positivo | Média |
| 9.4 | Listar pacotes existentes | Positivo | Alta |
| 9.5 | Editar pacote (adicionar/remover exames) | Positivo | Média |
| 9.6 | Excluir pacote | Positivo | Média |
| 9.7 | Usar pacote para gerar solicitações em lote | Positivo | Alta |

---

## 10. Resultados de Exames (Upload/OCR)

**Rota frontend:** `/exames`
**API:** `GET/POST/PATCH/DELETE /exams`
**Arquivo:** `backend/src/routes/exams.routes.ts`

### Casos de Teste

| # | Caso de Teste | Tipo | Prioridade |
|---|--------------|------|------------|
| 10.1 | Upload de resultado de exame (JPEG, PNG, PDF) | Positivo | Alta |
| 10.2 | Vincular resultado a paciente | Positivo | Alta |
| 10.3 | OCR — texto extraído automaticamente | Positivo | Média |
| 10.4 | Adicionar notas/observações ao resultado | Positivo | Média |
| 10.5 | Listar resultados por paciente | Positivo | Alta |
| 10.6 | Editar resultado | Positivo | Média |
| 10.7 | Excluir resultado | Positivo | Média |
| 10.8 | Upload de formato não suportado — erro | Negativo | Média |
| 10.9 | Upload sem arquivo — validação | Negativo | Média |

---

## 11. Assinatura Digital (ICP-Brasil)

**Rota frontend:** `/assinaturas`
**API:** `POST /digital-signature/init`, `GET /digital-signature/callback`, `GET /digital-signature/:id/download`
**Arquivo:** `backend/src/routes/digital-signature.routes.ts`

### Casos de Teste

| # | Caso de Teste | Tipo | Prioridade |
|---|--------------|------|------------|
| 11.1 | Listar assinaturas — todas, filtradas por status | Positivo | Alta |
| 11.2 | Iniciar assinatura de RECEITA — PDF é gerado | Positivo | Alta |
| 11.3 | Iniciar assinatura de RECEITA_TEXTO | Positivo | Alta |
| 11.4 | Iniciar assinatura de ATESTADO | Positivo | Alta |
| 11.5 | Iniciar assinatura de LAUDO | Positivo | Alta |
| 11.6 | Iniciar assinatura de SOLICITACAO | Positivo | Alta |
| 11.7 | Status muda de PENDING para SIGNED após callback | Positivo | Alta |
| 11.8 | Download de PDF assinado | Positivo | Alta |
| 11.9 | Assinatura FAILED — exibe erro ao usuário | Negativo | Média |
| 11.10 | Médico sem CPF cadastrado — impede assinatura | Negativo | Alta |
| 11.11 | Seleção de provedor (MOCK/VIDAAS/BIRDID) | Positivo | Média |

---

## 12. Financeiro — Contas a Receber (Pagamentos)

**Rota frontend:** `/financeiro`
**API:** `GET/POST/PATCH/DELETE /payments`, `POST /payments/:id/pay`
**Arquivo:** `backend/src/routes/payments.routes.ts`

### Casos de Teste

| # | Caso de Teste | Tipo | Prioridade |
|---|--------------|------|------------|
| 12.1 | Listar pagamentos pendentes | Positivo | Alta |
| 12.2 | Criar pagamento vinculado a consulta | Positivo | Alta |
| 12.3 | Criar pagamento avulso | Positivo | Alta |
| 12.4 | Selecionar método: PIX, cartão crédito, débito, dinheiro, transferência | Positivo | Alta |
| 12.5 | Selecionar método: HEALTH_INSURANCE (convênio) | Positivo | Alta |
| 12.6 | Registrar recebimento (`/pay`) — status muda para PAID | Positivo | Alta |
| 12.7 | Pagamento gera repasse médico automaticamente | Positivo | Alta |
| 12.8 | Editar valor do pagamento | Positivo | Média |
| 12.9 | Cancelar pagamento | Positivo | Média |
| 12.10 | Reembolsar pagamento (REFUNDED) | Positivo | Média |
| 12.11 | Pagamento vencido — status OVERDUE exibido | Positivo | Média |
| 12.12 | Filtrar por status (PENDING, PAID, OVERDUE, CANCELLED) | Positivo | Média |
| 12.13 | Filtrar por período (data) | Positivo | Média |
| 12.14 | Excluir pagamento | Positivo | Baixa |
| 12.15 | Valor zerado ou negativo — validação | Negativo | Alta |

---

## 13. Financeiro — Repasses Médicos

**Rota frontend:** `/financeiro/conciliacao-medicos`
**API:** `GET/POST/PATCH /doctor-payments`, `POST /doctor-payments/mark-paid`, `POST /doctor-payments/:id/cancel`
**Arquivo:** `backend/src/routes/doctor-payments.routes.ts`

### Casos de Teste

| # | Caso de Teste | Tipo | Prioridade |
|---|--------------|------|------------|
| 13.1 | Listar repasses pendentes por médico | Positivo | Alta |
| 13.2 | Visualizar resumo (`/summary`) — total por médico | Positivo | Alta |
| 13.3 | Marcar repasse como pago (individual) | Positivo | Alta |
| 13.4 | Marcar repasses em lote como pagos (`/mark-paid`) | Positivo | Alta |
| 13.5 | Cancelar repasse | Positivo | Média |
| 13.6 | Informar número da NF e arquivo da NF | Positivo | Alta |
| 13.7 | Repasse gerado automaticamente — percentual correto | Positivo | Alta |
| 13.8 | Repasse gerado automaticamente — valor fixo correto | Positivo | Alta |
| 13.9 | Filtrar por período | Positivo | Média |
| 13.10 | Filtrar por status (PENDING, PAID, CANCELLED) | Positivo | Média |

---

## 14. Financeiro — Contas a Pagar

**Rota frontend:** `/financeiro` (aba despesas)
**API:** `GET/POST/PATCH/DELETE /accounts-payable`, `POST /accounts-payable/:id/pay`
**Arquivo:** `backend/src/routes/accounts-payable.routes.ts`

### Casos de Teste

| # | Caso de Teste | Tipo | Prioridade |
|---|--------------|------|------------|
| 14.1 | Listar contas a pagar | Positivo | Alta |
| 14.2 | Criar conta a pagar com categoria, fornecedor, valor, vencimento | Positivo | Alta |
| 14.3 | Registrar pagamento da conta | Positivo | Alta |
| 14.4 | Visualizar resumo por categoria (`/summary`) | Positivo | Média |
| 14.5 | Editar conta a pagar | Positivo | Média |
| 14.6 | Excluir conta a pagar | Positivo | Média |
| 14.7 | Anexar arquivo à conta | Positivo | Baixa |
| 14.8 | Filtrar por período e status | Positivo | Média |

---

## 15. Financeiro — Boletos (OCR)

**Rota frontend:** `/financeiro/boletos`
**API:** Integrado com contas a pagar
**Componente:** Via upload + OCR

### Casos de Teste

| # | Caso de Teste | Tipo | Prioridade |
|---|--------------|------|------------|
| 15.1 | Upload de boleto (PDF/imagem) | Positivo | Alta |
| 15.2 | OCR extrai linha digitável automaticamente | Positivo | Alta |
| 15.3 | OCR extrai código de barras | Positivo | Média |
| 15.4 | OCR extrai código do banco | Positivo | Média |
| 15.5 | Criar conta a pagar a partir do boleto OCR | Positivo | Alta |
| 15.6 | Upload de arquivo ilegível — erro/confiança baixa | Negativo | Média |

---

## 16. Convênios & Planos de Saúde

**Rota frontend:** `/convenios`
**API:** `GET/POST/PATCH/DELETE /insurance-plans`, `/insurance-contracts`, `/insurance-procedures`
**Arquivo:** `backend/src/routes/insurance-plans.routes.ts`

### Casos de Teste

| # | Caso de Teste | Tipo | Prioridade |
|---|--------------|------|------------|
| 16.1 | Listar convênios cadastrados | Positivo | Alta |
| 16.2 | Criar convênio com nome, código ANS, contato | Positivo | Alta |
| 16.3 | Informar código do prestador na operadora | Positivo | Média |
| 16.4 | Editar convênio | Positivo | Alta |
| 16.5 | Ativar/desativar convênio | Positivo | Média |
| 16.6 | Excluir convênio | Positivo | Média |
| 16.7 | Criar contrato vinculado ao convênio (período, valor consulta) | Positivo | Alta |
| 16.8 | Editar contrato | Positivo | Média |
| 16.9 | Excluir contrato | Positivo | Média |
| 16.10 | Adicionar procedimento TUSS ao contrato (código, descrição, preço) | Positivo | Alta |
| 16.11 | Editar procedimento | Positivo | Média |
| 16.12 | Excluir procedimento | Positivo | Média |

---

## 17. TISS — Faturamento de Convênios

**Rota frontend:** Via convênios / financeiro
**API:** `GET/POST/PATCH/DELETE /tiss/guias`, `GET/POST/PATCH /tiss/lotes`
**Arquivo:** `backend/src/routes/tiss.routes.ts`

### Casos de Teste

| # | Caso de Teste | Tipo | Prioridade |
|---|--------------|------|------------|
| 17.1 | Criar Guia de Consulta (tipo CONSULTA) | Positivo | Alta |
| 17.2 | Criar Guia SP/SADT (tipo SP_SADT) | Positivo | Alta |
| 17.3 | Preencher dados do beneficiário (nome, carteirinha, validade) | Positivo | Alta |
| 17.4 | Preencher dados do executante (CRM, estado, CBOS) | Positivo | Alta |
| 17.5 | Adicionar procedimentos (código TUSS, qtd, valor unitário) | Positivo | Alta |
| 17.6 | Registrar número de autorização | Positivo | Média |
| 17.7 | Listar guias — filtrar por status | Positivo | Alta |
| 17.8 | Alterar status: PENDENTE → AUTORIZADA | Positivo | Alta |
| 17.9 | Alterar status: AUTORIZADA → FATURADA | Positivo | Alta |
| 17.10 | Registrar glosa (GLOSADA) com motivo | Positivo | Média |
| 17.11 | Editar guia | Positivo | Média |
| 17.12 | Excluir guia | Positivo | Média |
| 17.13 | Criar Lote de Faturamento com competência (YYYY-MM) | Positivo | Alta |
| 17.14 | Adicionar guias ao lote | Positivo | Alta |
| 17.15 | Fechar lote (ABERTO → FECHADO) | Positivo | Alta |
| 17.16 | Enviar lote (FECHADO → ENVIADO) | Positivo | Alta |
| 17.17 | Liquidar lote (ENVIADO → LIQUIDADO) | Positivo | Média |
| 17.18 | Geração de XML TISS | Positivo | Alta |

---

## 18. Programas Preventivos & Inscrições

**Rota frontend:** `/programas`
**API:** `GET/POST/PATCH/DELETE /preventivo-programs`, `GET/POST/PATCH/DELETE /patient-enrollments`
**Arquivos:** `backend/src/routes/preventivo-programs.routes.ts`, `backend/src/routes/patient-enrollments.routes.ts`

### Programas

| # | Caso de Teste | Tipo | Prioridade |
|---|--------------|------|------------|
| 18.1 | Listar programas preventivos | Positivo | Alta |
| 18.2 | Criar programa com nome, descrição, duração (dias) | Positivo | Alta |
| 18.3 | Definir taxa mensal e taxa de entrada | Positivo | Alta |
| 18.4 | Definir escopo clínico (clinicScope) | Positivo | Média |
| 18.5 | Ativar/desativar programa | Positivo | Média |
| 18.6 | Editar programa | Positivo | Média |
| 18.7 | Excluir programa | Positivo | Média |

### Inscrições de Pacientes

| # | Caso de Teste | Tipo | Prioridade |
|---|--------------|------|------------|
| 18.8 | Inscrever paciente em programa | Positivo | Alta |
| 18.9 | Data final calculada automaticamente (início + duração) | Positivo | Alta |
| 18.10 | Alterar status: ACTIVE → PAUSED | Positivo | Média |
| 18.11 | Alterar status: ACTIVE → CANCELLED (com motivo) | Positivo | Média |
| 18.12 | Alterar status: ACTIVE → COMPLETED | Positivo | Média |
| 18.13 | Acompanhar estágio da jornada (ONBOARDING → ACTIVE → etc.) | Positivo | Média |
| 18.14 | Listar inscrições — filtrar por programa | Positivo | Média |
| 18.15 | Listar inscrições — filtrar por status | Positivo | Média |
| 18.16 | Editar inscrição (override de taxa) | Positivo | Média |
| 18.17 | Excluir inscrição | Positivo | Baixa |
| 18.18 | Próxima data de cobrança (nextBillingDate) exibida | Positivo | Média |

---

## 19. Marcadores Metabólicos

**Rota frontend:** Via perfil do paciente / programas
**API:** `GET/POST/PATCH/DELETE /metabolic-markers`
**Arquivo:** `backend/src/routes/metabolic-markers.routes.ts`

### Casos de Teste

| # | Caso de Teste | Tipo | Prioridade |
|---|--------------|------|------------|
| 19.1 | Registrar marcadores (peso, IMC, PA, glicose, HbA1c, etc.) | Positivo | Alta |
| 19.2 | Registrar colesterol (total, LDL, HDL, triglicerídeos) | Positivo | Alta |
| 19.3 | Listar histórico de marcadores por paciente | Positivo | Alta |
| 19.4 | Editar registro de marcador | Positivo | Média |
| 19.5 | Excluir registro de marcador | Positivo | Média |
| 19.6 | Visualizar evolução temporal (gráfico/tendência) | Positivo | Média |
| 19.7 | Adicionar notas ao registro | Positivo | Baixa |

---

## 20. Check-Ins (PREVIA Digital)

**Rota frontend:** Via programas / perfil do paciente
**API:** `GET/POST/PATCH/DELETE /check-ins`
**Arquivo:** `backend/src/routes/check-ins.routes.ts`

### Casos de Teste

| # | Caso de Teste | Tipo | Prioridade |
|---|--------------|------|------------|
| 20.1 | Criar check-in com tipo (INITIAL_ASSESSMENT, MONTHLY_REVIEW, etc.) | Positivo | Alta |
| 20.2 | Agendar data do check-in | Positivo | Alta |
| 20.3 | Vincular check-in a inscrição do paciente | Positivo | Alta |
| 20.4 | Marcar check-in como completado | Positivo | Alta |
| 20.5 | Listar check-ins — filtrar por paciente | Positivo | Média |
| 20.6 | Listar check-ins — filtrar por tipo | Positivo | Média |
| 20.7 | Cálculo de adesão (% completados) | Positivo | Média |
| 20.8 | Editar check-in | Positivo | Média |
| 20.9 | Excluir check-in | Positivo | Baixa |

---

## 21. NPS (Satisfação do Paciente)

**Rota frontend:** Via dashboard / analytics
**API:** `GET/POST /nps`, `GET /nps/summary`
**Arquivo:** `backend/src/routes/nps.routes.ts`

### Casos de Teste

| # | Caso de Teste | Tipo | Prioridade |
|---|--------------|------|------------|
| 21.1 | Registrar resposta NPS (score 0-10 + comentário) | Positivo | Alta |
| 21.2 | Vincular NPS a consulta | Positivo | Média |
| 21.3 | Vincular NPS a inscrição | Positivo | Média |
| 21.4 | Listar respostas NPS | Positivo | Alta |
| 21.5 | Visualizar summary — score agregado | Positivo | Alta |
| 21.6 | Classificação automática: promotor (9-10), neutro (7-8), detrator (0-6) | Positivo | Média |
| 21.7 | Score fora do intervalo 0-10 — validação | Negativo | Média |

---

## 22. WhatsApp — Envio de Mensagens

**Rota frontend:** Via diversas telas
**API:** `POST /send`, `POST /bulk-send`
**Arquivo:** `backend/src/routes/whatsapp.routes.ts`

### Casos de Teste

| # | Caso de Teste | Tipo | Prioridade |
|---|--------------|------|------------|
| 22.1 | Enviar mensagem individual para paciente | Positivo | Alta |
| 22.2 | Enviar mensagem em massa (bulk) para todos os pacientes | Positivo | Média |
| 22.3 | Número de telefone inválido — erro | Negativo | Média |
| 22.4 | Mensagem vazia — validação | Negativo | Média |

---

## 23. WhatsApp — Chat (IA Híbrida)

**Rota frontend:** `/chats`
**API:** `GET /chats`, `GET/POST /chats/:id/*`
**Arquivos:** `backend/src/routes/chat.routes.ts`, `backend/src/routes/chat.ts`

### Casos de Teste

| # | Caso de Teste | Tipo | Prioridade |
|---|--------------|------|------------|
| 23.1 | Listar conversas ativas | Positivo | Alta |
| 23.2 | Visualizar histórico de mensagens de um chat | Positivo | Alta |
| 23.3 | Enviar mensagem direta no chat | Positivo | Alta |
| 23.4 | Transferir chat para médico (`/transfer`) | Positivo | Alta |
| 23.5 | Confirmar transferência (`/transfer-confirm`) | Positivo | Alta |
| 23.6 | Pausar/retomar IA no chat (`/toggle-ai`) | Positivo | Média |
| 23.7 | Fechar chat (`/close`) | Positivo | Média |
| 23.8 | Status do chat: ACTIVE → TRANSFERRED_TO_DOCTOR → CLOSED | Positivo | Média |
| 23.9 | Webhook processa mensagem recebida e cria resposta IA | Positivo | Alta |
| 23.10 | Contato novo cria paciente automaticamente | Positivo | Média |
| 23.11 | Contato novo cria lead automaticamente | Positivo | Média |
| 23.12 | Classificação de intenção: agendamento, pagamento, urgência, humano | Positivo | Média |

---

## 24. Gestão de Médicos

**Rota frontend:** `/medicos`
**API:** `GET/POST/PATCH/DELETE /doctors`, `GET /doctors/me`
**Arquivo:** `backend/src/routes/doctors.routes.ts`

### Casos de Teste

| # | Caso de Teste | Tipo | Prioridade |
|---|--------------|------|------------|
| 24.1 | Listar médicos | Positivo | Alta |
| 24.2 | Criar médico via modal (DoctorCreateModal) — CRM, especialidade, CPF | Positivo | Alta |
| 24.3 | Preencher horário de trabalho (workStartHour, workEndHour) | Positivo | Média |
| 24.4 | Definir tipo de repasse (PERCENTAGE ou FIXED) e valor | Positivo | Alta |
| 24.5 | Definir CPF do médico (obrigatório para assinatura digital) | Positivo | Alta |
| 24.6 | Editar dados do médico | Positivo | Alta |
| 24.7 | Excluir médico | Positivo | Média |
| 24.8 | Médico visualiza próprio perfil (`/doctors/me`) | Positivo | Média |
| 24.9 | Configurar provedor de assinatura digital (MOCK/VIDAAS/BIRDID) | Positivo | Média |
| 24.10 | Apenas ADMIN pode criar/excluir médicos | Negativo | Alta |
| 24.11 | CRM duplicado — validação | Negativo | Média |

---

## 25. Gestão de Usuários (Admin)

**Rota frontend:** `/admin/usuarios`
**API:** `GET/POST /users`, `GET/PATCH/DELETE /users/:id`
**Arquivo:** `backend/src/routes/users.routes.ts`

### Casos de Teste

| # | Caso de Teste | Tipo | Prioridade |
|---|--------------|------|------------|
| 25.1 | Listar usuários do sistema | Positivo | Alta |
| 25.2 | Criar usuário com email, senha, role | Positivo | Alta |
| 25.3 | Filtrar usuários por role (ADMIN, DOCTOR, RECEPTIONIST, PATIENT) | Positivo | Média |
| 25.4 | Filtrar por status ativo/inativo | Positivo | Média |
| 25.5 | Editar dados do usuário | Positivo | Alta |
| 25.6 | Resetar senha do usuário | Positivo | Alta |
| 25.7 | Ativar/desativar usuário | Positivo | Média |
| 25.8 | Excluir usuário | Positivo | Média |
| 25.9 | Email duplicado — validação | Negativo | Alta |
| 25.10 | Apenas ADMIN acessa esta página | Negativo | Alta |

---

## 26. Leads & Captação

**Rota frontend:** `/leads`
**API:** `GET/POST/PATCH/DELETE /leads`
**Arquivo:** `backend/src/routes/leads.routes.ts`

### Casos de Teste

| # | Caso de Teste | Tipo | Prioridade |
|---|--------------|------|------------|
| 26.1 | Listar leads | Positivo | Alta |
| 26.2 | Criar lead manualmente (nome, telefone, especialidade) | Positivo | Alta |
| 26.3 | Importar leads via planilha Excel (XLSX) | Positivo | Alta |
| 26.4 | Alterar status do lead (NOVO → CONTACTED → SCHEDULED → CONVERTED) | Positivo | Alta |
| 26.5 | Converter lead em paciente | Positivo | Alta |
| 26.6 | Editar dados do lead | Positivo | Média |
| 26.7 | Excluir lead | Positivo | Média |
| 26.8 | Buscar/filtrar leads por status | Positivo | Média |
| 26.9 | Buscar/filtrar leads por nome | Positivo | Média |
| 26.10 | Importação XLSX com formato inválido — erro | Negativo | Média |
| 26.11 | Preencher dados completos do lead (CPF, RG, endereço, convênio) | Positivo | Baixa |

---

## 27. Estoque & Materiais

**Rota frontend:** Via configurações / financeiro
**API:** `GET/POST/PATCH/DELETE /materials`, `GET/POST /stock-movements`
**Arquivo:** `backend/src/routes/stock.routes.ts`

### Casos de Teste

| # | Caso de Teste | Tipo | Prioridade |
|---|--------------|------|------------|
| 27.1 | Listar materiais cadastrados | Positivo | Alta |
| 27.2 | Criar material (nome, unidade, estoque mínimo, preço de custo) | Positivo | Alta |
| 27.3 | Editar material | Positivo | Média |
| 27.4 | Excluir material | Positivo | Média |
| 27.5 | Registrar entrada de estoque (IN) com quantidade e motivo | Positivo | Alta |
| 27.6 | Registrar saída de estoque (OUT) com quantidade e motivo | Positivo | Alta |
| 27.7 | Vincular saída de estoque a consulta | Positivo | Média |
| 27.8 | Listar movimentações de estoque | Positivo | Média |
| 27.9 | Alerta de estoque mínimo (currentStock < minStock) | Positivo | Média |
| 27.10 | Saída maior que estoque disponível — validação | Negativo | Média |

---

## 28. Analytics & Dashboards

**Rota frontend:** `/dashboard`, `/analytics`
**API:** `GET /analytics/unit-economics`
**Arquivo:** `backend/src/routes/analytics.routes.ts`

### Casos de Teste

| # | Caso de Teste | Tipo | Prioridade |
|---|--------------|------|------------|
| 28.1 | Dashboard principal carrega sem erros | Positivo | Alta |
| 28.2 | Exibe receita bruta e líquida do período | Positivo | Alta |
| 28.3 | Exibe receita por fonte (particular, convênio, programas, exames) | Positivo | Alta |
| 28.4 | Exibe CSP (custo dos serviços prestados) | Positivo | Média |
| 28.5 | Exibe despesas operacionais por categoria | Positivo | Média |
| 28.6 | Calcula EBITDA e margens | Positivo | Média |
| 28.7 | Exibe LTV do paciente | Positivo | Média |
| 28.8 | Exibe taxas de retenção (30/60/90 dias) | Positivo | Média |
| 28.9 | Exibe taxa de churn | Positivo | Média |
| 28.10 | Exibe ticket médio | Positivo | Média |
| 28.11 | Exibe NPS score | Positivo | Média |
| 28.12 | Exibe taxa de no-show | Positivo | Média |
| 28.13 | Exibe pacientes por profissional | Positivo | Baixa |
| 28.14 | Exibe completude de dados (%) | Positivo | Baixa |
| 28.15 | Filtrar analytics por período | Positivo | Alta |
| 28.16 | Analytics com base vazia — exibe zeros sem erro | Negativo | Média |

---

## 29. Relatórios

**Rota frontend:** `/relatorios`
**Arquivo:** `frontend/app/(dashboard)/relatorios/page.tsx`

### Casos de Teste

| # | Caso de Teste | Tipo | Prioridade |
|---|--------------|------|------------|
| 29.1 | Página de relatórios carrega sem erros | Positivo | Alta |
| 29.2 | Gerar relatório financeiro por período | Positivo | Alta |
| 29.3 | Gerar relatório de consultas por médico | Positivo | Média |
| 29.4 | Gerar relatório de pacientes | Positivo | Média |
| 29.5 | Exportar relatório (CSV/PDF se disponível) | Positivo | Média |
| 29.6 | Filtros de período funcionam corretamente | Positivo | Média |

---

## 30. Configurações da Clínica

**Rota frontend:** `/configuracoes`
**API:** `GET/PUT /api/config`
**Arquivo:** `backend/src/routes/config.ts`

### Casos de Teste

| # | Caso de Teste | Tipo | Prioridade |
|---|--------------|------|------------|
| 30.1 | Carregar configurações existentes | Positivo | Alta |
| 30.2 | Editar nome da clínica | Positivo | Alta |
| 30.3 | Editar CNPJ e CNES | Positivo | Média |
| 30.4 | Editar endereço da clínica | Positivo | Média |
| 30.5 | Editar horário de funcionamento | Positivo | Média |
| 30.6 | Editar WhatsApp da clínica | Positivo | Média |
| 30.7 | Editar especialidades disponíveis | Positivo | Média |
| 30.8 | Configurar telemedicina (plataforma, link, instruções) | Positivo | Média |
| 30.9 | Configurar pagamentos (valor consulta padrão, PIX, métodos) | Positivo | Alta |
| 30.10 | Editar políticas (confirmação, cancelamento) | Positivo | Média |
| 30.11 | Editar mensagens automáticas (boas-vindas, confirmação, lembrete, etc.) | Positivo | Média |
| 30.12 | Editar regras de comportamento da IA | Positivo | Baixa |
| 30.13 | Salvar configurações — persistem após reload | Positivo | Alta |

---

## 31. Auditoria & LGPD

**Rota frontend:** `/admin/audit-logs`
**API:** `GET /audit-logs`, `GET /audit-logs/summary`
**Arquivos:** `backend/src/routes/audit.routes.ts`, `backend/src/routes/consents.routes.ts`

### Auditoria

| # | Caso de Teste | Tipo | Prioridade |
|---|--------------|------|------------|
| 31.1 | Listar logs de auditoria | Positivo | Alta |
| 31.2 | Filtrar por ação (CREATE, UPDATE, DELETE, LOGIN, LOGOUT) | Positivo | Média |
| 31.3 | Filtrar por usuário | Positivo | Média |
| 31.4 | Filtrar por entidade | Positivo | Média |
| 31.5 | Visualizar detalhes do log (IP, user agent, metadata) | Positivo | Média |
| 31.6 | Visualizar resumo de atividades (`/summary`) | Positivo | Média |
| 31.7 | Apenas ADMIN acessa logs de auditoria | Negativo | Alta |

### LGPD — Consentimento

| # | Caso de Teste | Tipo | Prioridade |
|---|--------------|------|------------|
| 31.8 | Listar consentimentos do paciente | Positivo | Alta |
| 31.9 | Registrar consentimento (tratamento clínico, WhatsApp, email, etc.) | Positivo | Alta |
| 31.10 | Revogar consentimento | Positivo | Alta |
| 31.11 | Registro inclui IP e user agent | Positivo | Média |
| 31.12 | Paciente excluído (soft delete) — dados anonimizados | Positivo | Média |

---

## 32. Manual do Sistema

**Rota frontend:** `/manual`
**Arquivo:** `frontend/app/(dashboard)/manual/page.tsx`

### Casos de Teste

| # | Caso de Teste | Tipo | Prioridade |
|---|--------------|------|------------|
| 32.1 | Página do manual carrega sem erros | Positivo | Alta |
| 32.2 | Navegação entre seções do manual funciona | Positivo | Média |
| 32.3 | Conteúdo do manual é legível e formatado | Positivo | Baixa |

---

## Resumo Quantitativo

| Módulo | Casos de Teste |
|--------|---------------|
| 1. Autenticação | 12 |
| 2. Pacientes | 17 |
| 3. Agenda | 16 |
| 4. Prontuário | 19 |
| 5. Prescrições | 10 |
| 6. Atestados | 8 |
| 7. Catálogo de Exames | 8 |
| 8. Solicitações de Exames | 15 |
| 9. Pacotes de Exames | 7 |
| 10. Resultados de Exames | 9 |
| 11. Assinatura Digital | 11 |
| 12. Contas a Receber | 15 |
| 13. Repasses Médicos | 10 |
| 14. Contas a Pagar | 8 |
| 15. Boletos OCR | 6 |
| 16. Convênios | 12 |
| 17. TISS Faturamento | 18 |
| 18. Programas Preventivos | 18 |
| 19. Marcadores Metabólicos | 7 |
| 20. Check-Ins | 9 |
| 21. NPS | 7 |
| 22. WhatsApp Envio | 4 |
| 23. WhatsApp Chat | 12 |
| 24. Médicos | 11 |
| 25. Usuários Admin | 10 |
| 26. Leads | 11 |
| 27. Estoque | 10 |
| 28. Analytics | 16 |
| 29. Relatórios | 6 |
| 30. Configurações | 13 |
| 31. Auditoria & LGPD | 12 |
| 32. Manual | 3 |
| **TOTAL** | **340** |

---

## Prioridade de Implementação Sugerida

### Fase 1 — Fluxos Críticos (Golden Path)
1. Autenticação (login/logout/RBAC)
2. Pacientes (CRUD completo)
3. Agenda (criar/editar/cancelar consulta)
4. Prontuário (criar/editar vinculado a consulta)
5. Pagamentos (criar/receber)

### Fase 2 — Fluxos Clínicos
6. Prescrições + Assinatura Digital
7. Atestados + Assinatura Digital
8. Solicitações de Exames + TISS
9. Catálogo e Pacotes de Exames
10. Convênios

### Fase 3 — Financeiro Completo
11. Repasses Médicos
12. Contas a Pagar + Boletos OCR
13. Analytics & Dashboards
14. Relatórios

### Fase 4 — Comunicação & Prevenção
15. WhatsApp (envio + chat IA)
16. Programas Preventivos + Inscrições
17. Check-Ins + Marcadores Metabólicos
18. NPS

### Fase 5 — Administração
19. Gestão de Médicos
20. Gestão de Usuários
21. Leads & Captação
22. Estoque & Materiais
23. Configurações
24. Auditoria & LGPD
25. Manual

---

## Observações para Implementação Cypress

- **Autenticação:** Usar `cy.session()` para cache de login entre testes
- **Dados de teste:** Criar seed/fixtures via API antes de cada suite
- **Interceptors:** Usar `cy.intercept()` para mockear integrações externas (Z-API, OpenAI, Vidaas)
- **Uploads:** Usar `cy.fixture()` para arquivos de teste (imagens, PDFs, XLSX)
- **Formato CPF:** Sempre testar com máscara `000.000.000-00` (nunca strip de dígitos)
- **Ambiente:** Configurar `baseUrl` para ambiente de staging/dev
- **Cleanup:** Cada suite deve limpar dados criados (ou usar transações/rollback)
