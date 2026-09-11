export type DonationSummaryRow = {
  amount: number | string | null;
  contact_id?: string | null;
};

export function summarizeDonations(rows: DonationSummaryRow[]) {
  const raised = rows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const giftCount = rows.length;
  const named = new Set<string>();
  let unnamed = 0;
  for (const row of rows) {
    const id = (row.contact_id ?? "").trim();
    if (id) named.add(id);
    else unnamed += 1;
  }
  const uniqueDonors = named.size + unnamed;
  const average = giftCount ? raised / giftCount : 0;
  return { raised, giftCount, uniqueDonors, average };
}

export function fundraisingProgress(raised: number, goal: number) {
  if (!(goal > 0)) return 0;
  return Math.min(100, Math.round((raised / goal) * 100));
}

export function paymentMethodLabel(method?: string | null) {
  const raw = (method ?? "").trim();
  if (!raw) return "Unknown";
  if (raw === "paystack") return "Paystack";
  if (raw.startsWith("paystack_")) {
    const channel = raw.slice("paystack_".length).replace(/_/g, " ");
    return channel ? `Paystack (${channel})` : "Paystack";
  }
  return raw.replace(/_/g, " ");
}
