import crypto from 'crypto';

export interface SyncPayTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at?: string;
}

export interface CachedToken {
  accessToken: string;
  tokenType: string;
  expiresAtTimestamp: number; // Timestamp em milissegundos
}

export interface SyncPayConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
  webhookUrl: string;
  timeoutMs: number;
}

export interface CashInClient {
  name: string;
  cpf: string;
  email?: string;
  phone?: string;
}

export interface CashInPixInput {
  amount: number; // Ex: 14.67 (em Reais, duas casas decimais)
  description: string;
  webhookUrl?: string;
  client: CashInClient;
  split?: any[];
}

export interface CashInPixResponse {
  message: string;
  pix_code: string;
  identifier: string;
  rawResponse?: any;
}

/**
 * ============================================================================
 * SERVIÇO OFICIAL SYNCPAYMENTS / D5PAY (BACKEND EXCLUSIVO)
 * ============================================================================
 * 
 * Regras de Arquitetura e Segurança:
 * 1. O SYNCPAY_CLIENT_SECRET e SYNCPAY_CLIENT_ID NUNCA são expostos ao frontend.
 * 2. A autenticação com a API SyncPayments utiliza exclusivamente SYNCPAY_CLIENT_ID e SYNCPAY_CLIENT_SECRET.
 * 3. O access_token é gerenciado estritamente em memória no backend.
 * 4. Cache inteligente com renovação antecipada (margem de segurança de 120s).
 * 5. Deduplicação atômica de requisições de token concorrentes.
 * 6. Criação de Cash-In Pix através do endpoint oficial: POST /api/partner/v1/cash-in
 */
export class SyncPayService {
  private static instance: SyncPayService;
  private cachedToken: CachedToken | null = null;
  private inFlightTokenPromise: Promise<string> | null = null;

  // Handlers para mocks em suíte de testes automatizados
  private mockTokenHandler?: () => Promise<SyncPayTokenResponse>;
  private mockCashInHandler?: (input: CashInPixInput) => Promise<CashInPixResponse>;

  private constructor() {}

  public static getInstance(): SyncPayService {
    if (!SyncPayService.instance) {
      SyncPayService.instance = new SyncPayService();
    }
    return SyncPayService.instance;
  }

  /**
   * Obtém a configuração de variáveis de ambiente com suporte a fallbacks seguros.
   */
  public getConfig(): SyncPayConfig {
    const baseUrl = (
      process.env.SYNCPAY_BASE_URL ||
      process.env.SYNCPAYMENTS_BASE_URL ||
      process.env.D5PAY_BASE_URL ||
      'https://api.syncpayments.com.br/'
    ).replace(/\/$/, '');

    const clientId = (
      process.env.SYNCPAY_CLIENT_ID ||
      process.env.D5PAY_CLIENT_ID ||
      ''
    ).trim();

    const clientSecret = (
      process.env.SYNCPAY_CLIENT_SECRET ||
      process.env.D5PAY_CLIENT_SECRET ||
      ''
    ).trim();

    const webhookSecret = (
      process.env.SYNCPAY_WEBHOOK_SECRET ||
      process.env.SYNCPAYMENTS_WEBHOOK_SECRET ||
      process.env.D5PAY_WEBHOOK_SECRET ||
      process.env.PIX_WEBHOOK_SECRET ||
      ''
    ).trim();

    const appUrl = (
      process.env.APP_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '') ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
      ''
    ).replace(/\/$/, '');

    const webhookUrl = (
      process.env.SYNCPAY_WEBHOOK_URL ||
      (appUrl ? `${appUrl}/api/webhooks/syncpay` : '')
    );

