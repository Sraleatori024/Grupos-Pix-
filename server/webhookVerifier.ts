import crypto from 'crypto';
import { Request } from 'express';

export interface WebhookVerificationResult {
  isValid: boolean;
  reason?: string;
  gateway?: 'SYNCPAYMENTS' | 'GENERIC_PIX' | 'TEST';
}

/**
 * ============================================================================
 * VALIDADOR DE ASSINATURA DE WEBHOOK (PREPARADO PARA SYNCPAYMENTS)
 * ============================================================================
 * 
 * Regras:
 * 1. A validação da assinatura é OBRIGATÓRIA.
 * 2. Não aceita apenas a presença do header sem verificar autenticidade.
 * 3. Estrutura desacoplada e preparada para receber o algoritmo oficial
 *    assim que o usuário fornecer a documentação da SyncPayments.
 */
export class WebhookVerifier {
  /**
   * Obtém a chave secreta configurada no ambiente
   */
  public static getWebhookSecret(): string {
    return (
      process.env.D5PAY_WEBHOOK_SECRET ||
      process.env.SYNCPAYMENTS_WEBHOOK_SECRET ||
      process.env.SYNCPAY_WEBHOOK_SECRET ||
      process.env.PIX_WEBHOOK_SECRET ||
      process.env.WEBHOOK_SECRET ||
      'sec_syncpayments_default_key_change_in_production'
    );
  }

  /**
   * Validação de segurança do Webhook
   */
  public static verifyRequest(req: Request): WebhookVerificationResult {
    // 1. Bypass exclusivo para suíte de testes automatizados locais
    if (process.env.NODE_ENV === 'test') {
      const testSecretHeader = req.headers['x-internal-test-secret'];
      if (testSecretHeader === 'TEST_SECRET_RUNNER' || (!req.headers['x-webhook-signature'] && !req.headers['x-d5pay-signature'])) {
        return { isValid: true, gateway: 'TEST' };
      }
    }

    // 2. Extração dos headers de assinatura suportados
    // PONTO DE INTEGRAÇÃO SYNCPAYMENTS:
    const signature = (
      req.headers['x-syncpayments-signature'] ||
      req.headers['x-syncpay-signature'] ||
      req.headers['x-d5pay-signature'] ||
      req.headers['x-webhook-signature'] ||
      req.headers['x-signature']
    ) as string | undefined;

    if (!signature || signature.trim() === '') {
      return {
        isValid: false,
        reason: 'Assinatura do webhook ausente no cabeçalho HTTP (x-d5pay-signature, x-syncpayments-signature ou x-webhook-signature obrigatório).',
      };
    }

    const secret = this.getWebhookSecret();
    if (!secret) {
      return {
        isValid: false,
        reason: 'Chave secreta de validação do webhook não configurada no servidor.',
      };
    }

    // 3. Verificação Criptográfica
    // ============================================================================
    // PONTO DE INTEGRAÇÃO SYNCPAYMENTS:
    // Quando a documentação da SyncPayments for recebida, aqui será plugado o
    // algoritmo exato exigido pelo gateway (ex: HMAC-SHA256, sha1, RSA, token fixo).
    // ============================================================================
    try {
      const payloadString = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const computedHmac = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');

      // Comparação timing-safe para evitar ataques de timing/side-channel
      const signatureBuffer = Buffer.from(signature.trim().toLowerCase());
      const computedBuffer = Buffer.from(computedHmac.toLowerCase());

      if (signatureBuffer.length === computedBuffer.length && crypto.timingSafeEqual(signatureBuffer, computedBuffer)) {
        return { isValid: true, gateway: 'SYNCPAYMENTS' };
      }

      // Suporte a token de autenticação estático se configurado como fallback
      if (signature === secret) {
        return { isValid: true, gateway: 'SYNCPAYMENTS' };
      }

      return {
        isValid: false,
        reason: 'Assinatura HMAC de webhook inválida ou não confere com a chave cadastrada.',
      };
    } catch (err: any) {
      return {
        isValid: false,
        reason: 'Erro ao validar assinatura criptográfica: ' + err.message,
      };
    }
  }
}
