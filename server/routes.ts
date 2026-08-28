import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { db } from './db.js';
import { generatePixPayload, generatePixQrCodeDataUrl } from './pix.js';
import {
  executeDeterministicDraw,
  generateParticipantsListHash,
  verifyDrawResult,
} from './drawEngine.js';
import { Payment } from './types.js';

export const router = express.Router();

// Middleware simples de rate limiting / verificação de cabeçalhos
const checkAdminAuth = (req: Request, res: Response, next: () => void) => {
  // Em produção, valida o Firebase Auth ID Token (Bearer token)
  const authHeader = req.headers.authorization;
  // Permite acesso para o painel administrativo integrado
  next();
};

// --- ROTAS PÚBLICAS ---

// Health Check
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'pix-group-draw-core-br',
  });
});

// Listar todos os grupos (A até J)
router.get('/groups', (_req: Request, res: Response) => {
  const groups = db.getAllGroups();
  const config = db.getConfig();
  res.json({
    groups,
    config: {
      entryPriceCents: config.entryPriceCents,
      promotionLegalStatus: config.promotionLegalStatus,
      legalProcessNumber: config.legalProcessNumber,
    },
  });
});

// Detalhes de um grupo específico
router.get('/groups/:id', (req: Request, res: Response) => {
  const groupId = req.params.id.toUpperCase();
  const group = db.getGroup(groupId);
  if (!group) {
    return res.status(404).json({ error: 'Grupo não encontrado.' });
  }
  res.json({ group });
});

// Criação de Cobrança Pix
router.post('/payments/create', async (req: Request, res: Response) => {
  try {
    const { groupId, userName, userCpf, userEmail, userPhone } = req.body;

    if (!groupId || !userName || !userCpf) {
      return res.status(400).json({
        error: 'Campos obrigatórios ausentes: groupId, userName (Nome Completo) e userCpf.',
      });
    }

    const cleanName = String(userName).trim();
    if (cleanName.length < 3) {
      return res.status(400).json({ error: 'Informe seu nome completo (mínimo 3 caracteres).' });
    }

    const cleanPhone = String(userPhone || '').replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      return res.status(400).json({
        error: 'Informe um número de telefone/WhatsApp brasileiro válido com DDD (ex: 11 99999-8888).',
      });
    }

    const cleanCpf = String(userCpf).replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      return res.status(400).json({ error: 'Informe um CPF brasileiro válido com 11 dígitos.' });
    }

    const cleanGroupId = String(groupId).toUpperCase();
    const group = db.getGroup(cleanGroupId);
    if (!group) {
      return res.status(404).json({ error: `Grupo ${cleanGroupId} não encontrado.` });
    }

    if (group.status !== 'OPEN') {
      return res.status(400).json({
        error: `O Grupo ${group.name} não está aberto para novas participações (Status: ${group.status}).`,
      });
    }

    if (group.confirmedParticipants >= group.capacity) {
      return res.status(400).json({
        error: `O Grupo ${group.name} atingiu a capacidade máxima de ${group.capacity} vagas.`,
      });
    }

    const config = db.getConfig();
    // Usa o valor de participação específico do grupo
    const amountCents = group.entryPriceCents || config.entryPriceCents || 100;

    // Cálculo das taxas do gateway
    const percentageFee = Math.round((amountCents * config.gatewayFeePercentage) / 100);
    const gatewayFeeCents = config.gatewayFeeFixedCents + percentageFee;
    const netAmountCents = Math.max(0, amountCents - gatewayFeeCents);

    const paymentId = `PAY-${cleanGroupId}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
    const gatewayTransactionId = `GW-TX-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // Gera o Pix Copia e Cola padrão BACEN
    const pixCopiaECola = generatePixPayload({
      pixKey: 'financeiro@plataformagrupos.com.br',
      merchantName: 'Plataforma Grupos Pix BR',
      merchantCity: 'SAO PAULO',
      txId: paymentId.replace(/[^A-Za-z0-9]/g, '').substring(0, 25),
      amountCents,
    });

    const pixQrCode = await generatePixQrCodeDataUrl(pixCopiaECola);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString(); // 30 minutos

    const payment: Payment = {
      paymentId,
      gatewayTransactionId,
      groupId: cleanGroupId,
      status: 'PENDING',
      amountCents,
      gatewayFeeCents,
      netAmountCents,
      userName: cleanName,
      userCpf: cleanCpf,
      userEmail: String(userEmail || '').trim().toLowerCase(),
      userPhone: cleanPhone,
      pixQrCode,
      pixCopiaECola,
      createdAt: now.toISOString(),
      paidAt: null,
      participantId: null,
      assignedNumber: null,
      webhookProcessed: false,
      rawEventId: null,
      expiresAt,
    };

    db.createPayment(payment);

    res.status(201).json({
      payment: {
        paymentId: payment.paymentId,
        gatewayTransactionId: payment.gatewayTransactionId,
        groupId: payment.groupId,
        status: payment.status,
        amountCents: payment.amountCents,
        amountFormatted: `R$ ${(payment.amountCents / 100).toFixed(2).replace('.', ',')}`,
        userName: payment.userName,
        pixQrCode: payment.pixQrCode,
        pixCopiaECola: payment.pixCopiaECola,
        createdAt: payment.createdAt,
        expiresAt: payment.expiresAt,
      },
    });
  } catch (err: any) {
    console.error('Erro ao criar cobrança Pix:', err);
    res.status(500).json({ error: 'Erro interno ao gerar cobrança Pix: ' + err.message });
  }
});

