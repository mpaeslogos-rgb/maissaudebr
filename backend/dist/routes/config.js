"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configRoutes = configRoutes;
const auth_1 = require("../plugins/auth");
const prisma2_1 = require("../lib/prisma2");
const DEFAULT_CONFIG = {
    key: 'clinic',
    clinicName: 'maissaudebr',
    whatsappNumber: '',
    attendanceHours: 'Segunda a sexta, das 08:00 às 18:00',
    specialties: '',
    telemedicinePlatform: 'Videochamada online',
    telemedicineLinkInfo: 'O link da consulta é enviado pelo WhatsApp antes do horário agendado.',
    telemedicineInstructions: 'O paciente deve estar em local tranquilo, com internet estável, câmera e microfone funcionando. Recomenda-se entrar alguns minutos antes da consulta.',
    linkSendTime: 'O link é enviado após confirmação do pagamento ou antes do horário da consulta, conforme regra da clínica.',
    defaultConsultationFee: '',
    pixKey: '',
    paymentLink: '',
    paymentMethods: 'PIX, cartão de crédito, cartão de débito ou transferência bancária.',
    paymentInstructions: 'A consulta será confirmada após a identificação do pagamento, conforme política da clínica.',
    confirmationPolicy: 'O agendamento fica sujeito à disponibilidade de horário e confirmação do pagamento.',
    cancellationPolicy: 'Para remarcar ou cancelar, o paciente deve entrar em contato com antecedência pelo WhatsApp da clínica.',
    welcomeMessage: 'Olá! Seja bem-vindo(a) à maissaudebr 😊 Sou a atendente virtual da clínica. Como posso ajudar?',
    confirmationMessage: 'Consulta confirmada ✅ Enviaremos as orientações e o link da teleconsulta pelo WhatsApp.',
    reminderMessage: 'Olá! Passando para lembrar da sua consulta online. Esteja em local tranquilo, com internet estável, alguns minutos antes do horário combinado.',
    paymentReminderMessage: 'Olá! Identificamos que o pagamento da consulta ainda está pendente. Para confirmar seu horário, siga as orientações de pagamento enviadas anteriormente.',
    humanTransferMessage: 'Vou encaminhar seu atendimento para nossa equipe, tudo bem? Um atendente dará continuidade assim que possível.',
    emergencyMessage: 'Sinto muito que você esteja passando por isso. Como pode ser uma situação de urgência ou emergência, procure imediatamente um pronto-socorro ou ligue para o SAMU 192. Este canal não substitui atendimento emergencial.',
    otherSettings: 'A IA deve atender pacientes pelo WhatsApp, auxiliar com agendamento de teleconsulta, explicar pagamentos e encaminhar para humano quando necessário. A IA não deve dar diagnóstico, prescrever medicamentos, interpretar exames ou substituir consulta médica.',
};
function normalizeConfigBody(body = {}) {
    return {
        clinicName: body.clinicName ?? '',
        whatsappNumber: body.whatsappNumber ?? '',
        attendanceHours: body.attendanceHours ?? '',
        specialties: body.specialties ?? '',
        telemedicinePlatform: body.telemedicinePlatform ?? '',
        telemedicineLinkInfo: body.telemedicineLinkInfo ?? '',
        telemedicineInstructions: body.telemedicineInstructions ?? '',
        linkSendTime: body.linkSendTime ?? '',
        defaultConsultationFee: body.defaultConsultationFee ?? '',
        pixKey: body.pixKey ?? '',
        paymentLink: body.paymentLink ?? '',
        paymentMethods: body.paymentMethods ?? '',
        paymentInstructions: body.paymentInstructions ?? '',
        confirmationPolicy: body.confirmationPolicy ?? '',
        cancellationPolicy: body.cancellationPolicy ?? '',
        welcomeMessage: body.welcomeMessage ?? '',
        confirmationMessage: body.confirmationMessage ?? '',
        reminderMessage: body.reminderMessage ?? '',
        paymentReminderMessage: body.paymentReminderMessage ?? '',
        humanTransferMessage: body.humanTransferMessage ?? '',
        emergencyMessage: body.emergencyMessage ?? '',
        otherSettings: body.otherSettings ?? '',
    };
}
function formatError(error) {
    return {
        message: error?.message ?? String(error),
        code: error?.code,
        meta: error?.meta,
        name: error?.name,
    };
}
async function configRoutes(app) {
    app.get('/api/config', { preHandler: (0, auth_1.requireRole)('ADMIN', 'DOCTOR', 'RECEPTIONIST') }, async (_request, reply) => {
        try {
            const config = await prisma2_1.prisma.config.upsert({
                where: {
                    key: 'clinic',
                },
                update: {},
                create: DEFAULT_CONFIG,
            });
            return reply.send({ data: config });
        }
        catch (error) {
            console.error('[GET CONFIG ERROR COMPLETO]', error);
            return reply.status(500).send({
                error: 'Falha ao carregar configurações.',
                details: formatError(error),
            });
        }
    });
    app.put('/api/config', { preHandler: (0, auth_1.requireRole)('ADMIN') }, async (request, reply) => {
        try {
            const body = normalizeConfigBody(request.body || {});
            const config = await prisma2_1.prisma.config.upsert({
                where: {
                    key: 'clinic',
                },
                update: body,
                create: {
                    key: 'clinic',
                    ...body,
                },
            });
            return reply.send({ data: config });
        }
        catch (error) {
            console.error('[PUT CONFIG ERROR COMPLETO]', error);
            return reply.status(500).send({
                error: 'Falha ao salvar configurações.',
                details: formatError(error),
            });
        }
    });
}
