"use server";

import { authorize } from "@/lib/auth/session";
import { getTermiiAccount } from "./client";

export async function getTermiiWallet() {
  const gate = await authorize(
    "communications.view",
    "communications.send",
    "training.view",
    "training.manage",
    "admin.users"
  );
  if (!gate.ok) return { ok: false as const, error: gate.error };
  const account = await getTermiiAccount();
  if (!account.ok) return { ok: false as const, error: account.error ?? "Could not read the Termii wallet." };
  return {
    ok: true as const,
    balance: account.balance ?? 0,
    currency: account.currency ?? "NGN",
  };
}
