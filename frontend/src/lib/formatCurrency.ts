const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
});

/** Format a decimal amount string or number as Indian Rupees. */
export function formatInr(amount: string | number): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (Number.isNaN(value)) {
    return amount.toString();
  }
  return inrFormatter.format(value);
}
