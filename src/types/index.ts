export type GroupStatus = 'DRAFT' | 'OPEN' | 'FULL' | 'CLOSED' | 'DRAW_READY' | 'DRAW_COMPLETED';

export type GroupType = 'WHATSAPP' | 'TELEGRAM';

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'REFUNDED' | 'CANCELLED';

export type PromotionLegalStatus = 'PENDING_REVIEW' | 'AUTHORIZED' | 'DISABLED';

export interface Group {
  groupId: string;
  name: string;
  description: string;
  capacity: number;
  confirmedParticipants: number;
  entryPriceCents: number;
  prizeAmountCents: number;
  adminFeeCents: number;
  groupType: GroupType;
  groupLink: string;
  status: GroupStatus;
  createdAt: string;
  closedAt: string | null;
  drawStatus: 'NONE' | 'PREPARED' | 'COMPLETED';
  drawId: string | null;
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
  number: string;
  sequenceNumber: number;
  name: string;
  cpf?: string;
  maskedCpf?: string;
  email?: string;
  phone?: string;
  createdAt: string;
  confirmedAt: string;
}

export interface Payment {
  paymentId: string;
  gatewayTransactionId: string;
  groupId: string;
  status: PaymentStatus;
  amountCents: number;
  gatewayFeeCents?: number;
  netAmountCents?: number;
  userName: string;
  userCpf?: string;
  userEmail?: string;
  userPhone?: string;
  pixQrCode?: string;
  pixCopiaECola?: string;
  createdAt: string;
  paidAt: string | null;
  participantId: string | null;
  assignedNumber: string | null;
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
  participantsListHash: string;
  closedAt: string;
  drawnAt: string;
  completedAt?: string;
  createdBy?: string;
  algorithmVersion?: string;
  randomnessSeed: string;
  randomnessMethod: string;
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
  type: string;
  timestamp: string;
  actor: string;
  groupId?: string;
  participantId?: string;
  paymentId?: string;
  metadata: Record<string, any>;
}

export interface SystemConfig {
  entryPriceCents: number;
  promotionLegalStatus: PromotionLegalStatus;
  legalProcessNumber: string;
  webhookSecret?: string;
  gatewayFeeFixedCents?: number;
  gatewayFeePercentage?: number;
  prizeAllocationPercentage?: number;
  reserveAllocationPercentage?: number;
  maxCapacityPerGroup?: number;
}

export interface DashboardMetrics {
  financials: {
    totalGrossCents: number;
    totalGatewayFeesCents: number;
    netCents: number;
    prizeFundCents: number;
    reserveFundCents: number;
    operationalNetCents: number;
    totalPrizeAllocatedCents?: number;
    totalAdminFeeBudgetedCents?: number;
  };
  counts: {
    totalGroups?: number;
    totalConfirmedParticipants: number;
    totalCapacity: number;
    occupancyRate: number;
    totalPaidPayments: number;
    totalPendingPayments: number;
    totalFailedPayments: number;
    openGroupsCount: number;
    fullGroupsCount: number;
    draftGroupsCount?: number;
    closedGroupsCount: number;
    totalDrawsExecuted: number;
  };
  groups: Group[];
  config: SystemConfig;
}

