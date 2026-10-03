export function formatInr(value: number, options?: { compact?: boolean }): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
    notation: options?.compact ? "compact" : "standard",
  }).format(value);
}

export function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}m ${rest}s`;
}

export function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatMultiple(value: number): string {
  return `${value.toFixed(1)}×`;
}
