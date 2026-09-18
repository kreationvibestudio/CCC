/** Wallet dial fill: ₦0 empty, ₦20,000+ full. Amount is still shown as Naira. */
export const TERMII_WALLET_DIAL_CAP = 20_000;
export const TERMII_WALLET_LOW = 1_000;

export function formatTermiiWallet(balance: number, currency = "NGN"): string {
  const code = currency.trim() || "NGN";
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(balance);
  } catch {
    return `${code} ${balance.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
  }
}

export function termiiWalletTone(balance: number): "ok" | "low" | "empty" {
  if (balance <= 0) return "empty";
  if (balance < TERMII_WALLET_LOW) return "low";
  return "ok";
}

export function termiiWalletFill(balance: number, cap = TERMII_WALLET_DIAL_CAP): number {
  if (!Number.isFinite(balance) || balance <= 0 || cap <= 0) return 0;
  return Math.max(0.06, Math.min(1, balance / cap));
}
