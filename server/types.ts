export type GroupStatus = 'DRAFT' | 'OPEN' | 'FULL' | 'CLOSED' | 'DRAW_READY' | 'DRAW_COMPLETED';

export type GroupType = 'WHATSAPP' | 'TELEGRAM';

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'REFUNDED' | 'CANCELLED';

export type PromotionLegalStatus = 'PENDING_REVIEW' | 'AUTHORIZED' | 'DISABLED';

export type ParticipationModel = 'FIXED_NUMBER' | 'CONTRIBUTION_WEIGHT';

export interface Group {
  groupId: string; // e.g. 'G-01', 'sorteio-especial-1'
  name: string;
  description: string;
  capacity: number; // e.g. 10000
  confirmedParticipants: number;
  entryPriceCents: number; // e.g. 100 = R$ 1,00
  prizeAmountCents: number; // e.g. 700000 = R$ 7.000,00
  adminFeeCents: number; // e.g. 300000 = R$ 3.000,00
  groupType: GroupType; // 'WHATSAPP' | 'TELEGRAM'
  groupLink: string; // e.g. 'https://chat.whatsapp.com/...' ou 'https://t.me/...'
  status: GroupStatus;
  createdAt: string;
  closedAt: string | null;
  drawStatus: 'NONE' | 'PREPARED' | 'COMPLETED';
  drawId: string | null;
  participationModel?: ParticipationModel;
  sharePriceCents?: number;
}

export interface CreateGroupInput {
  groupId?: string;
  name: string;
  description?: string;
  capacity: number;
  entryPriceCents: number;
  prizeAmountCents: number;
  adminFeeCents: number;
  groupType: GroupType;
  groupLink: string;
  status?: GroupStatus;
}

export interface UpdateGroupInput {
  name?: string;
  description?: string;
  capacity?: number;
  entryPriceCents?: number;
  prizeAmountCents?: number;
  adminFeeCents?: number;
  groupType?: GroupType;
  groupLink?: string;
  status?: GroupStatus;
}

export interface Participant {
  participantId: string;
  groupId: string;
  paymentId: string;
  number: string; // e.g. "00001", "08421" (ou ID sequencial interno)
  sequenceNumber: number; // 1, 2, ...
  name: string;
  cpf: string; // Mascarado em visualizações públicas
  email: string;
  phone: string;
  createdAt: string;
  confirmedAt: string;
  // Preparação para modelo sem rifa / cotas ponderadas
  sharesCount?: number; // Quantidade de participações adquiridas
  weight?: number; // Peso para sorteio ponderado
  keywordUsed?: string; // Palavra-chave especial utilizada
  bonusShares?: number; // Participações extras de bônus
  totalShares?: number; // Total acumulado de participações
  entryValueCents?: number; // Valor total financeiro contribuído
}

export interface Payment {
  paymentId: string;
  gatewayTransactionId: string;
  syncpayIdentifier?: string;
  groupId: string;
  status: PaymentStatus;
  amountCents: number; // em centavos (ex: 100 = R$ 1,00)
  gatewayFeeCents: number; // taxas estimadas em centavos (ex: 10 = R$ 0,10)
  netAmountCents: number; // amount - fee
  userName: string;
  userCpf: string;
  userEmail: string;
  userPhone: string;
  pixQrCode: string;
  pixCopiaECola: string;
  createdAt: string;
  paidAt: string | null;
  participantId: string | null;
  assignedNumber: string | null;
  sharesCount?: number;
  keywordUsed?: string;
  webhookProcessed: boolean;
  rawEventId: string | null;
  expiresAt: string;
}

export interface DrawAuditRecord {
  drawId: string;
  groupId: string;
  groupName?: string;
  prizeAmountCents?: number;
  status?: 'COMPLETED';
  participantsCount: number;
  eligibleParticipants?: number;
  participantsListHash: string; // SHA-256 da lista canônica
  closedAt: string;
  drawnAt: string;
  completedAt?: string;
  createdBy?: string;
  algorithmVersion?: string;
  randomnessSeed: string; // Semente combinada
  randomnessMethod: string; // ex: 'SHA256_HMAC_DETERMINISTIC_CSPRNG'
  winningNumber: string;
  winningParticipantId: string;
  winnerName: string;
  winnerPhone?: string;
  winnerPhoneMasked?: string;
  winnerMaskedCpf: string;
  resultHash?: string;
  isImmutable: boolean;
  publicVerificationCode: string;
}

export interface AuditLog {
  eventId: string;
  type:
    | 'PAYMENT_CREATED'
    | 'PAYMENT_PAID'
    | 'PAYMENT_FAILED'
    | 'PAYMENT_EXPIRED'
    | 'PARTICIPANT_CREATED'
    | 'GROUP_FULL'
    | 'GROUP_CLOSED'
    | 'DRAW_PREPARED'
    | 'DRAW_EXECUTED'
    | 'RESULT_PUBLISHED'
    | 'LEGAL_STATUS_CHANGED'
    | 'SECURITY_ALERT';
  timestamp: string;
  actor: string; // 'SYSTEM' | 'GATEWAY_WEBHOOK' | 'ADMIN' | 'USER'
  groupId?: string;
  participantId?: string;
  paymentId?: string;
  metadata: Record<string, unknown>;
}

export interface SystemConfig {
  entryPriceCents: number; // e.g. 100 = R$ 1,00
  promotionLegalStatus: PromotionLegalStatus;
  legalProcessNumber: string; // e.g. "SPA/ME nº 01.000000/2026-00"
  webhookSecret: string;
  gatewayFeeFixedCents: number; // ex: 25 centavos
  gatewayFeePercentage: number; // ex: 0.99%
  prizeAllocationPercentage: number; // ex: 70%
  reserveAllocationPercentage: number; // ex: 10%
  maxCapacityPerGroup: number;
}
