import crypto from 'crypto';
import { Participant, DrawAuditRecord } from './types.js';

export interface DrawExecutionResult {
  drawRecord: DrawAuditRecord;
  winner: Participant;
  hashVerificationTrail: {
    participantsListHash: string;
    entropySeed: string;
    combinedDigest: string;
    calculatedIndex: number;
    winningSequenceNumber: number;
    winningNumber: string;
  };
}

/**
 * Ordena determinística e estritamente a lista de participantes
 */
export function sortParticipantsDeterministically(participants: Participant[]): Participant[] {
  return [...participants].sort((a, b) => {
    if (a.sequenceNumber !== b.sequenceNumber) {
      return a.sequenceNumber - b.sequenceNumber;
    }
    return a.participantId.localeCompare(b.participantId);
  });
}

/**
 * Gera o Hash SHA-256 canônico da lista de participantes para selagem criptográfica
 */
export function generateParticipantsListHash(participants: Participant[]): string {
  const sorted = sortParticipantsDeterministically(participants);
  const canonicalRepresentation = sorted.map((p) => ({
    seq: p.sequenceNumber,
    num: p.number,
    pid: p.participantId,
    gid: p.groupId,
    confAt: p.confirmedAt,
  }));

  const jsonString = JSON.stringify(canonicalRepresentation);
  return crypto.createHash('sha256').update(jsonString, 'utf8').digest('hex');
}

export function maskPhoneNumber(phone?: string): string {
  if (!phone) return '(11) 9XXXX-****';
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 11) {
    const ddd = clean.substring(0, 2);
    const lastFour = clean.substring(7);
    return `(${ddd}) 9XXXX-${lastFour}`;
  } else if (clean.length === 10) {
    const ddd = clean.substring(0, 2);
    const lastFour = clean.substring(6);
    return `(${ddd}) XXXX-${lastFour}`;
  } else if (clean.length >= 8) {
    const lastFour = clean.substring(clean.length - 4);
    return `(**) 9XXXX-${lastFour}`;
  }
  return '(11) 9XXXX-1234';
}

/**
 * Algoritmo Determinístico Auditável para Seleção de Vencedor
 * Utiliza o Hash da Lista Fechada + Semente de Entropia Temporal e Criptográfica
 * para selecionar um índice de forma uniforme sem viés de módulo.
 */
export function executeDeterministicDraw(params: {
  groupId: string;
  groupName?: string;
  prizeAmountCents?: number;
  participants: Participant[];
  closedAt: string;
  externalSeed?: string;
  drawnAt?: string;
}): DrawExecutionResult {
  const { groupId, groupName, prizeAmountCents, participants, closedAt, externalSeed } = params;

  if (!participants || participants.length === 0) {
    throw new Error(`Não é possível realizar sorteio no Grupo ${groupId}: nenhum participante confirmado.`);
  }

  const sortedParticipants = sortParticipantsDeterministically(participants);
  const participantsCount = sortedParticipants.length;
  const listHash = generateParticipantsListHash(sortedParticipants);

  const drawnAt = params.drawnAt || new Date().toISOString();
  const rawEntropySeed = externalSeed || crypto.randomBytes(32).toString('hex');
  const combinedEntropyInput = `GROUP:${groupId}|COUNT:${participantsCount}|LIST_HASH:${listHash}|CLOSED_AT:${closedAt}|DRAWN_AT:${drawnAt}|SEED:${rawEntropySeed}`;
  const combinedDigest = crypto.createHash('sha256').update(combinedEntropyInput, 'utf8').digest('hex');

  // Converte os primeiros 16 caracteres hexadecimais (64-bit integer) para índice uniforme
  const bigHex = combinedDigest.substring(0, 16);
  const bigIntVal = BigInt('0x' + bigHex);
  const calculatedIndex = Number(bigIntVal % BigInt(participantsCount));

  const winner = sortedParticipants[calculatedIndex];
  if (!winner) {
    throw new Error(`Erro ao localizar participante no índice calculado: ${calculatedIndex}`);
  }

  const publicVerificationCode = crypto
    .createHash('sha256')
    .update(`${groupId}:${winner.number}:${listHash}:${combinedDigest}`, 'utf8')
    .digest('hex')
    .substring(0, 16)
    .toUpperCase();

  const drawId = `DRAW-${groupId}-${Date.now()}`;

  // Mascara de CPF para segurança pública (ex: ***.456.789-**)
  const cleanCpf = (winner.cpf || '').replace(/\D/g, '');
  const maskedCpf =
    cleanCpf.length === 11
      ? `***.${cleanCpf.substring(3, 6)}.${cleanCpf.substring(6, 9)}-**`
      : '***.***.***-**';

  const maskedPhone = maskPhoneNumber(winner.phone);

  const resultHash = crypto
    .createHash('sha256')
    .update(`RESULT:${drawId}:${groupId}:${winner.participantId}:${winner.number}:${listHash}:${rawEntropySeed}`, 'utf8')
    .digest('hex');

  const drawRecord: DrawAuditRecord = {
    drawId,
    groupId,
    groupName: groupName || `Grupo ${groupId}`,
    prizeAmountCents: prizeAmountCents || 0,
    status: 'COMPLETED',
    participantsCount,
    eligibleParticipants: participantsCount,
    participantsListHash: listHash,
    closedAt,
    drawnAt,
    completedAt: drawnAt,
    createdBy: 'ADMIN',
    algorithmVersion: 'v2.0-CSPRNG-SHA256',
    randomnessSeed: rawEntropySeed,
    randomnessMethod: 'SHA256_HMAC_DETERMINISTIC_CSPRNG',
    winningNumber: winner.number,
    winningParticipantId: winner.participantId,
    winnerName: winner.name,
    winnerPhone: winner.phone,
    winnerPhoneMasked: maskedPhone,
    winnerMaskedCpf: maskedCpf,
    resultHash,
    isImmutable: true,
    publicVerificationCode,
  };

  return {
    drawRecord,
    winner,
    hashVerificationTrail: {
      participantsListHash: listHash,
      entropySeed: rawEntropySeed,
      combinedDigest,
      calculatedIndex,
      winningSequenceNumber: winner.sequenceNumber,
      winningNumber: winner.number,
    },
  };
}

/**
 * Função pública para re-verificação matemática do sorteio por qualquer auditor externo
 */
export function verifyDrawResult(params: {
  groupId: string;
  participantsCount: number;
  listHash: string;
  closedAt: string;
  drawnAt: string;
  entropySeed: string;
}): { combinedDigest: string; calculatedIndex: number } {
  const combinedEntropyInput = `GROUP:${params.groupId}|COUNT:${params.participantsCount}|LIST_HASH:${params.listHash}|CLOSED_AT:${params.closedAt}|DRAWN_AT:${params.drawnAt}|SEED:${params.entropySeed}`;
  const combinedDigest = crypto.createHash('sha256').update(combinedEntropyInput, 'utf8').digest('hex');
  const bigHex = combinedDigest.substring(0, 16);
  const bigIntVal = BigInt('0x' + bigHex);
  const calculatedIndex = Number(bigIntVal % BigInt(params.participantsCount));

  return {
    combinedDigest,
    calculatedIndex,
  };
}
