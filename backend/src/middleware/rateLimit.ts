import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';
import { AuditService } from '../services/audit.service';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
}

export const createRateLimiter = (options: RateLimitOptions) => {
  const store = new Map<string, RateLimitRecord>();

  // Periodically clean up expired keys
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (now > record.resetTime) {
        store.delete(key);
      }
    }
  }, 60000).unref();

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // In test environment, allow tests to pass without waiting unless explicitly testing rate limiter
    if (process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']) {
      next();
      return;
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${ip}:${req.baseUrl}${req.path}`;
    const now = Date.now();

    const record = store.get(key);

    if (!record || now > record.resetTime) {
      store.set(key, {
        count: 1,
        resetTime: now + options.windowMs,
      });
      next();
      return;
    }

    record.count += 1;

    if (record.count > options.max) {
      await AuditService.log({
        action: 'auth.rate_limit.exceeded',
        resourceType: 'network',
        ipAddress: ip,
        userAgent: req.headers['user-agent'],
        success: false,
        metadata: { path: req.originalUrl, count: record.count, max: options.max },
      });

      res.setHeader('Retry-After', Math.ceil((record.resetTime - now) / 1000));
      sendError(
        res,
        options.message || 'Too many attempts. Please try again later.',
        429
      );
      return;
    }

    next();
  };
};

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
  message: 'Too many authentication attempts from this IP address. Please wait 15 minutes before retrying.',
});

export const authLimiter = authRateLimiter;

export const webhookRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: 'Too many webhook requests from this IP address. Please slow down.',
});
