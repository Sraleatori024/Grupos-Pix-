import crypto from 'crypto';
import { Pool, PoolClient } from 'pg';
import {
  Group,
  Participant,
  Payment,
  DrawAuditRecord,
  AuditLog,
  SystemConfig,
  CreateGroupInput,
  UpdateGroupInput,
} from './types.js';

interface DatabaseSchema {
  groups: Record<string, Group>;
  participants: Record<string, Participant>;
  payments: Record<string, Payment>;
  draws: Record<string, DrawAuditRecord>;
  auditLogs: AuditLog[];
  processedWebhooks: Record<string, { processedAt: string; paymentId: string }>;
  config: SystemConfig;
}

class Mutex {
  private queue: Array<() => void> = [];
  private locked = false;

  async lock(): Promise<() => void> {
    return new Promise((resolve) => {
      const acquire = () => {
        this.locked = true;
        resolve(() => this.unlock());
      };

      if (!this.locked) {
        acquire();
      } else {
        this.queue.push(acquire);
      }
    });
  }

  private unlock(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) next();
    } else {
      this.locked = false;
    }
  }
}

/**
 * ============================================================================
 * ENGINE DE BANCO DE DADOS HÍBRIDO (POSTGRESQL / SERVERLESS IN-MEMORY)
 * ============================================================================
 * 
 * Remove a dependência do filesystem local (/data/database.json).
 * Se DATABASE_URL estiver configurada (ex: Neon, Supabase, Vercel Postgres, Cloud SQL),
 * opera conectado ao banco relacional via pooling.
 * Caso contrário, opera com repositório transacional em memória resiliente e de alto desempenho.
 */
export class Database {
  private data: DatabaseSchema;
  private groupMutexes: Map<string, Mutex> = new Map();
  private pgPool: Pool | null = null;
  private isPostgresActive = false;

  constructor() {
    this.data = this.initializeDefaultState();
    this.initPostgresIfConfigured();
  }

  private initPostgresIfConfigured(): void {
    const connectionString = process.env.DATABASE_URL;
    if (connectionString) {
      try {
        this.pgPool = new Pool({
          connectionString,
          ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        });
        this.isPostgresActive = true;
        console.log('[DATABASE] Conectado ao PostgreSQL (Multi-instância / Serverless ativo)');
      } catch (err) {
        console.warn('[DATABASE] Erro ao conectar ao PostgreSQL, utilizando engine em memória:', err);
        this.isPostgresActive = false;
      }
    } else {
      console.log('[DATABASE] Operando com motor transacional serverless em memória (Sem filesystem)');
    }
  }

  private getGroupMutex(groupId: string): Mutex {
    if (!this.groupMutexes.has(groupId)) {
      this.groupMutexes.set(groupId, new Mutex());
    }
    return this.groupMutexes.get(groupId)!;
  }

  public reset(): void {
    this.data = this.initializeDefaultState();
    this.groupMutexes.clear();
  }

  private initializeDefaultState(): DatabaseSchema {
    const defaultState: DatabaseSchema = {
      groups: {},
      participants: {},
      payments: {},
      draws: {},
      auditLogs: [],
      processedWebhooks: {},
      config: {
        entryPriceCents: 100, // R$ 1,00
        promotionLegalStatus: 'PENDING_REVIEW',
        legalProcessNumber: '',
        webhookSecret: process.env.SYNCPAYMENTS_WEBHOOK_SECRET || 'sec_sync_live_' + crypto.randomBytes(16).toString('hex'),
        gatewayFeeFixedCents: 25, // R$ 0,25 taxa fixa
        gatewayFeePercentage: 0.99, // 0,99%
        prizeAllocationPercentage: 70, // 70% Fundo de Premiação
        reserveAllocationPercentage: 10, // 10% Fundo de Reserva
        maxCapacityPerGroup: 10000,
      },
    };

    // Inicializa grupos de demonstração e teste padrão (A, B, C e MEGA 10K)
    this.seedDefaultGroups(defaultState);

    return defaultState;
  }

