export type AgentCsvRow = {
  puCode: string;
  email: string;
  fullName: string;
  phone: string;
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
  const phoneIdx = idx(["phone", "mobile", "tel"]);
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
    });
  }
  return rows;
}

export const AGENT_CSV_TEMPLATE = `pu_code,full_name,phone,email
FCT/AMAC/01/001,Jane Agent,08030000001,
FCT/AMAC/01/002,John Agent,08030000002,
`;
