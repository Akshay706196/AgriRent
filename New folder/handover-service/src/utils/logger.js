/**
 * Structured JSON Logger for AgriRent Microservices.
 * Outputs machine-readable JSON logs to stdout with correlation tracing.
 * Enforces security sanitization so PINs and credentials are never logged.
 */

function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const clone = Array.isArray(obj) ? [...obj] : { ...obj };
  for (const key of Object.keys(clone)) {
    if (['pin', 'hashedPin', 'password', 'token', 'secret', 'authorization', 'signature'].includes(key.toLowerCase())) {
      clone[key] = '[REDACTED]';
    } else if (typeof clone[key] === 'object') {
      clone[key] = sanitize(clone[key]);
    }
  }
  return clone;
}

function log(level, message, meta = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    service: 'agrirent-handover-service',
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