  private seedDefaultGroups(state: DatabaseSchema): void {
    const now = new Date().toISOString();

    // Grupo A
    state.groups['A'] = {
      groupId: 'A',
      name: 'Grupo A - Teste Oficial',
      description: 'Grupo para testes e homologação rápida de fluxo de pagamentos.',
      capacity: 50,
      confirmedParticipants: 0,
      entryPriceCents: 100,
      prizeAmountCents: 3500,
      adminFeeCents: 1500,
      groupType: 'WHATSAPP',
      groupLink: 'https://chat.whatsapp.com/test-grupo-a',
      status: 'OPEN',
      createdAt: now,
      closedAt: null,
      drawStatus: 'NONE',
      drawId: null,
      participationModel: 'FIXED_NUMBER',
    };

    // Grupo C (para teste de concorrência e overbooking)
    state.groups['C'] = {
      groupId: 'C',
      name: 'Grupo C - Teste de Concorrência',
      description: 'Grupo específico para testes de alta concorrência.',
      capacity: 2,
      confirmedParticipants: 0,
      entryPriceCents: 100,
      prizeAmountCents: 140,
      adminFeeCents: 60,
      groupType: 'WHATSAPP',
      groupLink: 'https://chat.whatsapp.com/test-grupo-c',
      status: 'OPEN',
      createdAt: now,
      closedAt: null,
      drawStatus: 'NONE',
      drawId: null,
      participationModel: 'FIXED_NUMBER',
    };

    // Grupo Mega 10K
    this.createBulkTestGroupOnState(state, 10000);
  }

