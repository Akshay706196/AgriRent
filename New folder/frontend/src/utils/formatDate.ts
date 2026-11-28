import { format, differenceInCalendarDays, parseISO, isValid } from 'date-fns';

/**
 * Returns a human-readable date formatted in Indian locale.
 * Example: "25 Oct 2026"
 */
export function formatDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '—';
  const d = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput;
  if (!isValid(d)) return '—';
  return format(d, 'd MMM yyyy');
}

export const formatShortDate = formatDate;

/**
 * Returns date and time formatted in Indian locale.
 * Example: "25 Oct 2026, 03:30 PM"
 */
export function formatDateTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '—';
  const d = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput;
  if (!isValid(d)) return '—';
  return format(d, 'd MMM yyyy, hh:mm a');
}

/**
 * Calculates rental days under AgriRent's half-open interval rule [startDate, endDate),
 * where endDate is strictly exclusive.
 * Example: 1 Nov to 3 Nov = 2 rental days.
 */
export function calculateRentalDays(
  startDateStr: string | Date,
  endDateStr: string | Date
): number {
  if (!startDateStr || !endDateStr) return 0;
  const start = typeof startDateStr === 'string' ? parseISO(startDateStr) : startDateStr;
  const end = typeof endDateStr === 'string' ? parseISO(endDateStr) : endDateStr;

  if (!isValid(start) || !isValid(end)) return 0;

  const diff = differenceInCalendarDays(end, start);
  return Math.max(0, diff);
}

/**
 * Formats a date range according to the rental day convention.
 * Example: "1 Nov 2026 to 3 Nov 2026 (2 rental days)"
 */
export function formatRentalRange(startDateStr: string, endDateStr: string): string {
  const days = calculateRentalDays(startDateStr, endDateStr);
  const startFmt = formatDate(startDateStr);
  const endFmt = formatDate(endDateStr);
  return `${startFmt} – ${endFmt} (${days} ${days === 1 ? 'day' : 'days'})`;
}

/**
 * Calculates the 24-hour approval deadline from a booking creation timestamp.
 * Returns ISO string if createdAt is valid, or undefined otherwise.
 */
export function getApprovalDeadline(createdAt?: string | null): string | undefined {
  if (!createdAt) return undefined;
  const d = typeof createdAt === 'string' ? parseISO(createdAt) : createdAt;
  if (!isValid(d)) return undefined;
  return new Date(d.getTime() + 24 * 60 * 60 * 1000).toISOString();
}
