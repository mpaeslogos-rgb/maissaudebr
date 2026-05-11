export interface ChatConversation {
  id: string;
  patientName: string;
  patientPhone: string;
  lastMessage: string;
  lastMessageAt: Date;
  unread: number;
  status: "bot" | "waiting" | "human" | "closed";
  assignedTo?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  sender: "patient" | "bot" | "agent";
  agentName?: string;
  content: string;
  timestamp: Date;
  type: "text" | "system";
}

const mkTime = (minAgo: number) => new Date(Date.now() - minAgo * 60000);

export const mockConversations: ChatConversation[] = [
  { id: "1", patientName: "Ana Silva",       patientPhone: "(11) 99999-0001", lastMessage: "Quero falar com alguém",       lastMessageAt: mkTime(2),   unread: 3, status: "waiting" },
  { id: "2", patientName: "Pedro Alves",     patientPhone: "(11) 99999-0002", lastMessage: "Não consegui pagar o boleto",  lastMessageAt: mkTime(5),   unread: 1, status: "waiting" },
  { id: "3", patientName: "Maria Fernanda",  patientPhone: "(11) 99999-0003", lastMessage: "Preciso remarcar urgente",     lastMessageAt: mkTime(12),  unread: 2, status: "waiting" },
  { id: "4", patientName: "Carlos Moreira",  patientPhone: "(11) 99999-0004", lastMessage: "Obrigado pela ajuda!",         lastMessageAt: mkTime(8),   unread: 0, status: "human", assignedTo: "Ana" },
  { id: "5", patientName: "Juliana Ribeiro", patientPhone: "(11) 99999-0005", lastMessage: "Tudo certo, obrigada!",        lastMessageAt: mkTime(15),  unread: 0, status: "human", assignedTo: "Ana" },
  { id: "6", patientName: "Ricardo Souza",   patientPhone: "(11) 99999-0006", lastMessage: "Quero agendar uma consulta",   lastMessageAt: mkTime(1),   unread: 0, status: "bot" },
  { id: "7", patientName: "Beatriz Costa",   patientPhone: "(11) 99999-0007", lastMessage: "Para quando posso marcar?",    lastMessageAt: mkTime(3),   unread: 0, status: "bot" },
  { id: "8", patientName: "Fernando Lima",   patientPhone: "(11) 99999-0008", lastMessage: "Consulta finalizada",          lastMessageAt: mkTime(120), unread: 0, status: "closed" },
];

export const mockMessages: ChatMessage[] = [
  { id: "m1", conversationId: "1", sender: "patient", content: "Oi, boa tarde", timestamp: mkTime(15), type: "text" },
  { id: "m2", conversationId: "1", sender: "bot",     content: "Olá, Ana! 👋 Bem-vinda à +SaúdeBR. Como posso te ajudar hoje?", timestamp: mkTime(14), type: "text" },
  { id: "m3", conversationId: "1", sender: "patient", content: "Quero remarcar minha consulta de amanhã", timestamp: mkTime(12), type: "text" },
  { id: "m4", conversationId: "1", sender: "bot",     content: "Claro! Sua consulta atual é:\n📅 29/04/2025 às 14h00\n🩺 Dr. Carlos Mendes – Cardiologia\n\nPara qual data deseja remarcar?", timestamp: mkTime(11), type: "text" },
  { id: "m5", conversationId: "1", sender: "patient", content: "Não consegui entender direito o sistema", timestamp: mkTime(8), type: "text" },
  { id: "m6", conversationId: "1", sender: "patient", content: "Quero falar com alguém", timestamp: mkTime(2), type: "text" },
  { id: "m7", conversationId: "1", sender: "bot",     content: "Entendi! Estou transferindo seu atendimento para nossa equipe. Aguarde um momento. 🙏", timestamp: mkTime(2), type: "text" },
  { id: "m8", conversationId: "1", sender: "agent",   content: "🚨 Conversa transferida para atendente humano", timestamp: mkTime(2), type: "system" },
  { id: "m9", conversationId: "2", sender: "patient", content: "O boleto não está abrindo aqui", timestamp: mkTime(7), type: "text" },
  { id: "m10", conversationId: "2", sender: "bot",    content: "Sinto muito pelo inconveniente! Vou gerar um novo link de pagamento PIX para você.", timestamp: mkTime(6), type: "text" },
  { id: "m11", conversationId: "2", sender: "patient", content: "Não consegui pagar o boleto", timestamp: mkTime(5), type: "text" },
];