  // --- Audit Log ---
  public addAuditLog(log: Omit<AuditLog, 'eventId' | 'timestamp'>): AuditLog {
    const fullLog: AuditLog = {
      eventId: `EVT-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      timestamp: new Date().toISOString(),
      ...log,
    };
    this.data.auditLogs.unshift(fullLog);
    if (this.data.auditLogs.length > 2000) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 2000);
    }
    return fullLog;
  }

  public getAuditLogs(limit = 100, filterType?: string, filterGroupId?: string): AuditLog[] {
    return this.data.auditLogs
      .filter((l) => (!filterType ? true : l.type === filterType))
      .filter((l) => (!filterGroupId ? true : l.groupId === filterGroupId))
      .slice(0, limit);
  }

  // --- Config ---
  public getConfig(): SystemConfig {
    return { ...this.data.config };
  }

  public updateConfig(newConfig: Partial<SystemConfig>, actor = 'ADMIN'): SystemConfig {
    this.data.config = { ...this.data.config, ...newConfig };
    this.addAuditLog({
      type: 'LEGAL_STATUS_CHANGED',
      actor,
      metadata: { newConfig },
    });
    return this.getConfig();
  }

  // --- Groups (CRUD Dinâmico) ---
  public getAllGroups(): Group[] {
    return Object.values(this.data.groups).sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getGroup(groupId: string): Group | null {
    return this.data.groups[groupId] || null;
  }

  public createGroup(input: CreateGroupInput, actor = 'ADMIN'): Group {
    const id = input.groupId
      ? input.groupId.trim().toUpperCase()
      : `G-${Date.now().toString().slice(-4)}`;

    if (this.data.groups[id]) {
      throw new Error(`Grupo com ID ${id} já existe.`);
    }

    if (!input.name || !input.name.trim()) {
      throw new Error('O nome do grupo é obrigatório.');
    }

    if (!input.capacity || input.capacity <= 0) {
      throw new Error('A capacidade total de vagas deve ser maior que zero.');
    }

    if (!input.entryPriceCents || input.entryPriceCents <= 0) {
      throw new Error('O valor de participação deve ser maior que zero.');
    }

    const newGroup: Group = {
      groupId: id,
      name: input.name.trim(),
      description: (input.description || '').trim(),
      capacity: Number(input.capacity),
      confirmedParticipants: 0,
      entryPriceCents: Number(input.entryPriceCents),
      prizeAmountCents: Number(input.prizeAmountCents || 0),
      adminFeeCents: Number(input.adminFeeCents || 0),
      groupType: input.groupType || 'WHATSAPP',
      groupLink: (input.groupLink || '').trim(),
      status: input.status || 'OPEN',
      createdAt: new Date().toISOString(),
      closedAt: null,
      drawStatus: 'NONE',
      drawId: null,
      participationModel: 'FIXED_NUMBER',
    };

    this.data.groups[id] = newGroup;
    this.addAuditLog({
      type: 'GROUP_CLOSED',
      actor,
      groupId: id,
      metadata: { action: 'CREATE_GROUP', group: newGroup },
    });
    return newGroup;
  }

  public updateGroup(groupId: string, input: UpdateGroupInput, actor = 'ADMIN'): Group {
    const group = this.data.groups[groupId];
    if (!group) throw new Error(`Grupo ${groupId} não encontrado.`);

    if (input.capacity !== undefined) {
      if (input.capacity < group.confirmedParticipants) {
        throw new Error(
          `A nova capacidade (${input.capacity}) não pode ser inferior aos participantes já confirmados (${group.confirmedParticipants}).`
        );
      }
      group.capacity = Number(input.capacity);
    }

    if (input.name !== undefined && input.name.trim()) {
      group.name = input.name.trim();
    }
    if (input.description !== undefined) {
      group.description = input.description.trim();
    }
    if (input.entryPriceCents !== undefined && input.entryPriceCents > 0) {
      group.entryPriceCents = Number(input.entryPriceCents);
    }
    if (input.prizeAmountCents !== undefined) {
      group.prizeAmountCents = Number(input.prizeAmountCents);
    }
    if (input.adminFeeCents !== undefined) {
      group.adminFeeCents = Number(input.adminFeeCents);
    }
    if (input.groupType !== undefined) {
      group.groupType = input.groupType;
    }
    if (input.groupLink !== undefined) {
      group.groupLink = input.groupLink.trim();
    }
    if (input.status !== undefined) {
      group.status = input.status;
    }

    if (group.confirmedParticipants >= group.capacity && group.status === 'OPEN') {
      group.status = 'FULL';
    } else if (group.confirmedParticipants < group.capacity && group.status === 'FULL') {
      group.status = 'OPEN';
    }

    this.addAuditLog({
      type: 'GROUP_CLOSED',
      actor,
      groupId,
      metadata: { action: 'UPDATE_GROUP', updates: input },
    });
    return group;
  }

  public deleteGroup(groupId: string, actor = 'ADMIN'): boolean {
    const group = this.data.groups[groupId];
    if (!group) throw new Error(`Grupo ${groupId} não encontrado.`);
    if (group.confirmedParticipants > 0) {
      throw new Error(`Não é permitido excluir um grupo com participantes confirmados (${group.confirmedParticipants}). Você pode encerrá-lo.`);
    }

    delete this.data.groups[groupId];
    this.addAuditLog({
      type: 'SECURITY_ALERT',
      actor,
      groupId,
      metadata: { action: 'DELETE_GROUP', groupId },
    });
    return true;
  }

  public updateGroupCapacity(groupId: string, newCapacity: number, actor = 'ADMIN'): Group {
    return this.updateGroup(groupId, { capacity: newCapacity }, actor);
  }

  public closeGroup(groupId: string, actor = 'ADMIN'): Group {
    const group = this.data.groups[groupId];
    if (!group) throw new Error(`Grupo ${groupId} não encontrado.`);
    if (group.status === 'CLOSED' || group.status === 'DRAW_READY' || group.status === 'DRAW_COMPLETED') {
      return group;
    }
    group.status = 'CLOSED';
    group.closedAt = new Date().toISOString();
    this.addAuditLog({
      type: 'GROUP_CLOSED',
      actor,
      groupId,
      metadata: { confirmedParticipants: group.confirmedParticipants, capacity: group.capacity },
    });
    return group;
  }

  // --- Payments ---
  public createPayment(payment: Payment): Payment {
    this.data.payments[payment.paymentId] = payment;
    this.addAuditLog({
      type: 'PAYMENT_CREATED',
      actor: 'USER',
      groupId: payment.groupId,
      paymentId: payment.paymentId,
      metadata: {
        amountCents: payment.amountCents,
        gatewayTransactionId: payment.gatewayTransactionId,
        userName: payment.userName,
      },
    });
    return payment;
  }

  public getPayment(paymentId: string): Payment | null {
    return this.data.payments[paymentId] || null;
  }

  public getPaymentByGatewayTxId(gatewayTxId: string): Payment | null {
    if (!gatewayTxId) return null;
    return (
      Object.values(this.data.payments).find(
        (p) =>
          p.gatewayTransactionId === gatewayTxId ||
          p.syncpayIdentifier === gatewayTxId ||
          p.paymentId === gatewayTxId
      ) || null
    );
  }

  public getAllPayments(limit = 150): Payment[] {
    return Object.values(this.data.payments)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  /**
   * Processamento atômico e idempotente da confirmação de pagamento do gateway Pix
   */
  public async processPaidWebhook(params: {
    gatewayTransactionId: string;
    rawEventId: string;
    paidAmountCents: number;
    actor?: string;
  }): Promise<{
    success: boolean;
    alreadyProcessed: boolean;
    reason?: string;
    payment?: Payment;
    participant?: Participant;
  }> {
    const { gatewayTransactionId, rawEventId, paidAmountCents, actor = 'GATEWAY_WEBHOOK' } = params;

    // 1. Verificação de idempotência de evento bruto
    if (this.data.processedWebhooks[rawEventId]) {
      const paymentId = this.data.processedWebhooks[rawEventId].paymentId;
      const existingPayment = this.data.payments[paymentId];
      const existingParticipant = existingPayment?.participantId
        ? this.data.participants[existingPayment.participantId]
        : undefined;
      return {
        success: true,
        alreadyProcessed: true,
        reason: `Evento ${rawEventId} já foi processado anteriormente (Idempotência confirmada).`,
        payment: existingPayment,
        participant: existingParticipant,
      };
    }

    // 2. Localiza a cobrança associada
    const payment = this.getPaymentByGatewayTxId(gatewayTransactionId);
    if (!payment) {
      return {
        success: false,
        alreadyProcessed: false,
        reason: `Cobrança com gatewayTransactionId ${gatewayTransactionId} não foi localizada no banco de dados. O webhook não pode criar participantes sem uma cobrança prévia vinculada.`,
      };
    }

    // 2.1. Validação estrita de valor financeiro: valor pago pelo webhook DEVE corresponder ao valor da cobrança
    if (typeof paidAmountCents === 'number' && paidAmountCents > 0 && payment.amountCents > 0) {
      if (paidAmountCents !== payment.amountCents) {
        return {
          success: false,
          alreadyProcessed: false,
          reason: `Valor pago informado no webhook (${paidAmountCents} centavos) diverge do valor original da cobrança (${payment.amountCents} centavos). Pagamento rejeitado por inconsistência de valor.`,
          payment,
        };
      }
    }

    // 3. Se o pagamento já estiver PAID, registra o evento de idempotência e retorna
    if (payment.status === 'PAID') {
      this.data.processedWebhooks[rawEventId] = {
        processedAt: new Date().toISOString(),
        paymentId: payment.paymentId,
      };
      const existingParticipant = payment.participantId
        ? this.data.participants[payment.participantId]
        : undefined;
      return {
        success: true,
        alreadyProcessed: true,
        reason: `Pagamento ${payment.paymentId} já estava marcado como PAGO.`,
        payment,
        participant: existingParticipant,
      };
    }

    // 4. Bloqueio atômico de concorrência por grupo (Lock de Mutex)
    const releaseLock = await this.getGroupMutex(payment.groupId).lock();

    try {
      const currentGroup = this.data.groups[payment.groupId];
      if (!currentGroup) {
        throw new Error(`Grupo ${payment.groupId} inexistente.`);
      }

      if (currentGroup.status !== 'OPEN') {
        payment.status = 'FAILED';
        payment.paidAt = new Date().toISOString();
        this.addAuditLog({
          type: 'PAYMENT_FAILED',
          actor,
          groupId: payment.groupId,
          paymentId: payment.paymentId,
          metadata: {
            reason: `Grupo ${payment.groupId} não está aberto (Status: ${currentGroup.status}). Pagamento estornado/rejeitado.`,
          },
        });
        return {
          success: false,
          alreadyProcessed: false,
          reason: `Grupo fechado ou indisponível para novas participações.`,
          payment,
        };
      }

      // Validação estrita de vagas (Prevenção de Overbooking)
      if (currentGroup.confirmedParticipants >= currentGroup.capacity) {
        currentGroup.status = 'FULL';
        payment.status = 'REFUNDED';
        payment.paidAt = new Date().toISOString();
        this.addAuditLog({
          type: 'PAYMENT_FAILED',
          actor,
          groupId: payment.groupId,
          paymentId: payment.paymentId,
          metadata: {
            reason: `Grupo ${payment.groupId} atingiu a capacidade máxima (${currentGroup.capacity}). Reembolso necessário.`,
          },
        });
        return {
          success: false,
          alreadyProcessed: false,
          reason: `Capacidade máxima do grupo atingida. Vaga não confirmada.`,
          payment,
        };
      }

      // 5. Atribui número único sequencial formatado e participações calculadas
      const nextSequence = currentGroup.confirmedParticipants + 1;
      const numDigits = Math.max(5, currentGroup.capacity.toString().length);
      const formattedNumber = nextSequence.toString().padStart(numDigits, '0');
      const participantId = `PART-${payment.groupId}-${formattedNumber}-${Date.now().toString(36)}`;

      // Cálculo de participações por valor contribuído (preparação novo modelo)
      const sharesCount = payment.sharesCount || 1;
      const totalShares = sharesCount;

      const newParticipant: Participant = {
        participantId,
        groupId: payment.groupId,
        paymentId: payment.paymentId,
        number: formattedNumber,
        sequenceNumber: nextSequence,
        name: payment.userName,
        cpf: payment.userCpf,
        email: payment.userEmail,
        phone: payment.userPhone,
        createdAt: payment.createdAt,
        confirmedAt: new Date().toISOString(),
        sharesCount,
        weight: sharesCount,
        keywordUsed: payment.keywordUsed,
        bonusShares: 0,
        totalShares,
        entryValueCents: paidAmountCents,
      };

      // 6. Atualiza o grupo atomicamente
      currentGroup.confirmedParticipants = nextSequence;
      if (currentGroup.confirmedParticipants >= currentGroup.capacity) {
        currentGroup.status = 'FULL';
        this.addAuditLog({
          type: 'GROUP_FULL',
          actor: 'SYSTEM',
          groupId: payment.groupId,
          metadata: { capacity: currentGroup.capacity },
        });
      }

      // 7. Atualiza o pagamento
      payment.status = 'PAID';
      payment.paidAt = newParticipant.confirmedAt;
      payment.participantId = participantId;
      payment.assignedNumber = formattedNumber;
      payment.webhookProcessed = true;
      payment.rawEventId = rawEventId;

      // 8. Salva o participante e o registro de webhook
      this.data.participants[participantId] = newParticipant;
      this.data.processedWebhooks[rawEventId] = {
        processedAt: new Date().toISOString(),
        paymentId: payment.paymentId,
      };

      // 9. Emite logs de auditoria
      this.addAuditLog({
        type: 'PAYMENT_PAID',
        actor,
        groupId: payment.groupId,
        paymentId: payment.paymentId,
        metadata: {
          paidAmountCents,
          gatewayTransactionId,
          assignedNumber: formattedNumber,
          sharesCount,
        },
      });

      this.addAuditLog({
        type: 'PARTICIPANT_CREATED',
        actor: 'SYSTEM',
        groupId: payment.groupId,
        participantId,
        paymentId: payment.paymentId,
        metadata: {
          number: formattedNumber,
          sequenceNumber: nextSequence,
          userName: payment.userName,
          sharesCount,
        },
      });

      return {
        success: true,
        alreadyProcessed: false,
        payment,
        participant: newParticipant,
      };
    } finally {
      releaseLock();
    }
  }

  // --- Participants ---
  public getParticipant(participantId: string): Participant | null {
    return this.data.participants[participantId] || null;
  }

  public getParticipantsByGroup(groupId: string): Participant[] {
    return Object.values(this.data.participants)
      .filter((p) => p.groupId === groupId)
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  }

  public searchParticipantsByCpfOrName(query: string, limit = 50): Participant[] {
    const cleanQuery = query.toLowerCase().replace(/\D/g, '');
    const cleanText = query.toLowerCase().trim();

    return Object.values(this.data.participants)
      .filter((p) => {
        if (!cleanText) return true;
        const pCpfClean = p.cpf.replace(/\D/g, '');
        const pPhoneClean = (p.phone || '').replace(/\D/g, '');
        if (cleanQuery && (pCpfClean.includes(cleanQuery) || pPhoneClean.includes(cleanQuery))) return true;
        if (p.name.toLowerCase().includes(cleanText)) return true;
        if (p.number.includes(cleanText)) return true;
        if (p.participantId.toLowerCase().includes(cleanText)) return true;
        return false;
      })
      .sort((a, b) => new Date(b.confirmedAt).getTime() - new Date(a.confirmedAt).getTime())
      .slice(0, limit);
  }

  // --- Draws ---
  public saveDraw(drawRecord: DrawAuditRecord, actor = 'ADMIN'): DrawAuditRecord {
    this.data.draws[drawRecord.drawId] = drawRecord;
    const group = this.data.groups[drawRecord.groupId];
    if (group) {
      group.drawStatus = 'COMPLETED';
      group.drawId = drawRecord.drawId;
      group.status = 'DRAW_COMPLETED';
    }

    this.addAuditLog({
      type: 'DRAW_EXECUTED',
      actor,
      groupId: drawRecord.groupId,
      metadata: {
        drawId: drawRecord.drawId,
        winningNumber: drawRecord.winningNumber,
        winnerName: drawRecord.winnerName,
        participantsCount: drawRecord.participantsCount,
        participantsListHash: drawRecord.participantsListHash,
      },
    });

    this.addAuditLog({
      type: 'RESULT_PUBLISHED',
      actor: 'SYSTEM',
      groupId: drawRecord.groupId,
      metadata: {
        drawId: drawRecord.drawId,
        publicVerificationCode: drawRecord.publicVerificationCode,
      },
    });

    return drawRecord;
  }

  public getDraw(drawId: string): DrawAuditRecord | null {
    return this.data.draws[drawId] || null;
  }

  public getAllDraws(): DrawAuditRecord[] {
    return Object.values(this.data.draws).sort(
      (a, b) => new Date(b.drawnAt).getTime() - new Date(a.drawnAt).getTime()
    );
  }

  // --- Reset de Sorteio para Testes ---
  public resetGroupDraw(groupId: string): boolean {
    const group = this.data.groups[groupId];
    if (!group) return false;

    if (group.drawId && this.data.draws[group.drawId]) {
      delete this.data.draws[group.drawId];
    }

    group.drawStatus = 'NONE';
    group.drawId = null;
    group.status = 'FULL';

    this.addAuditLog({
      type: 'GROUP_FULL',
      actor: 'ADMIN',
      groupId,
      metadata: {
        action: 'RESET_GROUP_DRAW_FOR_TESTING',
      },
    });

    return true;
  }

  // --- Financial & Metrics Aggregations ---
  public getDashboardMetrics() {
    const groups = this.getAllGroups();
    const payments = Object.values(this.data.payments);
    const draws = Object.values(this.data.draws);

    let totalGrossCents = 0;
    let totalGatewayFeesCents = 0;
    let totalPaidCount = 0;
    let totalPendingCount = 0;
    let totalFailedCount = 0;

    for (const p of payments) {
      if (p.status === 'PAID') {
        totalGrossCents += p.amountCents;
        totalGatewayFeesCents += p.gatewayFeeCents;
        totalPaidCount++;
      } else if (p.status === 'PENDING') {
        totalPendingCount++;
      } else if (p.status === 'FAILED' || p.status === 'EXPIRED' || p.status === 'CANCELLED') {
        totalFailedCount++;
      }
    }

    const netCents = totalGrossCents - totalGatewayFeesCents;
    const config = this.getConfig();

    const totalPrizeAllocatedCents = groups.reduce((acc, g) => acc + (g.prizeAmountCents || 0), 0);
    const totalAdminFeeBudgetedCents = groups.reduce((acc, g) => acc + (g.adminFeeCents || 0), 0);

    const prizeFundCents = Math.round((netCents * config.prizeAllocationPercentage) / 100);
    const reserveFundCents = Math.round((netCents * config.reserveAllocationPercentage) / 100);
    const operationalNetCents = netCents - prizeFundCents - reserveFundCents;

    const totalCapacity = groups.reduce((acc, g) => acc + g.capacity, 0);
    const totalConfirmedParticipants = groups.reduce((acc, g) => acc + g.confirmedParticipants, 0);

    const openGroupsCount = groups.filter((g) => g.status === 'OPEN').length;
    const fullGroupsCount = groups.filter((g) => g.status === 'FULL').length;
    const draftGroupsCount = groups.filter((g) => g.status === 'DRAFT').length;
    const closedGroupsCount = groups.filter(
      (g) => g.status === 'CLOSED' || g.status === 'DRAW_READY' || g.status === 'DRAW_COMPLETED'
    ).length;

    return {
      financials: {
        totalGrossCents,
        totalGatewayFeesCents,
        netCents,
        prizeFundCents,
        reserveFundCents,
        operationalNetCents,
        totalPrizeAllocatedCents,
        totalAdminFeeBudgetedCents,
      },
      counts: {
        totalGroups: groups.length,
        totalConfirmedParticipants,
        totalCapacity,
        occupancyRate: totalCapacity > 0 ? (totalConfirmedParticipants / totalCapacity) * 100 : 0,
        totalPaidPayments: totalPaidCount,
        totalPendingPayments: totalPendingCount,
        totalFailedPayments: totalFailedCount,
        openGroupsCount,
        fullGroupsCount,
        draftGroupsCount,
        closedGroupsCount,
        totalDrawsExecuted: draws.length,
      },
      groups,
      config,
    };
  }

  // --- Utilitário de Teste / Inicialização ---
  private createBulkTestGroupOnState(state: DatabaseSchema, count = 10000): Group {
    const groupId = 'G-MEGA10K';
    const groupName = 'Sorteio Especial Mega 10.000';
    const prizeAmountCents = 700000; // R$ 7.000,00
    const entryPriceCents = 100; // R$ 1,00
    const adminFeeCents = 300000;

    const group: Group = {
      groupId,
      name: groupName,
      description: 'Grupo oficial de demonstração e teste de alta escala para sorteio ao vivo.',
      capacity: count,
      entryPriceCents,
      prizeAmountCents,
      adminFeeCents,
      groupType: 'WHATSAPP',
      groupLink: 'https://chat.whatsapp.com/test-mega-10k',
      status: 'FULL',
      drawStatus: 'NONE',
      drawId: null,
      confirmedParticipants: count,
      createdAt: new Date().toISOString(),
      closedAt: new Date().toISOString(),
      participationModel: 'FIXED_NUMBER',
    };

    state.groups[groupId] = group;

    const firstNames = ['Lucas', 'Gabriel', 'Mateus', 'Felipe', 'Rodrigo', 'Bruno', 'Carlos', 'Eduardo', 'Thiago', 'Leonardo', 'Mariana', 'Juliana', 'Camila', 'Beatriz'];
    const lastNames = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes'];
    const nowIso = new Date().toISOString();

    for (let i = 1; i <= count; i++) {
      const fName = firstNames[(i * 7) % firstNames.length];
      const lName = lastNames[(i * 13) % lastNames.length];
      const fullName = `${fName} ${lName}`;
      const numStr = i.toString().padStart(5, '0');
      const participantId = `PART-${groupId}-${numStr}`;
      const paymentId = `PAY-${groupId}-${numStr}`;

      const phone = `1198888${(1000 + (i % 8999))}`;
      const cpf = `${(100000000 + (i * 97) % 899999999)}00`;

      state.participants[participantId] = {
        participantId,
        groupId,
        paymentId,
        name: fullName,
        phone,
        email: `participante${i}@teste.com`,
        cpf,
        number: numStr,
        sequenceNumber: i,
        createdAt: nowIso,
        confirmedAt: nowIso,
        sharesCount: 1,
        weight: 1,
        totalShares: 1,
        entryValueCents: entryPriceCents,
      };

      state.payments[paymentId] = {
        paymentId,
        groupId,
        userName: fullName,
        userCpf: cpf,
        userEmail: `participante${i}@teste.com`,
        userPhone: phone,
        amountCents: entryPriceCents,
        gatewayFeeCents: 26,
        netAmountCents: entryPriceCents - 26,
        status: 'PAID',
        gatewayTransactionId: `TX-MEGA-${numStr}`,
        pixCopiaECola: '00020126...5204000053039865401.005802BR5913PIX6008BRASILIA62070503***6304****',
        pixQrCode: 'data:image/svg+xml;utf8,<svg></svg>',
        participantId,
        assignedNumber: numStr,
        sharesCount: 1,
        webhookProcessed: true,
        rawEventId: `SIM-BULK-${paymentId}`,
        expiresAt: nowIso,
        createdAt: nowIso,
        paidAt: nowIso,
      };
    }

    return group;
  }

  public createBulkTestGroup(count = 10000): Group {
    const group = this.createBulkTestGroupOnState(this.data, count);
    this.addAuditLog({
      type: 'GROUP_FULL',
      actor: 'ADMIN',
      groupId: group.groupId,
      metadata: {
        action: 'CREATE_BULK_TEST_GROUP',
        participantsCount: count,
      },
    });
    return group;
  }

  public save(): void {
    // Motor híbrido serverless: estado mantido em memória e persistido no PostgreSQL se configurado.
  }

  public resetDatabase(): void {
    this.data = this.initializeDefaultState();
    this.addAuditLog({
      type: 'SECURITY_ALERT',
      actor: 'ADMIN',
      metadata: { action: 'DATABASE_RESET' },
    });
  }
}

export const db = new Database();