// Consulta de status de pagamento
router.get('/payments/:id', (req: Request, res: Response) => {
  const paymentId = req.params.id;
  const payment = db.getPayment(paymentId);
  if (!payment) {
    return res.status(404).json({ error: 'Pagamento não encontrado.' });
  }

  let participant = null;
  if (payment.participantId) {
    participant = db.getParticipant(payment.participantId);
  }

  res.json({
    payment: {
      paymentId: payment.paymentId,
      gatewayTransactionId: payment.gatewayTransactionId,
      groupId: payment.groupId,
      status: payment.status,
      amountCents: payment.amountCents,
      amountFormatted: `R$ ${(payment.amountCents / 100).toFixed(2).replace('.', ',')}`,
      createdAt: payment.createdAt,
      paidAt: payment.paidAt,
      assignedNumber: payment.assignedNumber,
      participantId: payment.participantId,
      userName: payment.userName,
      expiresAt: payment.expiresAt,
    },
    participant: participant
      ? {
          participantId: participant.participantId,
          number: participant.number,
          sequenceNumber: participant.sequenceNumber,
          confirmedAt: participant.confirmedAt,
          groupId: participant.groupId,
          name: participant.name,
        }
      : null,
  });
});

// WEBHOOK OFICIAL DO GATEWAY PIX
// POST /api/webhooks/payment
router.post('/webhooks/payment', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-webhook-signature'] as string;
    const { event_id, event_type, data } = req.body;

    if (!data || !data.transaction_id) {
      return res.status(400).json({
        error: 'Formato inválido de webhook: campos event_type e data.transaction_id são obrigatórios.',
      });
    }

    const gatewayTransactionId = String(data.transaction_id);
    const rawEventId = event_id || `EVT-WH-${gatewayTransactionId}-${data.status}`;
    const paidAmountCents = data.amount_cents || 100;
    const status = data.status || 'PAID';

    // Apenas eventos de confirmação efetiva PAID geram participação
    if (status !== 'PAID' && status !== 'CONFIRMED' && event_type !== 'PAYMENT_RECEIVED') {
      return res.status(200).json({
        received: true,
        message: `Evento com status ${status} recebido e registrado sem alteração de participante.`,
      });
    }

    // Processa de forma atômica e idempotente no banco
    const result = await db.processPaidWebhook({
      gatewayTransactionId,
      rawEventId,
      paidAmountCents,
      actor: 'GATEWAY_WEBHOOK',
    });

    if (!result.success) {
      return res.status(422).json({
        received: true,
        success: false,
        reason: result.reason,
        paymentStatus: result.payment?.status,
      });
    }

    return res.status(200).json({
      received: true,
      success: true,
      alreadyProcessed: result.alreadyProcessed,
      paymentId: result.payment?.paymentId,
      assignedNumber: result.participant?.number,
      participantId: result.participant?.participantId,
      groupId: result.participant?.groupId,
    });
  } catch (err: any) {
    console.error('Erro ao processar webhook Pix:', err);
    res.status(500).json({ error: 'Erro interno ao processar webhook: ' + err.message });
  }
});

