/**
 * Formats a numeric amount into localized currency (defaults to INR).
 */
export function formatCurrency(amount: number, currency: string = 'INR'): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      minimumFractionDigits: Number.isInteger(safeAmount) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(safeAmount);
  } catch {
    return `₹${safeAmount.toFixed(2)}`;
  }
}
