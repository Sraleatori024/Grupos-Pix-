import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  Group,
  Participant,
  Payment,
  DrawAuditRecord,
  AuditLog,
  SystemConfig,
  PaymentStatus,
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

class Database {
  private data: DatabaseSchema;
  private dbFilePath: string;
  private groupMutexes: Map<string, Mutex> = new Map();
  private globalMutex = new Mutex();

  constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch (err) {
        console.warn('Could not create data dir, running with in-memory persistence fallback:', err);
      }
    }
    this.dbFilePath = path.join(dataDir, 'database.json');
    this.data = this.loadOrInitialize();

    // Se a base estiver vazia, cria o grupo de 10.000 pessoas para o teste do usuário
    if (Object.keys(this.data.groups).length === 0) {
      this.createBulkTestGroup(10000);
    }
  }

  private getGroupMutex(groupId: string): Mutex {
    if (!this.groupMutexes.has(groupId)) {
      this.groupMutexes.set(groupId, new Mutex());
    }
    return this.groupMutexes.get(groupId)!;
  }

  private generateSeedGroups(): Record<string, Group> {
    // Banco inicia 100% zerado sem grupos pré-cadastrados conforme solicitação
    return {};
  }

  private loadOrInitialize(): DatabaseSchema {
    if (fs.existsSync(this.dbFilePath)) {
      try {
        const raw = fs.readFileSync(this.dbFilePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (!parsed.groups) parsed.groups = {};
        if (!parsed.participants) parsed.participants = {};
        if (!parsed.payments) parsed.payments = {};
        if (!parsed.draws) parsed.draws = {};
        if (!parsed.auditLogs) parsed.auditLogs = [];
        if (!parsed.processedWebhooks) parsed.processedWebhooks = {};
        if (!parsed.config) {
          parsed.config = {
            entryPriceCents: 100,
            promotionLegalStatus: 'PENDING_REVIEW',
            legalProcessNumber: '',
            webhookSecret: 'sec_pix_live_' + crypto.randomBytes(16).toString('hex'),
            gatewayFeeFixedCents: 25,
            gatewayFeePercentage: 0.99,
            prizeAllocationPercentage: 70,
            reserveAllocationPercentage: 10,
            maxCapacityPerGroup: 10000,
          };
        }
        return parsed;
      } catch (e) {
        console.error('Error loading database.json, resetting to clean initial state:', e);
      }
    }

    const initialSchema: DatabaseSchema = {
      groups: {},
      participants: {},
      payments: {},
      draws: {},
      auditLogs: [],
      processedWebhooks: {},
      config: {
        entryPriceCents: 100, // R$ 1,00
        promotionLegalStatus: 'PENDING_REVIEW', // Em conformidade legal inicial
        legalProcessNumber: '',
        webhookSecret: 'sec_pix_live_' + crypto.randomBytes(16).toString('hex'),
        gatewayFeeFixedCents: 25, // R$ 0,25 taxa fixa
        gatewayFeePercentage: 0.99, // 0,99%
        prizeAllocationPercentage: 70, // 70% Fundo de Premiação
        reserveAllocationPercentage: 10, // 10% Fundo de Reserva
        maxCapacityPerGroup: 10000,
      },
    };

    this.saveDataDirect(initialSchema);
    return initialSchema;
  }

  private saveDataDirect(data: DatabaseSchema): void {
    try {
      const dataDir = path.dirname(this.dbFilePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(this.dbFilePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error('Error persisting database:', e);
    }
  }

  public save(): void {
    this.saveDataDirect(this.data);
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
    this.save();
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
    this.save();
    return this.getConfig();
  }

  // --- Groups (CRUD Dinâmico sem limites fixos) ---
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
    };

    this.data.groups[id] = newGroup;
    this.addAuditLog({
      type: 'GROUP_CLOSED',
      actor,
      groupId: id,
      metadata: { action: 'CREATE_GROUP', group: newGroup },
    });
    this.save();
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

    // Auto-atualização de status se atingir capacidade
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
    this.save();
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
    this.save();
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
    this.save();
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
    this.save();
    return payment;
  }

  public getPayment(paymentId: string): Payment | null {
    return this.data.payments[paymentId] || null;
  }

  public getPaymentByGatewayTxId(gatewayTxId: string): Payment | null {
    return (
      Object.values(this.data.payments).find((p) => p.gatewayTransactionId === gatewayTxId) || null
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
      return {
        success: true,
        alreadyProcessed: true,
        reason: `Evento ${rawEventId} já foi processado anteriormente (Idempotência confirmada).`,
        payment: existingPayment,
      };
    }

    // 2. Localiza a cobrança associada
    const payment = this.getPaymentByGatewayTxId(gatewayTransactionId);
    if (!payment) {
      return {
        success: false,
        alreadyProcessed: false,
        reason: `Cobrança com gatewayTransactionId ${gatewayTransactionId} não foi localizada.`,
      };
    }

    // 3. Se o pagamento já estiver PAID, registra o evento de idempotência e retorna
    if (payment.status === 'PAID') {
      this.data.processedWebhooks[rawEventId] = {
        processedAt: new Date().toISOString(),
        paymentId: payment.paymentId,
      };
      this.save();
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
        this.save();
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
        this.save();
        return {
          success: false,
          alreadyProcessed: false,
          reason: `Capacidade máxima do grupo atingida. Vaga não confirmada.`,
          payment,
        };
      }

      // 5. Atribui número único sequencial formatado
      const nextSequence = currentGroup.confirmedParticipants + 1;
      const numDigits = Math.max(5, currentGroup.capacity.toString().length);
      const formattedNumber = nextSequence.toString().padStart(numDigits, '0');
      const participantId = `PART-${payment.groupId}-${formattedNumber}-${Date.now().toString(36)}`;

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
        },
      });

      this.save();

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

  public searchParticipantsByCpfOrName(query: string): Participant[] {
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
      .sort((a, b) => new Date(b.confirmedAt).getTime() - new Date(a.confirmedAt).getTime());
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

    this.save();
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

  // --- Utilitário de Teste / Reset ---
  public createBulkTestGroup(count = 10000): Group {
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
    };

    this.data.groups[groupId] = group;

    const firstNames = [
      'Lucas', 'Gabriel', 'Mateus', 'Felipe', 'Rodrigo', 'Bruno', 'Carlos', 'Eduardo', 'Thiago', 'Leonardo',
      'Guilherme', 'Diego', 'Rafael', 'Alexandre', 'Daniel', 'Marcos', 'Fernando', 'Fabio', 'Andre', 'Marcelo',
      'Mariana', 'Juliana', 'Camila', 'Beatriz', 'Larissa', 'Fernanda', 'Aline', 'Patricia', 'Amanda', 'Bruna',
      'Jessica', 'Leticia', 'Vanessa', 'Renata', 'Carolina', 'Daniela', 'Gabriela', 'Raquel', 'Tatiane', 'Priscila',
      'Joao', 'Jose', 'Antonio', 'Francisco', 'Paulo', 'Pedro', 'Luiz', 'Manoel', 'Maria', 'Ana',
    ];

    const lastNames = [
      'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes',
      'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Almeida', 'Lopes', 'Soares', 'Fernandes', 'Vieira', 'Barbosa',
      'Rocha', 'Dias', 'Nascimento', 'Andrade', 'Moreira', 'Nunes', 'Marques', 'Machado', 'Mendes', 'Freitas',
      'Cardoso', 'Ramos', 'Goncalves', 'Santana', 'Teixeira', 'Cavalcanti', 'Melo', 'Pinto', 'Castro', 'Azevedo',
    ];

    const nowIso = new Date().toISOString();

    for (let i = 1; i <= count; i++) {
      const fName = firstNames[(i * 7) % firstNames.length];
      const lName = lastNames[(i * 13) % lastNames.length];
      const lName2 = lastNames[(i * 19 + 3) % lastNames.length];
      const fullName = `${fName} ${lName} ${lName2}`;
      const numStr = i.toString().padStart(5, '0');
      const participantId = `PART-${groupId}-${numStr}`;
      const paymentId = `PAY-${groupId}-${numStr}`;

      const ddd = 10 + (i % 89);
      const phoneEnd = (1000 + (i % 9000)).toString();
      const phone = `${ddd}9${(1000 + (i % 8999))}${phoneEnd}`;

      const cpfBase = (100000000 + (i * 97) % 899999999).toString();
      const cpf = `${cpfBase}00`;

      this.data.participants[participantId] = {
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
      };

      // Registrar também pagamento como pago para manter consistência 100%
      this.data.payments[paymentId] = {
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
        webhookProcessed: true,
        rawEventId: `SIM-BULK-${paymentId}`,
        expiresAt: nowIso,
        createdAt: nowIso,
        paidAt: nowIso,
      };
    }

    this.addAuditLog({
      type: 'GROUP_FULL',
      actor: 'ADMIN',
      groupId,
      metadata: {
        action: 'CREATE_BULK_TEST_GROUP',
        participantsCount: count,
        prizeAmountCents,
      },
    });

    this.save();
    return group;
  }

  public resetDatabase(): void {
    this.data.groups = this.generateSeedGroups();
    this.data.participants = {};
    this.data.payments = {};
    this.data.draws = {};
    this.data.auditLogs = [];
    this.data.processedWebhooks = {};
    this.addAuditLog({
      type: 'SECURITY_ALERT',
      actor: 'ADMIN',
      metadata: { action: 'DATABASE_RESET' },
    });
    this.save();
  }
}

export const db = new Database();

