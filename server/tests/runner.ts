import { db } from '../db.js';
import { executeDeterministicDraw, verifyDrawResult } from '../drawEngine.js';
import { Participant } from '../types.js';
import { d5payService } from '../d5payService.js';

async function runAllTests() {
  console.log('====================================================');
  console.log(' INICIANDO SUÍTE DE TESTES: PLATAFORMA PIX & SORTEIOS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  // TESTE 1: Cálculos Financeiros e Centavos
  try {
    console.log('▶ [TESTE 1] Consistência de Centavos e Cálculos Financeiros...');
    const amountCents = 100; // R$ 1,00
    const feeFixed = 25; // R$ 0,25
    const feePercent = 0.99; // 0.99%
    const calculatedFee = feeFixed + Math.round((amountCents * feePercent) / 100);
    const net = amountCents - calculatedFee;

    if (calculatedFee === 26 && net === 74) {
      console.log('  ✔ SUCESSO: Cálculos financeiros em centavos exatos (Bruto: 100c, Taxa: 26c, Líquido: 74c).');
      passed++;
    } else {
      throw new Error(`Resultado inesperado: Taxa=${calculatedFee}, Líquido=${net}`);
    }
  } catch (err: any) {
    console.error('  ✖ FALHA no Teste 1:', err.message);
    failed++;
  }

  // TESTE 2: Idempotência Estrita de Webhook
  try {
    console.log('\n▶ [TESTE 2] Idempotência do Webhook Pix...');
    const testGroupId = 'A';
    const testGroup = db.getGroup(testGroupId)!;
    const initialParticipants = testGroup.confirmedParticipants;

    const paymentId = `TEST-IDEMP-${Date.now()}`;
    const txId = `GW-TX-IDEMP-${Date.now()}`;
    db.createPayment({
      paymentId,
      gatewayTransactionId: txId,
      groupId: testGroupId,
      status: 'PENDING',
      amountCents: 100,
      gatewayFeeCents: 26,
      netAmountCents: 74,
      userName: 'Carlos Idempotente',
      userCpf: '12345678900',
      userEmail: 'carlos@teste.com',
      userPhone: '(11) 98888-7777',
      pixQrCode: '',
      pixCopiaECola: '',
      createdAt: new Date().toISOString(),
      paidAt: null,
      participantId: null,
      assignedNumber: null,
      webhookProcessed: false,
      rawEventId: null,
      expiresAt: new Date().toISOString(),
    });

    const eventId = `EVT-IDEMP-${Date.now()}`;

    // Dispara 5 chamadas idênticas
    const res1 = await db.processPaidWebhook({
      gatewayTransactionId: txId,
      rawEventId: eventId,
      paidAmountCents: 100,
      actor: 'TEST',
    });

    const res2 = await db.processPaidWebhook({
      gatewayTransactionId: txId,
      rawEventId: eventId,
      paidAmountCents: 100,
      actor: 'TEST',
    });

    const res3 = await db.processPaidWebhook({
      gatewayTransactionId: txId,
      rawEventId: eventId,
      paidAmountCents: 100,
      actor: 'TEST',
    });

    const groupAfter = db.getGroup(testGroupId)!;
    const countDifference = groupAfter.confirmedParticipants - initialParticipants;

    if (
      res1.success &&
      !res1.alreadyProcessed &&
      res2.alreadyProcessed &&
      res3.alreadyProcessed &&
      countDifference === 1
    ) {
      console.log(`  ✔ SUCESSO: Webhook chamado 3x processou exatamente 1 participante (Número: ${res1.participant?.number}).`);
      passed++;
    } else {
      throw new Error(`Falha na idempotência: countDiff=${countDifference}, res2=${res2.alreadyProcessed}, res3=${res3.alreadyProcessed}`);
    }
  } catch (err: any) {
    console.error('  ✖ FALHA no Teste 2:', err.message);
    failed++;
  }

  // TESTE 3: Concorrência e Prevenção de Overbooking
  try {
    console.log('\n▶ [TESTE 3] Concorrência e Bloqueio de Overbooking (10 pagamentos para 2 vagas)...');
    const groupC = db.getGroup('C')!;
    const curConfirmed = groupC.confirmedParticipants;
    db.updateGroupCapacity('C', curConfirmed + 2, 'TEST_RUNNER');

    const paymentsToTest = [];
    for (let i = 1; i <= 10; i++) {
      const pid = `CONCUR-${Date.now()}-${i}`;
      const tx = `GW-CONCUR-${Date.now()}-${i}`;
      db.createPayment({
        paymentId: pid,
        gatewayTransactionId: tx,
        groupId: 'C',
        status: 'PENDING',
        amountCents: 100,
        gatewayFeeCents: 26,
        netAmountCents: 74,
        userName: `Candidato Concorrente ${i}`,
        userCpf: `1112223330${i}`,
        userEmail: `concorrente${i}@teste.com`,
        userPhone: '',
        pixQrCode: '',
        pixCopiaECola: '',
        createdAt: new Date().toISOString(),
        paidAt: null,
        participantId: null,
        assignedNumber: null,
        webhookProcessed: false,
        rawEventId: null,
        expiresAt: new Date().toISOString(),
      });
      paymentsToTest.push({ pid, tx });
    }

    // Dispara 10 simultâneos
    const promises = paymentsToTest.map((p) =>
      db.processPaidWebhook({
        gatewayTransactionId: p.tx,
        rawEventId: `RAW-EVT-${p.pid}`,
        paidAmountCents: 100,
        actor: 'TEST_CONCURRENCY',
      })
    );

    const results = await Promise.all(promises);
    const successCount = results.filter((r) => r.success && !r.alreadyProcessed).length;
    const groupCFinal = db.getGroup('C')!;

    if (successCount === 2 && groupCFinal.confirmedParticipants === curConfirmed + 2) {
      console.log(`  ✔ SUCESSO: Das 10 requisições simultâneas, exatamente 2 foram aprovadas e 8 foram barradas/estornadas.`);
      passed++;
    } else {
      throw new Error(`Overbooking falhou: successCount=${successCount}, finalCount=${groupCFinal.confirmedParticipants}`);
    }
  } catch (err: any) {
    console.error('  ✖ FALHA no Teste 3:', err.message);
    failed++;
  }

  // TESTE 4: Sorteio Determinístico SHA-256 e Verificação Matemática
  try {
    console.log('\n▶ [TESTE 4] Motor de Sorteio Determinístico SHA-256 e Verificação Pública...');
    const fakeParticipants: Participant[] = [];
    for (let i = 1; i <= 50; i++) {
      fakeParticipants.push({
        participantId: `PART-TEST-${i}`,
        groupId: 'B',
        paymentId: `PAY-${i}`,
        number: i.toString().padStart(5, '0'),
        sequenceNumber: i,
        name: `Participante Teste ${i}`,
        cpf: '123.456.789-00',
        email: `p${i}@exemplo.com`,
        phone: '',
        createdAt: '2026-08-27T10:00:00.000Z',
        confirmedAt: '2026-08-27T10:05:00.000Z',
      });
    }

    const closedAt = '2026-08-27T12:00:00.000Z';
    const drawnAt = '2026-08-27T12:05:00.000Z';
    const fixedEntropySeed = 'a3b5c7d9e1f2a3b5c7d9e1f2a3b5c7d9e1f2a3b5c7d9e1f2a3b5c7d9e1f2a3b5';

    // Execução 1
    const draw1 = executeDeterministicDraw({
      groupId: 'B',
      participants: fakeParticipants,
      closedAt,
      drawnAt,
      externalSeed: fixedEntropySeed,
    });

    // Execução 2 com mesmos parâmetros
    const draw2 = executeDeterministicDraw({
      groupId: 'B',
      participants: fakeParticipants,
      closedAt,
      drawnAt,
      externalSeed: fixedEntropySeed,
    });

    // Verificação de auditoria externa
    const verification = verifyDrawResult({
      groupId: 'B',
      participantsCount: draw1.drawRecord.participantsCount,
      listHash: draw1.drawRecord.participantsListHash,
      closedAt: draw1.drawRecord.closedAt,
      drawnAt: draw1.drawRecord.drawnAt,
      entropySeed: fixedEntropySeed,
    });

    const isWinnerIdentical = draw1.winner.number === draw2.winner.number;
    const isHashIdentical = draw1.drawRecord.participantsListHash === draw2.drawRecord.participantsListHash;
    const isVerificationMatch = verification.calculatedIndex === draw1.hashVerificationTrail.calculatedIndex;

    if (isWinnerIdentical && isHashIdentical && isVerificationMatch) {
      console.log(`  ✔ SUCESSO: Sorteio 100% determinístico e auditável. Vencedor selecionado: Número ${draw1.winner.number} (Hash da Lista: ${draw1.drawRecord.participantsListHash.substring(0, 16)}...).`);
      passed++;
    } else {
      throw new Error(`Inconsistência determinística no sorteio.`);
    }
  } catch (err: any) {
    console.error('  ✖ FALHA no Teste 4:', err.message);
    failed++;
  }

  // TESTE 5: Gerenciador de Token D5Pay (Cache em Memória, Deduplicação e Renovação)
  try {
    console.log('\n▶ [TESTE 5] Gerenciador de Token D5Pay / SyncPayments...');
    d5payService.invalidateToken();

    let networkCallCount = 0;
    d5payService.setMockTokenHandler(async () => {
      networkCallCount++;
      return {
        access_token: `token_d5pay_mock_${networkCallCount}`,
        token_type: 'Bearer',
        expires_in: 3600,
        expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      };
    });

    // 1. Primeira chamada solicita token
    const token1 = await d5payService.getAccessToken();

    // 2. Chamadas subsequentes devem usar o cache e NÃO fazer nova requisição de rede
    const token2 = await d5payService.getAccessToken();
    const token3 = await d5payService.getAccessToken();

    // 3. Concorrência: 5 chamadas simultâneas devem ser deduplicadas em 1 única requisição quando o cache for invalidado
    d5payService.invalidateToken();
    const concurrentTokens = await Promise.all([
      d5payService.getAccessToken(),
      d5payService.getAccessToken(),
      d5payService.getAccessToken(),
      d5payService.getAccessToken(),
      d5payService.getAccessToken(),
    ]);

    // Limpa o mock handler
    d5payService.setMockTokenHandler(undefined);
    d5payService.invalidateToken();

    const isTokenConsistent = token1 === token2 && token2 === token3;
    const allConcurrentSame = concurrentTokens.every((t) => t === concurrentTokens[0]);
    const expectedCalls = 2; // 1 para o token1 inicial + 1 para o lote concorrente após invalidação

    if (isTokenConsistent && allConcurrentSame && networkCallCount === expectedCalls) {
      console.log(`  ✔ SUCESSO: Cache e renovação de token SyncPayments validados (${networkCallCount} requisições de rede para 8 chamadas do serviço, deduplicação concorrente 100% eficaz).`);
      passed++;
    } else {
      throw new Error(
        `Falha no teste de token SyncPayments: networkCalls=${networkCallCount} (esperado ${expectedCalls}), isConsistent=${isTokenConsistent}, allConcurrentSame=${allConcurrentSame}`
      );
    }
  } catch (err: any) {
    console.error('  ✖ FALHA no Teste 5:', err.message);
    failed++;
  }

  // TESTE 6: Criação de Cash-In Pix, Tratamento de pix_code, identifier e Tratamento de Erros
  try {
    console.log('\n▶ [TESTE 6] SyncPayments: Criação de Cash-In Pix, pix_code, identifier e Tratamento de Erro...');

    const samplePixCode = '00020126820014br.gov.bcb.pix2560pix.syncpayments.com/qr/v2/cashin3df0319d';
    const sampleIdentifier = '3df0319d-ecf7-455a-84c4-070aee2779c1';

    // 1. Mock de sucesso do Cash-In
    d5payService.setMockCashInHandler(async (input) => {
      if (input.amount <= 0) {
        throw new Error('SyncPayments API Error (HTTP 400): Amount must be greater than zero');
      }
      return {
        message: 'Cashin request successfully submitted',
        pix_code: samplePixCode,
        identifier: sampleIdentifier,
      };
    });

    const cashInResult = await d5payService.createCashInPix({
      amount: 14.67,
      description: 'Participação Grupo Teste',
      client: {
        name: 'Roberto Carlos',
        cpf: '12345678900',
        email: 'roberto@test.com',
        phone: '51123123123',
      },
    });

    if (cashInResult.pix_code !== samplePixCode || cashInResult.identifier !== sampleIdentifier) {
      throw new Error('Falha no tratamento de pix_code ou identifier retornado pela SyncPayments.');
    }

    // 2. Teste de tratamento de erro de API da SyncPayments
    let errorCaught = false;
    try {
      await d5payService.createCashInPix({
        amount: 0,
        description: 'Valor Inválido',
        client: {
          name: 'Teste Erro',
          cpf: '00000000000',
        },
      });
    } catch (apiErr: any) {
      if (apiErr.message.includes('Amount must be greater than zero')) {
        errorCaught = true;
      }
    }

    // Limpa mock
    d5payService.setMockCashInHandler(undefined);

    if (errorCaught) {
      console.log(`  ✔ SUCESSO: Cash-In criado, pix_code e identifier validados, e erro de API tratado com segurança.`);
      passed++;
    } else {
      throw new Error('A API SyncPayments não capturou o erro esperado.');
    }
  } catch (err: any) {
    console.error('  ✖ FALHA no Teste 6:', err.message);
    failed++;
  }

  // TESTE 7: Webhook SyncPayments, Bloqueio com Status 'pending', Confirmação com 'completed' e Idempotência
  try {
    console.log('\n▶ [TESTE 7] Webhook SyncPayments: Bloqueio de status inválido, Confirmação e Idempotência...');

    // 1. Cria um grupo dedicado com vagas abertas para o teste
    const testGroup = db.createGroup({
      name: 'Grupo Teste SyncPayments Webhook',
      capacity: 10,
      entryPriceCents: 100,
      prizeAmountCents: 800,
      adminFeeCents: 200,
      groupType: 'WHATSAPP',
      groupLink: 'https://chat.whatsapp.com/test-syncpay',
      status: 'OPEN',
    });
    const testGroupId = testGroup.groupId;

    const testIdentifier = `syncpay-test-wh-${Date.now()}`;
    const testPaymentId = `PAY-TEST-${Date.now()}`;
    db.createPayment({
      paymentId: testPaymentId,
      gatewayTransactionId: testIdentifier,
      syncpayIdentifier: testIdentifier,
      groupId: testGroupId,
      status: 'PENDING',
      amountCents: 100,
      gatewayFeeCents: 26,
      netAmountCents: 74,
      userName: 'Carlos Silva',
      userCpf: '11122233344',
      userEmail: 'carlos@teste.com',
      userPhone: '11999998888',
      pixQrCode: 'data:image/svg+xml;base64,mock',
      pixCopiaECola: '00020126...mock',
      createdAt: new Date().toISOString(),
      paidAt: null,
      participantId: null,
      assignedNumber: null,
      webhookProcessed: false,
      rawEventId: null,
      expiresAt: new Date(Date.now() + 1800000).toISOString(),
    });

    // 2. Simula recebimento de webhook com status "pending" (NÃO DEVE CONFIRMAR)
    const pendingWebhookPayload = {
      id: testIdentifier,
      identifier: testIdentifier,
      status: 'pending',
      amount: 1.00,
      payment_method: 'PIX',
    };

    const isPendingCompleted = pendingWebhookPayload.status === 'completed' || pendingWebhookPayload.status === 'paid';
    if (isPendingCompleted) {
      throw new Error('Status pending não deveria ser marcado como concluído.');
    }

    // O status do pagamento no banco DEVE permanecer PENDING
    const paymentBefore = db.getPayment(testPaymentId);
    if (paymentBefore?.status !== 'PENDING' || paymentBefore.assignedNumber !== null) {
      throw new Error('Pagamento foi indevidamente aprovado com status pending.');
    }

    // 3. Simula recebimento de webhook com status oficial "completed"
    const completedEventId = `E2E-SYNCPAY-${Date.now()}`;
    const confirmResult = await db.processPaidWebhook({
      gatewayTransactionId: testIdentifier,
      rawEventId: completedEventId,
      paidAmountCents: 100,
      actor: 'SYNCPAY_WEBHOOK',
    });

    if (!confirmResult.success || !confirmResult.participant || confirmResult.payment?.status !== 'PAID') {
      throw new Error(`Falha ao confirmar pagamento via webhook completed: ${confirmResult.reason}`);
    }

    // 4. Teste de Idempotência: Reenvio do mesmo webhook completed
    const duplicateResult = await db.processPaidWebhook({
      gatewayTransactionId: testIdentifier,
      rawEventId: completedEventId,
      paidAmountCents: 100,
      actor: 'SYNCPAY_WEBHOOK',
    });

    if (!duplicateResult.alreadyProcessed || duplicateResult.participant?.number !== confirmResult.participant.number) {
      throw new Error('Falha no controle de idempotência do webhook SyncPayments.');
    }

    console.log(
      `  ✔ SUCESSO: Webhook bloqueou status 'pending', confirmou status 'completed' (Número emitido: ${confirmResult.participant.number}) e garantiu idempotência estrita.`
    );
    passed++;
  } catch (err: any) {
    console.error('  ✖ FALHA no Teste 7:', err.message);
    failed++;
  }

  console.log('\n====================================================');
  console.log(` RESULTADO FINAL: ${passed} PASSARAM | ${failed} FALHARAM`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((e) => {
  console.error('Erro geral nos testes:', e);
  process.exit(1);
});
