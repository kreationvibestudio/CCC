"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/lib/auth/session";
import type { Permission } from "@/types/auth";
import { TABLE_RULES, pickAllowedColumns, type ManagedTable } from "@/lib/modules/table-rules";

function rulesFor(table: string): { table: ManagedTable; view: Permission; manage: Permission } | null {
  const rules = TABLE_RULES[table as ManagedTable];
  if (!rules) return null;
  return { table: table as ManagedTable, view: rules.view, manage: rules.manage };
}

export async function deleteRecord(table: string, id: string, revalidate: string) {
  const rules = rulesFor(table);
  if (!rules) return { error: "Invalid table" };
  const gate = await authorize(rules.manage);
  if (!gate.ok) return { error: gate.error };
  const supabase = await createClient();
  const { error } = await supabase
    .from(rules.table)
    .delete()
    .eq("id", id)
    .eq("tenant_id", gate.user.profile.tenant_id);
  if (error) return { error: error.message };
  revalidatePath(revalidate);
  return { success: true };
}

export async function getRecord<T>(table: string, id: string): Promise<T | null> {
  const rules = rulesFor(table);
  if (!rules) return null;
  const gate = await authorize(rules.view);
  if (!gate.ok) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from(rules.table)
    .select("*")
    .eq("id", id)
    .eq("tenant_id", gate.user.profile.tenant_id)
    .single();
  return data as T | null;
}

/**
 * Update a record through the generic module CRUD layer.
 *
 * `updates` arrives from the client, so it is filtered against a per-table
 * column allowlist. Without that, a caller could rewrite columns the UI never
 * exposes -- tenant_id, assigned_agent_id, or anything else on the row.
 * Unknown columns fail the whole call rather than being dropped silently, so a
 * renamed field surfaces as an error instead of a no-op save.
 */
export async function updateRecord(
  table: string,
  id: string,
  updates: Record<string, unknown>,
  revalidate: string
) {
  const rules = rulesFor(table);
  if (!rules) return { error: "Invalid table" };
  const gate = await authorize(rules.manage);
  if (!gate.ok) return { error: gate.error };

  const picked = pickAllowedColumns(rules.table, updates);
  if (picked.rejected.length > 0) {
    return { error: `Cannot update: ${picked.rejected.join(", ")}` };
  }
  if (Object.keys(picked.updates).length === 0) return { error: "Nothing to update" };

  const supabase = await createClient();
  const { error } = await supabase
    .from(rules.table)
    .update(picked.updates)
    .eq("id", id)
    .eq("tenant_id", gate.user.profile.tenant_id);
  if (error) return { error: error.message };
  revalidatePath(revalidate);
  return { success: true };
}
