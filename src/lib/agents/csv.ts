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
  if (puIdx < 0 || emailIdx < 0) return [];

  const rows: AgentCsvRow[] = [];
  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line);
    const puCode = (cols[puIdx] ?? "").trim();
    const email = (cols[emailIdx] ?? "").trim().toLowerCase();
    if (!puCode || !email.includes("@")) continue;
    rows.push({
      puCode,
      email,
      fullName: (nameIdx >= 0 ? cols[nameIdx] : "")?.trim() || email.split("@")[0],
      phone: (phoneIdx >= 0 ? cols[phoneIdx] : "")?.trim() || "",
    });
  }
  return rows;
}

export const AGENT_CSV_TEMPLATE = `pu_code,email,full_name,phone
12/03/005,jane.agent@example.com,Jane Agent,08030000001
12/03/006,john.agent@example.com,John Agent,08030000002
`;