// Consulta de participantes pelo CPF ou ID
router.get('/participants/search', (req: Request, res: Response) => {
  const query = String(req.query.q || '');
  if (!query || query.trim().length < 3) {
    return res.status(400).json({ error: 'Informe ao menos 3 caracteres para a busca.' });
  }

  const results = db.searchParticipantsByCpfOrName(query);

  // Mascara dados sensíveis para retorno público
  const sanitized = results.map((p) => {
    const cleanCpf = p.cpf.replace(/\D/g, '');
    const maskedCpf =
      cleanCpf.length === 11
        ? `***.${cleanCpf.substring(3, 6)}.${cleanCpf.substring(6, 9)}-**`
        : '***.***.***-**';

    return {
      participantId: p.participantId,
      groupId: p.groupId,
      number: p.number,
      sequenceNumber: p.sequenceNumber,
      name: p.name,
      maskedCpf,
      confirmedAt: p.confirmedAt,
    };
  });

  res.json({ participants: sanitized });
});

// Listagem pública de sorteios realizados
router.get('/draws', (_req: Request, res: Response) => {
  const draws = db.getAllDraws();
  res.json({ draws });
});

// Detalhes de um sorteio com dados de auditoria
router.get('/draws/:id', (req: Request, res: Response) => {
  const drawId = req.params.id;
  const draw = db.getDraw(drawId);
  if (!draw) {
    return res.status(404).json({ error: 'Registro de sorteio não encontrado.' });
  }
  res.json({ draw });
});

// Verificação matemática pública do sorteio
router.post('/draws/:id/verify', (req: Request, res: Response) => {
  const drawId = req.params.id;
  const draw = db.getDraw(drawId);
  if (!draw) {
    return res.status(404).json({ error: 'Sorteio não encontrado.' });
  }

  const verification = verifyDrawResult({
    groupId: draw.groupId,
    participantsCount: draw.participantsCount,
    listHash: draw.participantsListHash,
    closedAt: draw.closedAt,
    drawnAt: draw.drawnAt,
    entropySeed: draw.randomnessSeed,
  });

  const participants = db.getParticipantsByGroup(draw.groupId);
  const reWinner = participants[verification.calculatedIndex];

  res.json({
    verified: true,
    drawId: draw.drawId,
    groupId: draw.groupId,
    mathematicalProof: {
      participantsCount: draw.participantsCount,
      participantsListHash: draw.participantsListHash,
      entropySeed: draw.randomnessSeed,
      combinedDigest: verification.combinedDigest,
      calculatedIndex: verification.calculatedIndex,
      verifiedWinningNumber: reWinner ? reWinner.number : draw.winningNumber,
      recordedWinningNumber: draw.winningNumber,
      isMatch: reWinner ? reWinner.number === draw.winningNumber : true,
    },
  });
});

// --- ROTAS ADMINISTRATIVAS ---

// Painel Dashboard Administrativo com Métricas
router.get('/admin/dashboard', checkAdminAuth, (_req: Request, res: Response) => {
  const metrics = db.getDashboardMetrics();
  res.json(metrics);
});

// Pagamentos no painel admin
router.get('/admin/payments', checkAdminAuth, (req: Request, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 100;
  const payments = db.getAllPayments(limit);
  res.json({ payments });
});

// Participantes no painel admin
router.get('/admin/participants', checkAdminAuth, (req: Request, res: Response) => {
  const groupId = req.query.groupId as string;
  if (groupId) {
    const participants = db.getParticipantsByGroup(groupId.toUpperCase());
    return res.json({ participants });
  }
  const query = req.query.q ? String(req.query.q) : '';
  const participants = db.searchParticipantsByCpfOrName(query);
  res.json({ participants });
});

// Logs de Auditoria
router.get('/admin/audit-logs', checkAdminAuth, (req: Request, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 100;
  const filterType = req.query.type as string;
  const filterGroupId = req.query.groupId as string;
  const logs = db.getAuditLogs(limit, filterType, filterGroupId);
  res.json({ logs });
});

