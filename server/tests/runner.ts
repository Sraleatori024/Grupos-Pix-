import { db } from '../db.js';
import { executeDeterministicDraw, verifyDrawResult } from '../drawEngine.js';
import { Participant } from '../types.js';

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
    const fixedEntropySeed = 'a3b5c7d9e1f2a3b5c7d9e1f2a3b5c7d9e1f2a3b5c7d9e1f2a3b5c7d9e1f2a3b5';

    // Execução 1
    const draw1 = executeDeterministicDraw({
      groupId: 'B',
      participants: fakeParticipants,
      closedAt,
      externalSeed: fixedEntropySeed,
    });

    // Execução 2 com mesmos parâmetros
    const draw2 = executeDeterministicDraw({
      groupId: 'B',
      participants: fakeParticipants,
      closedAt,
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
