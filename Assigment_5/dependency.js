'use strict';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const jitter = max => Math.floor(Math.random() * max);

/**
 * Calls the equipment service. Retries only GET (safe/read-only) on network errors,
 * 408, 429 and 5xx. Never retries a 4xx response. URL comes only from environment.
 */
async function getEquipment(equipmentId, options = {}) {
  const baseUrl = options.baseUrl ?? process.env.EQUIPMENT_SERVICE_URL;
  if (!baseUrl) throw new Error('EQUIPMENT_SERVICE_URL is not configured');
  const attempts = options.attempts ?? 3;
  const timeoutMs = options.timeoutMs ?? 1200;
  const fetchImpl = options.fetchImpl ?? global.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('Node.js 18+ fetch is required');

  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const url = `${baseUrl.replace(/\/$/, '')}/api/equipment/${encodeURIComponent(equipmentId)}`;
      const response = await fetchImpl(url, { method: 'GET', headers: { Accept: 'application/json' }, signal: controller.signal });
      clearTimeout(timer);
      if (response.status >= 400 && response.status < 500) {
        const err = new Error(`Equipment service returned ${response.status}`);
        err.status = response.status;
        throw err;
      }
      if (response.status >= 500) {
        lastError = new Error(`Equipment service returned ${response.status}`);
      } else {
        if (!response.ok) throw new Error(`Unexpected equipment service status ${response.status}`);
        return await response.json();
      }
    } catch (err) {
      clearTimeout(timer);
      if (err.status && err.status >= 400 && err.status < 500) throw err;
      lastError = err;
    }
    if (attempt < attempts - 1) {
      const exponential = 100 * (2 ** attempt);
      await sleep(exponential + jitter(Math.max(1, exponential)));
    }
  }
  throw lastError || new Error('Equipment service unreachable');
}
module.exports = { getEquipment };
