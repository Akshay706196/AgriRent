/**
 * Structured JSON Logger for AgriRent Microservices.
 * Outputs machine-readable JSON logs to stdout with correlation tracing.
 * Enforces security sanitization so tokens, secrets, full feedback and evidence text are never logged.
 */

function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const clone = Array.isArray(obj) ? [...obj] : { ...obj };
  for (const key of Object.keys(clone)) {
    const lowerKey = key.toLowerCase();
    if (['pin', 'hashedpin', 'password', 'token', 'secret', 'authorization', 'signature'].includes(lowerKey)) {
      clone[key] = '[REDACTED]';
    } else if (['feedback', 'evidence', 'notes', 'reason'].includes(lowerKey)) {
      if (typeof clone[key] === 'string' && clone[key].length > 40) {
        clone[key] = clone[key].substring(0, 40) + '... [TRUNCATED]';
      }
    } else if (typeof clone[key] === 'object') {
      clone[key] = sanitize(clone[key]);
    }
  }
  return clone;
}

function log(level, message, meta = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    service: 'agrirent-claims-service',
    level,
    message,
    ...sanitize(meta),
  };

  const output = JSON.stringify(logEntry);
  if (level === 'ERROR') {
    process.stderr.write(output + '\n');
  } else {
    process.stdout.write(output + '\n');
  }
}

module.exports = {
  info: (msg, meta) => log('INFO', msg, meta),
  warn: (msg, meta) => log('WARN', msg, meta),
  error: (msg, meta) => log('ERROR', msg, meta),
  debug: (msg, meta) => {
    if (process.env.NODE_ENV !== 'production') {
      log('DEBUG', msg, meta);
    }
  },
};
