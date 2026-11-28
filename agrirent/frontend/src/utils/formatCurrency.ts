/**
 * Formats numeric values to Indian Rupee (INR) representation with Indian digit grouping.
 * Example: 250000 -> "₹2,50,000"
 */
export function formatINR(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return '₹0';
  }

  const num = Number(amount);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Formats paise (minor units) to Rupee representation.
 */
export function formatPaiseToINR(paise: number | null | undefined): string {
  if (paise === null || paise === undefined || isNaN(Number(paise))) {
    return '₹0';
  }
  return formatINR(Number(paise) / 100);
}