    return {
      baseUrl,
      clientId,
      clientSecret,
      webhookSecret,
      webhookUrl,
      timeoutMs: 15000,
    };
  }

  /**
   * Indica se as credenciais essenciais de parceiro estão configuradas no backend.
   */
  public isConfigured(): boolean {
    const { clientId, clientSecret } = this.getConfig();
    return Boolean(clientId && clientSecret);
  }

  /**
   * Diagnóstico seguro sem vazar secrets.
   */
  public getStatus(): {
    configured: boolean;
    baseUrl: string;
    hasToken: boolean;
    tokenExpiresInSeconds?: number;
    expiresAt?: string;
    webhookUrl: string;
  } {
    const config = this.getConfig();
    const hasToken = Boolean(this.cachedToken);
    let tokenExpiresInSeconds: number | undefined;
    let expiresAt: string | undefined;

    if (this.cachedToken) {
      const remainingMs = this.cachedToken.expiresAtTimestamp - Date.now();
      tokenExpiresInSeconds = Math.max(0, Math.floor(remainingMs / 1000));
      expiresAt = new Date(this.cachedToken.expiresAtTimestamp).toISOString();
    }

    return {
      configured: this.isConfigured(),
      baseUrl: config.baseUrl,
      hasToken,
      tokenExpiresInSeconds,
      expiresAt,
      webhookUrl: config.webhookUrl,
    };
  }

  /**
   * Obtém o token de acesso válido, solicitando ou renovando conforme necessário.
   * Evita chamadas concorrentes através de in-flight promise.
   */
  public async getAccessToken(): Promise<string> {
    const now = Date.now();

    // 1. Reutiliza token em cache se ainda estiver válido com margem de segurança (120s)
    if (this.cachedToken && this.cachedToken.expiresAtTimestamp > now + 120000) {
      return this.cachedToken.accessToken;
    }

    // 2. Se houver uma renovação já em andamento, aguarda a mesma promise (deduplicação)
    if (this.inFlightTokenPromise) {
      return this.inFlightTokenPromise;
    }

    // 3. Dispara a requisição de novo token
    this.inFlightTokenPromise = this.requestNewToken()
      .then((token) => {
        this.inFlightTokenPromise = null;
        return token;
      })
      .catch((err) => {
        this.inFlightTokenPromise = null;
        throw err;
      });

    return this.inFlightTokenPromise;
  }

  /**
   * Executa a chamada HTTP POST para o endpoint oficial /api/partner/v1/auth-token
   */
  private async requestNewToken(): Promise<string> {
    if (this.mockTokenHandler) {
      const mockRes = await this.mockTokenHandler();
      return this.storeTokenResponse(mockRes);
    }

    const config = this.getConfig();

    if (!config.clientId || !config.clientSecret) {
      throw new Error(
        'SyncPayments: Credenciais ausentes (SYNCPAY_CLIENT_ID e/ou SYNCPAY_CLIENT_SECRET não configurados).'
      );
    }

    const endpointUrl = `${config.baseUrl}/api/partner/v1/auth-token`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: config.clientId,
          client_secret: config.clientSecret,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorDetails = '';
        try {
          const errJson = await response.json();
          errorDetails = errJson.message || errJson.error || JSON.stringify(errJson);
        } catch {
          errorDetails = await response.text().catch(() => '');
        }

        const sanitizedMsg = errorDetails.slice(0, 200);

        if (response.status === 401 || response.status === 403) {
          throw new Error(
            `SyncPayments Auth Error (HTTP ${response.status}): client_id ou client_secret inválidos.`
          );
        }

        if (response.status >= 500) {
          throw new Error(
            `SyncPayments Service Error (HTTP ${response.status}): Servidor SyncPayments indisponível temporariamente.`
          );
        }

        throw new Error(
          `SyncPayments Auth Error (HTTP ${response.status}): ${sanitizedMsg || 'Falha na autenticação da SyncPayments.'}`
        );
      }

      const data = (await response.json()) as SyncPayTokenResponse;
      return this.storeTokenResponse(data);
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err.name === 'AbortError') {
        throw new Error(
          `SyncPayments Timeout: Requisição de autenticação para ${config.baseUrl} excedeu ${config.timeoutMs / 1000}s.`
        );
      }

      // Sanitiza para garantir que credenciais nunca vazem nos logs
      let safeMessage = err.message || 'Erro ao autenticar na SyncPayments';
      if (config.clientSecret) {
        safeMessage = safeMessage.replace(new RegExp(config.clientSecret, 'g'), '[REDACTED_SECRET]');
      }
      if (config.clientId) {
        safeMessage = safeMessage.replace(new RegExp(config.clientId, 'g'), '[REDACTED_CLIENT_ID]');
      }

      throw new Error(safeMessage);
    }
  }

  /**
   * Armazena token em cache com margem de segurança de 120s.
   */
  public storeTokenResponse(data: SyncPayTokenResponse): string {
    if (!data || !data.access_token) {
      throw new Error('SyncPayments: Resposta de autenticação inválida (access_token ausente).');
    }

    const expiresInSec = typeof data.expires_in === 'number' ? data.expires_in : 3600;
    let expiresAtTimestamp = Date.now() + expiresInSec * 1000 - 120000;

    if (data.expires_at) {
      const parsedTime = new Date(data.expires_at).getTime();
      if (!isNaN(parsedTime)) {
        expiresAtTimestamp = Math.min(expiresAtTimestamp, parsedTime - 120000);
      }
    }

    const tokenType = data.token_type || 'Bearer';

    this.cachedToken = {
      accessToken: data.access_token,
      tokenType,
      expiresAtTimestamp,
    };

    return data.access_token;
  }

  /**
   * Invalida o token em cache na memória.
   */
  public invalidateToken(): void {
    this.cachedToken = null;
  }

  public setMockTokenHandler(handler?: () => Promise<SyncPayTokenResponse>): void {
    this.mockTokenHandler = handler;
  }

  public setMockCashInHandler(handler?: (input: CashInPixInput) => Promise<CashInPixResponse>): void {
    this.mockCashInHandler = handler;
  }

  /**
   * Executa requisições autenticadas com Authorization: Bearer <access_token>.
   * Auto-renova e tenta novamente 1x em caso de 401.
   */
  public async authenticatedRequest<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const config = this.getConfig();
    const token = await this.getAccessToken();
    const url = endpoint.startsWith('http')
      ? endpoint
      : `${config.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      let response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      // Se for 401, token expirou ou foi invalidado na API: refaz 1 tentativa
      if (response.status === 401) {
        this.invalidateToken();
        const freshToken = await this.getAccessToken();
        headers['Authorization'] = `Bearer ${freshToken}`;

        response = await fetch(url, {
          ...options,
          headers,
          signal: controller.signal,
        });
      }

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errBody = '';
        try {
          const errJson = await response.json();
          errBody = errJson.message || errJson.error || JSON.stringify(errJson);
        } catch {
          errBody = await response.text().catch(() => '');
        }

        throw new Error(
          `SyncPayments API Error (HTTP ${response.status}): ${errBody.slice(0, 200) || response.statusText}`
        );
      }

      return (await response.json()) as T;
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err.name === 'AbortError') {
        throw new Error(
          `SyncPayments Timeout: Requisição para ${endpoint} excedeu ${config.timeoutMs / 1000}s.`
        );
      }

      throw err;
    }
  }

  /**
   * ============================================================================
   * CRIAÇÃO DE CASH-IN / COBRANÇA PIX (POST /api/partner/v1/cash-in)
   * ============================================================================
   * 
   * Conforme documentação oficial:
   * Payload:
   * {
   *   "amount": 14.67,
   *   "description": "...",
   *   "webhook_url": "https://site.com/webhook",
   *   "client": { "name": "...", "cpf": "...", "email": "...", "phone": "..." },
   *   "split": []
   * }
   * 
   * Resposta documentada:
   * {
   *   "message": "Cashin request successfully submitted",
   *   "pix_code": "00020126820014br.gov.bcb.pix...",
   *   "identifier": "3df0319d-ecf7-455a-84c4-070aee2779c1"
   * }
   */
  public async createCashInPix(input: CashInPixInput): Promise<CashInPixResponse> {
    // 1. Permite interceptação por mock em testes automatizados
    if (this.mockCashInHandler) {
      const mockResult = await this.mockCashInHandler(input);
      if (!mockResult.pix_code || !mockResult.identifier) {
        throw new Error('Mock CashIn inválido: pix_code ou identifier ausente.');
      }
      return mockResult;
    }

    // 2. Validação de configuração
    if (!this.isConfigured()) {
      throw new Error(
        'SyncPayments não configurada: Credenciais SYNCPAY_CLIENT_ID e SYNCPAY_CLIENT_SECRET ausentes no backend.'
      );
    }

    const config = this.getConfig();
    const cleanCpf = input.client.cpf.replace(/\D/g, '');
    const cleanPhone = input.client.phone ? input.client.phone.replace(/\D/g, '') : '';
    const cleanEmail = input.client.email?.trim() || `${cleanPhone || 'cliente'}@participante.plataforma.com`;
    const resolvedWebhookUrl = input.webhookUrl || config.webhookUrl || 'https://site.com/api/webhooks/syncpay';

    const payload = {
      amount: Number(Number(input.amount).toFixed(2)),
      description: input.description.slice(0, 140),
      webhook_url: resolvedWebhookUrl,
      client: {
        name: input.client.name.trim(),
        cpf: cleanCpf,
        email: cleanEmail,
        phone: cleanPhone,
      },
      split: input.split || [],
    };

    const response = await this.authenticatedRequest<any>('/api/partner/v1/cash-in', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const pixCode = response.pix_code || response.data?.pix_code || response.qrcode || '';
    const identifier = response.identifier || response.data?.identifier || response.id || '';

    if (!pixCode || !identifier) {
      throw new Error(
        `SyncPayments: Resposta de Cash-In inesperada. pix_code ou identifier ausente no retorno da API.`
      );
    }

    return {
      message: response.message || 'Cashin request successfully submitted',
      pix_code: pixCode,
      identifier,
      rawResponse: response,
    };
  }
}

export const syncpayService = SyncPayService.getInstance();
// Alias para manter compatibilidade total
export const d5payService = syncpayService;
export { SyncPayService as D5PayService };
