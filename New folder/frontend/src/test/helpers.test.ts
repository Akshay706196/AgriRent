import { describe, it, expect } from 'vitest';
import { calculateRentalDays, formatRentalRange, getApprovalDeadline } from '../utils/formatDate';
import { formatINR } from '../utils/formatCurrency';

describe('formatDate and Rental Conventions', () => {
  it('calculates rental days with strictly exclusive end date [startDate, endDate)', () => {
    // 1 Nov to 3 Nov = exactly 2 days
    const days = calculateRentalDays('2026-11-01', '2026-11-03');
    expect(days).toBe(2);

    // Same day rental: 1 Nov to 1 Nov = 0 days
    expect(calculateRentalDays('2026-11-01', '2026-11-01')).toBe(0);

    // 1 Nov to 2 Nov = 1 day
    expect(calculateRentalDays('2026-11-01', '2026-11-02')).toBe(1);
  });

  it('formats rental range displaying exclusive duration', () => {
    const formatted = formatRentalRange('2026-11-01', '2026-11-03');
    expect(formatted).toContain('2 days');
  });

  it('calculates 24-hour approval deadline correctly', () => {
    const created = '2026-11-01T10:00:00.000Z';
    const deadline = getApprovalDeadline(created);
    expect(deadline).toBe('2026-11-02T10:00:00.000Z');

    // Handles undefined or invalid date gracefully
    expect(getApprovalDeadline(undefined)).toBeUndefined();
    expect(getApprovalDeadline(null)).toBeUndefined();
    expect(getApprovalDeadline('invalid-date')).toBeUndefined();
  });
});

describe('formatINR Currency Helpers', () => {
  it('formats Indian rupees with Indian grouping separator', () => {
    expect(formatINR(5000)).toMatch(/₹\s?5,000/);
    expect(formatINR(250000)).toMatch(/₹\s?2,50,000/);
    expect(formatINR(0)).toMatch(/₹\s?0/);
  });
});
