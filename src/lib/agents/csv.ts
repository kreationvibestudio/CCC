import { normalizeCollationRole, type AgentCollationRole } from "./identity-fields.ts";

export type AgentCsvRow = {
  puCode: string;
  email: string;
  fullName: string;
  phone: string;
  ward: string;
  membershipCardNumber: string;
  votersCardNumber: string;
  collationRole: AgentCollationRole;
};

function splitCsvLine(line: string) {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      quoted = !quoted;
      continue;
    }
    if (ch === "," && !quoted) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export function parseAgentAssignmentCsv(text: string): AgentCsvRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const idx = (names: string[]) => names.map((n) => header.indexOf(n)).find((i) => i >= 0) ?? -1;
  const puIdx = idx(["pu_code", "pucode", "code", "polling_unit", "pu"]);
  const emailIdx = idx(["email", "e-mail"]);
  const nameIdx = idx(["full_name", "name", "agent", "agent_name"]);
  const phoneIdx = idx(["phone", "mobile", "tel", "phone_number"]);
  const wardIdx = idx(["ward"]);
  const membershipIdx = idx([
    "membership_card_number",
    "membership_card",
    "membership_number",
    "membership",
  ]);
  const votersIdx = idx([
    "voters_card_number",
    "voter_card_number",
    "voters_card",
    "voter_card",
    "pvc",
    "vin",
  ]);
  const collationIdx = idx(["collation_role", "collation", "collation_agent"]);
  if (puIdx < 0) return [];

  const rows: AgentCsvRow[] = [];
  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line);
    const puCode = (cols[puIdx] ?? "").trim();
    const email = (emailIdx >= 0 ? cols[emailIdx] ?? "" : "").trim().toLowerCase();
    if (!puCode) continue;
    if (email && !email.includes("@")) continue;
    const fullName =
      (nameIdx >= 0 ? cols[nameIdx] : "")?.trim() || (email.includes("@") ? email.split("@")[0] : "");
    rows.push({
      puCode,
      email,
      fullName,
      phone: (phoneIdx >= 0 ? cols[phoneIdx] : "")?.trim() || "",
      ward: (wardIdx >= 0 ? cols[wardIdx] : "")?.trim() || "",
      membershipCardNumber: (membershipIdx >= 0 ? cols[membershipIdx] : "")?.trim() || "",
      votersCardNumber: (votersIdx >= 0 ? cols[votersIdx] : "")?.trim() || "",
      collationRole: normalizeCollationRole({
        collationRole: collationIdx >= 0 ? cols[collationIdx] : "",
      }),
    });
  }
  return rows;
}

export const AGENT_CSV_TEMPLATE = `full_name,membership_card_number,ward,pu_code,phone,voters_card_number,collation_role
Jane Agent,MC-10001,Ward 1,EDO/ESAN-WEST/01/001,08030000001,90F5B123456789012,ward
John Agent,MC-10002,Ward 1,EDO/ESAN-WEST/01/002,08030000002,90F5B123456789013,lga
`;
