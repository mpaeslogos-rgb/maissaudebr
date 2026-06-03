-- appointmentId agora é opcional em doctor_payments (exames sem consulta vinculada)
ALTER TABLE "doctor_payments" ALTER COLUMN "appointmentId" DROP NOT NULL;
