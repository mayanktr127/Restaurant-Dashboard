/**
 * Helper functions for money calculations and formatting.
 * All monetary amounts in the database are stored as integer cents.
 */

export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100)
}

export function toCents(dollars: number | string): number {
  if (typeof dollars === "number") {
    return Math.round(dollars * 100)
  }
  const clean = dollars.replace(/[^0-9.-]+/g, "")
  const num = parseFloat(clean)
  if (isNaN(num)) return 0
  return Math.round(num * 100)
}

