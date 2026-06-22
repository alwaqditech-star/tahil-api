/** تكاليف معتمدة للمشروع: مصروفات معتمدة + مستخلصات معتمدة/مدفوعة + مشتريات */
export function sumProjectCosts(
  approvedExpenses: number,
  approvedExtracts: number,
  purchases: number,
) {
  return approvedExpenses + approvedExtracts + purchases;
}

export function calcProfitMargin(contractValue: number, totalCosts: number) {
  if (contractValue <= 0) return 0;
  return Math.round(((contractValue - totalCosts) / contractValue) * 1000) / 10;
}

export const EXTRACT_COST_STATUSES = ["approved", "paid"] as const;
