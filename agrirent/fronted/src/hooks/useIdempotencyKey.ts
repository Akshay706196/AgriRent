import { useState, useCallback } from 'react';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generates an Idempotency-Key once per user action and preserves it across
 * component re-renders, retries, and double clicks.
 * Can be explicitly reset only when a genuinely new action starts.
 */
export function useIdempotencyKey(actionPrefix: string = 'act') {
  const [key, setKey] = useState<string>(() => `${actionPrefix}-${generateUUID()}`);

  const resetKey = useCallback(() => {
    const fresh = `${actionPrefix}-${generateUUID()}`;
    setKey(fresh);
    return fresh;
  }, [actionPrefix]);

  return { key, resetKey, refreshKey: resetKey };
}
