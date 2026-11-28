/**
 * Structured JSON Logger.
 * Emits JSON logs to stdout including timestamp, level, correlationId, and message.
 * Redacts sensitive fields such as tokens, passwords, card numbers, and cvvs.
 */

const SENSITIVE_KEYS = ['authorization', 'token', 'password', 'card', 'cvv', 'secret', 'key'];

function redact(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redact);

  const cleaned = {};
  for (const [k, v] of Object.entries(obj)) {
    const isSensitive = SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s));
    if (isSensitive) {
      cleaned[k] = '[REDACTED]';
    } else if (typeof v === 'object' && v !== null) {
      cleaned[k] = redact(v);
    } else {
      cleaned[k] = v;
    }
  }
  return cleaned;
}

class Logger {
  log(level, message, meta = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId: meta.correlationId || 'unknown',
      ...redact(meta),
    };

    if (process.env.NODE_ENV !== 'test') {
      const output = JSON.stringify(logEntry);
      if (level === 'error') {
        console.error(output);
      } else {
        console.log(output);
      }
    }
  }

  info(message, meta) {
    this.log('info', message, meta);
  }

  warn(message, meta) {
    this.log('warn', message, meta);
  }

  error(message, meta) {
    this.log('error', message, meta);
  }

  debug(message, meta) {
    if (process.env.LOG_LEVEL === 'debug') {
      this.log('debug', message, meta);
    }
  }
}

module.exports = new Logger();
