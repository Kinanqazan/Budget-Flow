export function formatPercentage(value: number, total: number): string {
  if (total <= 0) return "0%";

  const percentage = (value / total) * 100;
  if (percentage > 0 && percentage < 0.05) return "<0.1%";
  return `${percentage.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
}
