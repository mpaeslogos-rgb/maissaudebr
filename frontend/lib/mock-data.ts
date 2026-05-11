export type AppointmentStatus =
  | "confirmed"
  | "pending"
  | "in_progress"
  | "cancelled"
  | "no_show";

export interface Appointment {
  id: string;
  patientName: string;
  patientPhone: string;
  doctorName: string;
  specialty: string;
  start: Date;
  end: Date;
  status: AppointmentStatus;
  price: number;
  notes?: string;
}

const today = new Date();
const mkDate = (offset: number, hour: number, min = 0) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offset);
  d.setHours(hour, min, 0, 0);
  return d;
};

export const mockAppointments: Appointment[] = [
  { id: "1", patientName: "Ana Silva",     patientPhone: "(11) 99999-0001", doctorName: "Carlos Mendes", specialty: "Clínica Geral", start: mkDate(0, 10),    end: mkDate(0, 10, 30),  status: "confirmed",   price: 180 },
  { id: "2", patientName: "João Melo",     patientPhone: "(11) 99999-0002", doctorName: "Carlos Mendes", specialty: "Retorno",       start: mkDate(0, 11),    end: mkDate(0, 11, 30),  status: "confirmed",   price: 0 },
  { id: "3", patientName: "Maria Costa",   patientPhone: "(11) 99999-0003", doctorName: "Paula Souza",   specialty: "Cardiologia",   start: mkDate(0, 14),    end: mkDate(0, 15),      status: "pending",     price: 220, notes: "Primeira consulta. Paciente relata dor no peito." },
  { id: "4", patientName: "Pedro Alves",   patientPhone: "(11) 99999-0004", doctorName: "Carlos Mendes", specialty: "Clínica Geral", start: mkDate(0, 15, 30),end: mkDate(0, 16),      status: "in_progress", price: 180 },
  { id: "5", patientName: "Carla Lima",    patientPhone: "(11) 99999-0005", doctorName: "Carlos Mendes", specialty: "Clínica Geral", start: mkDate(1, 9),     end: mkDate(1, 9, 30),   status: "confirmed",   price: 180 },
  { id: "6", patientName: "Roberto Dias",  patientPhone: "(11) 99999-0006", doctorName: "Paula Souza",   specialty: "Cardiologia",   start: mkDate(2, 14),    end: mkDate(2, 15),      status: "confirmed",   price: 220 },
  { id: "7", patientName: "Júlia Santos",  patientPhone: "(11) 99999-0007", doctorName: "Carlos Mendes", specialty: "Clínica Geral", start: mkDate(-1, 10),   end: mkDate(-1, 10, 30), status: "no_show",     price: 180 },
  { id: "8", patientName: "Beatriz Costa", patientPhone: "(11) 99999-0008", doctorName: "Carlos Mendes", specialty: "Retorno",       start: mkDate(3, 11),    end: mkDate(3, 11, 30),  status: "confirmed",   price: 0 },
  { id: "9", patientName: "Fernando Lima", patientPhone: "(11) 99999-0009", doctorName: "Paula Souza",   specialty: "Cardiologia",   start: mkDate(4, 15),    end: mkDate(4, 16),      status: "pending",     price: 220 },
];