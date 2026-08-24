/**
 * Canonical HQ/agent PU code: STATE/LGA/WARD/PU
 * Example: FCT/AMAC/01/001
 *
 * INEC’s delimitation id is numeric (37/06/01/001). Campaigns use the
 * state/LGA tokens. AMAC is Abuja Municipal (INEC name “MUNICIPAL”, code 06).
 */

export type PollingUnitCodeParts = {
  state: string;
  lga: string;
  ward: string;
  pu: string;
};

export type PollingUnitCodeInput = {
  code?: string | null;
  pu_code?: string | null;
  state?: string | null;
  lga?: string | null;
  ward?: string | null;
  state_code?: string | null;
  lg_code?: string | null;
  ward_code?: string | null;
};

/** INEC state codes 01–36 + 37 FCT. */
export const INEC_STATE_BY_CODE: Record<string, string> = {
  "01": "ABIA",
  "02": "ADAMAWA",
  "03": "AKWA-IBOM",
  "04": "ANAMBRA",
  "05": "BAUCHI",
  "06": "BAYELSA",
  "07": "BENUE",
  "08": "BORNO",
  "09": "CROSS-RIVER",
  "10": "DELTA",
  "11": "EBONYI",
  "12": "EDO",
  "13": "EKITI",
  "14": "ENUGU",
  "15": "GOMBE",
  "16": "IMO",
  "17": "JIGAWA",
  "18": "KADUNA",
  "19": "KANO",
  "20": "KATSINA",
  "21": "KEBBI",
  "22": "KOGI",
  "23": "KWARA",
  "24": "LAGOS",
  "25": "NASARAWA",
  "26": "NIGER",
  "27": "OGUN",
  "28": "ONDO",
  "29": "OSUN",
  "30": "OYO",
  "31": "PLATEAU",
  "32": "RIVERS",
  "33": "SOKOTO",
  "34": "TARABA",
  "35": "YOBE",
  "36": "ZAMFARA",
  "37": "FCT",
};

const STATE_ALIASES: Record<string, string> = {
  FC: "FCT",
  FCT: "FCT",
  "FEDERAL CAPITAL TERRITORY": "FCT",
  "ABUJA FCT": "FCT",
  ABUJA: "FCT",
  LA: "LAGOS",
  LAG: "LAGOS",
  ED: "EDO",
  CR: "CROSS-RIVER",
  "CROSS RIVER": "CROSS-RIVER",
  AK: "AKWA-IBOM",
  "AKWA IBOM": "AKWA-IBOM",
  NA: "NASARAWA",
  NASARAWA: "NASARAWA",
  NASSARAWA: "NASARAWA",
};

const FCT_LGA_BY_CODE: Record<string, string> = {
  "01": "ABAJI",
  "02": "BWARI",
  "03": "GWAGWALADA",
  "04": "KUJE",
  "05": "KWALI",
  "06": "AMAC",
};

const LGA_ALIASES: Record<string, string> = {
  AMAC: "AMAC",
  MUNICIPAL: "AMAC",
  "ABUJA MUNICIPAL": "AMAC",
  "ABUJA MUNICIPAL AREA COUNCIL": "AMAC",
  "MUNICIPAL AREA COUNCIL": "AMAC",
  "AREA COUNCIL": "AMAC",
  IKJ: "IKEJA",
  IKEJA: "IKEJA",
};

const AMAC_WARD_BY_NAME: Record<string, string> = {
  "CITY CENTRE": "01",
  CITYCENTRE: "01",
  GARKI: "02",
  KABUSA: "03",
  WUSE: "04",
  "WUSE II": "04",
  "WUSE 2": "04",
  GWARINPA: "05",
  JIWA: "06",
  GUI: "07",
  KARSHI: "08",
  OROZO: "09",
  KARU: "10",
  NYANYA: "11",
  GWAGWA: "12",
};

export function padWardCode(raw: string | null | undefined) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.slice(-2).padStart(2, "0");
}

export function padPuCode(raw: string | null | undefined) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.slice(-3).padStart(3, "0");
}

function key(value: string) {
  return value
    .toUpperCase()
    .replace(/[_./]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugToken(value: string) {
  const cleaned = value
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/\b(LGA|AREA COUNCIL|LOCAL GOVERNMENT)\b/g, " ")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned;
}

export function canonicalStateToken(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";
  const asCode = trimmed.replace(/\D/g, "").padStart(2, "0");
  if (/^\d+$/.test(trimmed) && INEC_STATE_BY_CODE[asCode]) return INEC_STATE_BY_CODE[asCode];
  const aliased = STATE_ALIASES[key(trimmed)];
  if (aliased) return aliased;
  const named = Object.values(INEC_STATE_BY_CODE).find((name) => name === slugToken(trimmed));
  if (named) return named;
  return slugToken(trimmed);
}

export function canonicalLgaToken(raw: string | null | undefined, stateToken: string, lgCode?: string | null) {
  const state = canonicalStateToken(stateToken);
  if (state === "FCT") {
    const fromCode = FCT_LGA_BY_CODE[padWardCode(lgCode)];
    if (fromCode) return fromCode;
  }
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    if (state === "FCT") return FCT_LGA_BY_CODE[padWardCode(lgCode)] || "";
    return padWardCode(lgCode);
  }
  if (/^\d+$/.test(trimmed) && state === "FCT") {
    return FCT_LGA_BY_CODE[padWardCode(trimmed)] || padWardCode(trimmed);
  }
  const aliased = LGA_ALIASES[key(trimmed)];
  if (aliased) return aliased;
  if (state === "FCT") {
    const fromName = Object.values(FCT_LGA_BY_CODE).find((name) => name === slugToken(trimmed));
    if (fromName) return fromName;
    if (/MUNICIPAL|AMAC/i.test(trimmed)) return "AMAC";
  }
  return slugToken(trimmed);
}