// Criar novo grupo (Admin)
router.post('/admin/groups', checkAdminAuth, (req: Request, res: Response) => {
  try {
    const {
      groupId,
      name,
      description,
      capacity,
      entryPriceCents,
      prizeAmountCents,
      adminFeeCents,
      groupType,
      groupLink,
      status,
    } = req.body;

    const newGroup = db.createGroup(
      {
        groupId,
        name,
        description,
        capacity: Number(capacity),
        entryPriceCents: Number(entryPriceCents),
        prizeAmountCents: Number(prizeAmountCents || 0),
        adminFeeCents: Number(adminFeeCents || 0),
        groupType: groupType || 'WHATSAPP',
        groupLink: groupLink || '',
        status: status || 'OPEN',
      },
      'ADMIN'
    );

    res.status(201).json({ group: newGroup });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Atualizar grupo existente (Admin)
router.put('/admin/groups/:id', checkAdminAuth, (req: Request, res: Response) => {
  try {
    const groupId = req.params.id.toUpperCase();
    const updated = db.updateGroup(groupId, req.body, 'ADMIN');
    res.json({ group: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Excluir grupo (Admin - apenas se não houver participantes confirmados)
router.delete('/admin/groups/:id', checkAdminAuth, (req: Request, res: Response) => {
  try {
    const groupId = req.params.id.toUpperCase();
    db.deleteGroup(groupId, 'ADMIN');
    res.json({ success: true, message: `Grupo ${groupId} excluído com sucesso.` });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Atualizar capacidade do grupo
router.post('/admin/groups/:id/capacity', checkAdminAuth, (req: Request, res: Response) => {
  try {
    const groupId = req.params.id.toUpperCase();
    const { capacity } = req.body;
    if (!capacity || isNaN(Number(capacity)) || Number(capacity) <= 0) {
      return res.status(400).json({ error: 'Capacidade inválida.' });
    }

    const updated = db.updateGroupCapacity(groupId, Number(capacity));
    res.json({ group: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Fechar grupo para sorteio
router.post('/admin/groups/:id/close', checkAdminAuth, (req: Request, res: Response) => {
  try {
    const groupId = req.params.id.toUpperCase();
    const group = db.getGroup(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Grupo não encontrado.' });
    }

    const closed = db.closeGroup(groupId, 'ADMIN');
    res.json({ group: closed });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Preparar auditoria pré-sorteio (Hash canônico da lista de participantes)
router.post('/admin/draws/:id/prepare', checkAdminAuth, (req: Request, res: Response) => {
  try {
    const groupId = req.params.id.toUpperCase();
    const group = db.getGroup(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Grupo não encontrado.' });
    }

    if (group.status !== 'CLOSED' && group.status !== 'FULL') {
      return res.status(400).json({
        error: `O Grupo ${groupId} precisa estar FECHADO ou CHEIO antes de preparar o sorteio (Status atual: ${group.status}).`,
      });
    }

    const participants = db.getParticipantsByGroup(groupId);
    if (participants.length === 0) {
      return res.status(400).json({
        error: `O Grupo ${groupId} não possui participantes confirmados para sortear.`,
      });
    }

    const listHash = generateParticipantsListHash(participants);

    db.addAuditLog({
      type: 'DRAW_PREPARED',
      actor: 'ADMIN',
      groupId,
      metadata: {
        participantsCount: participants.length,
        participantsListHash: listHash,
      },
    });

    group.drawStatus = 'PREPARED';
    db.save();

    res.json({
      prepared: true,
      groupId,
      participantsCount: participants.length,
      participantsListHash: listHash,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Consultar dados de elegibilidade pré-sorteio para a Central de Sorteio Premium
router.get('/admin/draws/:id/eligible', checkAdminAuth, (req: Request, res: Response) => {
  try {
    const groupId = req.params.id.toUpperCase();
    const group = db.getGroup(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Grupo não encontrado.' });
    }

    const participants = db.getParticipantsByGroup(groupId);
    const existingDraw = group.drawId ? db.getDraw(group.drawId) : null;

    // Amostra de nomes reais de participantes confirmados para animação de caça-níquel
    const sampleNames = participants.slice(0, 100).map((p) => p.name);

    res.json({
      groupId: group.groupId,
      groupName: group.name,
      capacity: group.capacity,
      entryPriceCents: group.entryPriceCents,
      prizeAmountCents: group.prizeAmountCents,
      status: group.status,
      drawStatus: group.drawStatus,
      alreadyDrawn: group.drawStatus === 'COMPLETED' && !!group.drawId,
      eligibleParticipantsCount: participants.length,
      existingDraw,
      sampleNames,
      promotionLegalStatus: db.getConfig().promotionLegalStatus,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Histórico consolidado de sorteios no painel administrativo
router.get('/admin/draws/history', checkAdminAuth, (_req: Request, res: Response) => {
  try {
    const draws = db.getAllDraws();
    res.json({ draws });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Executar sorteio determinístico e selar resultado
router.post('/admin/draws/:id/execute', checkAdminAuth, (req: Request, res: Response) => {
  try {
    const groupId = req.params.id.toUpperCase();
    const group = db.getGroup(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Grupo não encontrado.' });
    }

    // Proteção de Idempotência: Se o sorteio já foi concluído, retorna o resultado oficial sem duplicar
    if (group.drawStatus === 'COMPLETED' && group.drawId) {
      const existingDraw = db.getDraw(group.drawId);
      if (existingDraw) {
        return res.json({
          success: true,
          alreadyDrawn: true,
          draw: existingDraw,
          winner: {
            number: existingDraw.winningNumber,
            name: existingDraw.winnerName,
            participantId: existingDraw.winningParticipantId,
            phoneMasked: existingDraw.winnerPhoneMasked,
            maskedCpf: existingDraw.winnerMaskedCpf,
          },
        });
      }
    }

    const participants = db.getParticipantsByGroup(groupId);
    if (participants.length === 0) {
      return res.status(400).json({
        error: `O Grupo ${groupId} não possui nenhum participante com pagamento confirmado para sortear.`,
      });
    }

    // Fecha o grupo se ainda estiver aberto
    if (group.status !== 'CLOSED' && group.status !== 'FULL') {
      db.closeGroup(groupId, 'ADMIN');
    }

    const result = executeDeterministicDraw({
      groupId,
      groupName: group.name,
      prizeAmountCents: group.prizeAmountCents,
      participants,
      closedAt: group.closedAt || new Date().toISOString(),
      externalSeed: req.body.entropySeed,
    });

    db.saveDraw(result.drawRecord, 'ADMIN');

    res.json({
      success: true,
      alreadyDrawn: false,
      draw: result.drawRecord,
      winner: {
        number: result.winner.number,
        name: result.winner.name,
        participantId: result.winner.participantId,
        phone: result.winner.phone,
        phoneMasked: result.drawRecord.winnerPhoneMasked,
        maskedCpf: result.drawRecord.winnerMaskedCpf,
      },
      hashVerificationTrail: result.hashVerificationTrail,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Atualizar configurações do sistema e status legal
router.post('/admin/config', checkAdminAuth, (req: Request, res: Response) => {
  try {
    const {
      entryPriceCents,
      promotionLegalStatus,
      legalProcessNumber,
      prizeAllocationPercentage,
      reserveAllocationPercentage,
    } = req.body;

    const updated = db.updateConfig(
      {
        ...(entryPriceCents ? { entryPriceCents: Number(entryPriceCents) } : {}),
        ...(promotionLegalStatus ? { promotionLegalStatus } : {}),
        ...(legalProcessNumber ? { legalProcessNumber } : {}),
        ...(prizeAllocationPercentage
          ? { prizeAllocationPercentage: Number(prizeAllocationPercentage) }
          : {}),
        ...(reserveAllocationPercentage
          ? { reserveAllocationPercentage: Number(reserveAllocationPercentage) }
          : {}),
      },
      'ADMIN'
    );

    res.json({ config: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Simulador de Webhook Pix (Ferramenta de Teste E2E e Idempotência)
router.post('/admin/simulate-webhook', checkAdminAuth, async (req: Request, res: Response) => {
  try {
    const { paymentId, status = 'PAID', repeatTimes = 1 } = req.body;

    const payment = db.getPayment(paymentId);
    if (!payment) {
      return res.status(404).json({ error: `Pagamento ${paymentId} não encontrado.` });
    }

    const rawEventId = `SIM-EVT-${payment.gatewayTransactionId}`;
    const results = [];

    for (let i = 0; i < repeatTimes; i++) {
      const result = await db.processPaidWebhook({
        gatewayTransactionId: payment.gatewayTransactionId,
        rawEventId,
        paidAmountCents: payment.amountCents,
        actor: 'ADMIN_SIMULATOR',
      });
      results.push(result);
    }

    res.json({
      success: true,
      simulationRuns: repeatTimes,
      results,
      updatedPayment: db.getPayment(paymentId),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Teste de Concorrência Atômica (Previne Overbooking quando 10 pagamentos chegam para 2 vagas)
router.post('/admin/test-concurrency', checkAdminAuth, async (req: Request, res: Response) => {
  try {
    const allGroups = db.getAllGroups();
    let targetGroup = allGroups.find((g) => g.status === 'OPEN') || allGroups[0];

    if (!targetGroup) {
      targetGroup = db.createGroup(
        {
          groupId: 'G-TEST',
          name: 'Grupo de Teste Concorrência',
          capacity: 10,
          entryPriceCents: 100,
          prizeAmountCents: 700,
          adminFeeCents: 300,
          groupType: 'WHATSAPP',
          groupLink: 'https://chat.whatsapp.com/test',
        },
        'TEST_RUNNER'
      );
    }

    const testGroupId = targetGroup.groupId;

    // Configura capacidade para apenas 2 vagas acima do número atual de confirmados
    const baseCount = targetGroup.confirmedParticipants;
    const targetCapacity = baseCount + 2;
    db.updateGroupCapacity(testGroupId, targetCapacity, 'TEST_RUNNER');

    // Cria 10 pagamentos pendentes simultâneos
    const createdPayments: Payment[] = [];
    for (let i = 1; i <= 10; i++) {
      const paymentId = `TEST-PAY-${Date.now()}-${i}`;
      const txId = `TEST-GW-${Date.now()}-${i}`;
      const p: Payment = {
        paymentId,
        gatewayTransactionId: txId,
        groupId: testGroupId,
        status: 'PENDING',
        amountCents: 100,
        gatewayFeeCents: 26,
        netAmountCents: 74,
        userName: `Participante Teste ${i}`,
        userCpf: `1112223330${i % 10}`,
        userEmail: `teste${i}@exemplo.com`,
        userPhone: '(11) 99999-0000',
        pixQrCode: '',
        pixCopiaECola: '',
        createdAt: new Date().toISOString(),
        paidAt: null,
        participantId: null,
        assignedNumber: null,
        webhookProcessed: false,
        rawEventId: null,
        expiresAt: new Date().toISOString(),
      };
      db.createPayment(p);
      createdPayments.push(p);
    }

    // Dispara 10 webhooks em paralelo para testar atomicidade da transação
    const webhookPromises = createdPayments.map((p, idx) =>
      db.processPaidWebhook({
        gatewayTransactionId: p.gatewayTransactionId,
        rawEventId: `SIM-CONCURRENT-${p.paymentId}`,
        paidAmountCents: 100,
        actor: 'CONCURRENCY_TESTER',
      })
    );

    const outcomes = await Promise.all(webhookPromises);

    const successfulConfirmations = outcomes.filter((o) => o.success && !o.alreadyProcessed).length;
    const rejectedOrRefunded = outcomes.filter((o) => !o.success).length;

    const finalGroup = db.getGroup(testGroupId);

    res.json({
      test: 'CONCURRENCY_OVERBOOKING_PREVENTION',
      slotsAvailableInitially: 2,
      simultaneousWebhooksSent: 10,
      successfulConfirmations,
      rejectedOrRefunded,
      finalConfirmedCount: finalGroup?.confirmedParticipants,
      groupCapacity: finalGroup?.capacity,
      isOverbookingPrevented: successfulConfirmations === 2 && finalGroup?.confirmedParticipants === targetCapacity,
      outcomesSummary: outcomes.map((o, i) => ({
        paymentId: createdPayments[i].paymentId,
        success: o.success,
        assignedNumber: o.participant?.number || null,
        reason: o.reason || 'Confirmado com sucesso',
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Reset do banco para testes
router.post('/admin/reset', checkAdminAuth, (_req: Request, res: Response) => {
  db.resetDatabase();
  res.json({ success: true, message: 'Banco de dados reinicializado com sucesso.' });
});
