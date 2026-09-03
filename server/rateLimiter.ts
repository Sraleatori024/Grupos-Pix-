import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

/**
 * Limitador de taxa baseado em janela deslizante por IP
 */
export function createRateLimiter(options: {
  windowMs: number; // Janela de tempo em milissegundos
  maxRequests: number; // Máximo de requisições permitidas na janela
  message?: string;
  name?: string;
}) {
  const store = new Map<string, RateLimitRecord>();

  // Limpeza periódica de IPs expirados para evitar vazamento de memória
  setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of store.entries()) {
      if (now > record.resetAt) {
        store.delete(ip);
      }
    }
  }, Math.max(30000, options.windowMs)).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    // Ignorar em ambiente de teste automatizado
    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    // Extrai o IP real do cliente
    const forwarded = req.headers['x-forwarded-for'];
    const ip =
      (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') ||
      req.socket.remoteAddress ||
      'unknown-ip';

    const now = Date.now();
    const record = store.get(ip);

    if (!record || now > record.resetAt) {
      store.set(ip, {
        count: 1,
        resetAt: now + options.windowMs,
      });
      res.setHeader('X-RateLimit-Limit', options.maxRequests);
      res.setHeader('X-RateLimit-Remaining', options.maxRequests - 1);
      return next();
    }

    if (record.count >= options.maxRequests) {
      const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      res.setHeader('X-RateLimit-Limit', options.maxRequests);
      res.setHeader('X-RateLimit-Remaining', 0);
      return res.status(429).json({
        error:
          options.message ||
          'Muitas requisições. Por favor, aguarde alguns instantes antes de tentar novamente.',
        retryAfterSeconds,
      });
    }

    record.count++;
    res.setHeader('X-RateLimit-Limit', options.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, options.maxRequests - record.count));
    next();
  };
}

// Limitador para criação de cobranças Pix (15 por minuto por IP)
export const paymentCreateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 15,
  name: 'PaymentCreate',
  message: 'Limite de criação de cobranças atingido. Aguarde 1 minuto.',
});

// Limitador para polling de status do pagamento (150 por minuto por IP - permite polling a cada 2s com folga)
export const paymentPollingLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 150,
  name: 'PaymentPolling',
  message: 'Excesso de consultas de status. Aguarde alguns instantes.',
});

// Limitador para busca pública de participantes (40 por minuto por IP)
export const participantSearchLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 40,
  name: 'ParticipantSearch',
  message: 'Limite de buscas por minuto atingido. Aguarde alguns instantes.',
});

// Limitador para o endpoint de webhook do gateway (300 por minuto)
export const webhookLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 300,
  name: 'Webhook',
  message: 'Taxa máxima de webhooks excedida.',
});