export function canonicalWardCode(
  wardCode: string | null | undefined,
  wardName: string | null | undefined,
  lgaToken: string
) {
  const padded = padWardCode(wardCode);
  if (padded) return padded;
  if (lgaToken === "AMAC") {
    const fromName = AMAC_WARD_BY_NAME[key(wardName ?? "")];
    if (fromName) return fromName;
  }
  return padWardCode(wardName);
}

export function parsePollingUnitCode(raw: string | null | undefined): PollingUnitCodeParts | null {
  const text = (raw ?? "").trim().toUpperCase().replace(/-/g, "/").replace(/\s+/g, "");
  const parts = text.split("/").filter(Boolean);
  if (parts.length < 3) return null;
  const [stateRaw, lgaRaw, wardRaw, puRaw] = parts.length === 3 ? ["", parts[0], parts[1], parts[2]] : parts;
  const pu = padPuCode(puRaw ?? parts.at(-1));
  const ward = padWardCode(wardRaw ?? parts.at(-2));
  if (!pu || !ward) return null;
  const numericInec = parts.length >= 4 && parts.slice(0, 4).every((p) => /^\d+$/.test(p));
  const state = canonicalStateToken(numericInec ? parts[0] : stateRaw);
  const lga = canonicalLgaToken(numericInec ? parts[1] : lgaRaw, state, numericInec ? parts[1] : lgaRaw);
  if (!state || !lga) return null;
  return { state, lga, ward, pu };
}

export function formatPollingUnitCodeFromParts(parts: PollingUnitCodeParts) {
  return `${parts.state}/${parts.lga}/${parts.ward}/${parts.pu}`;
}

export function isCanonicalPollingUnitCode(raw: string | null | undefined) {
  const parsed = parsePollingUnitCode(raw);
  if (!parsed) return false;
  return formatPollingUnitCodeFromParts(parsed) === String(raw ?? "").trim().toUpperCase().replace(/-/g, "/");
}

export function formatPollingUnitCode(unit: PollingUnitCodeInput): string {
  const fromStored = parsePollingUnitCode(unit.code);
  const state = canonicalStateToken(unit.state) || fromStored?.state || canonicalStateToken(unit.state_code);
  const lga = canonicalLgaToken(unit.lga, state, unit.lg_code) || fromStored?.lga || "";
  const ward =
    canonicalWardCode(unit.ward_code, unit.ward, lga) || fromStored?.ward || "";
  const pu = padPuCode(unit.pu_code) || fromStored?.pu || padPuCode(unit.code?.split("/").at(-1));
  if (state && lga && ward && pu) {
    return formatPollingUnitCodeFromParts({ state, lga, ward, pu });
  }
  if (fromStored) return formatPollingUnitCodeFromParts(fromStored);
  return (unit.code || unit.pu_code || "").trim();
}

export function withDisplayCode<T extends PollingUnitCodeInput & { code: string }>(unit: T): T {
  return { ...unit, code: formatPollingUnitCode(unit) };
}

export function inecStateNumericCode(raw: string | null | undefined): string {
  const token = canonicalStateToken(raw);
  const named = Object.entries(INEC_STATE_BY_CODE).find(([, name]) => name === token);
  if (named) return named[0];
  const digits = String(raw ?? "").replace(/\D/g, "").padStart(2, "0");
  if (INEC_STATE_BY_CODE[digits]) return digits;
  return padWardCode(raw);
}

export function inecLgaNumericCode(
  lga: string | null | undefined,
  state: string | null | undefined,
  lgCode?: string | null
): string {
  const padded = padWardCode(lgCode) || (/^\d+$/.test(String(lga ?? "").trim()) ? padWardCode(lga) : "");
  if (padded) return padded;
  const stateToken = canonicalStateToken(state);
  const lgaToken = canonicalLgaToken(lga, stateToken, lgCode);
  if (stateToken === "FCT") {
    const hit = Object.entries(FCT_LGA_BY_CODE).find(([, name]) => name === lgaToken);
    if (hit) return hit[0];
  }
  return "";
}

export function inecNumericCode(unit: PollingUnitCodeInput): string | null {
  const state = canonicalStateToken(unit.state) || canonicalStateToken(unit.state_code);
  const stateCode = inecStateNumericCode(state || unit.state_code);
  const lg = inecLgaNumericCode(unit.lga, state, unit.lg_code);
  const ward = canonicalWardCode(unit.ward_code, unit.ward, canonicalLgaToken(unit.lga, state, unit.lg_code));
  const pu = padPuCode(unit.pu_code) || padPuCode(parsePollingUnitCode(unit.code)?.pu);
  if (!stateCode || !lg || !ward || !pu) return null;
  return `${stateCode}/${lg}/${ward}/${pu}`;
}

export function inecNumericCodeFromParts(parts: PollingUnitCodeParts): string | null {
  return inecNumericCode({
    state: parts.state,
    lga: parts.lga,
    ward_code: parts.ward,
    pu_code: parts.pu,
    lg_code: parts.lga,
  });
}
