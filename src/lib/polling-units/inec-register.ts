import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import {
  canonicalLgaToken,
  canonicalStateToken,
  formatPollingUnitCodeFromParts,
  INEC_STATE_BY_CODE,
  padPuCode,
  padWardCode,
} from "./code.ts";

export const INEC_REGISTER_BASE =
  "https://raw.githubusercontent.com/JayCodist/inec-polling-units-scraper/main/results";

export type InecRegisterUnit = {
  delimitation: string;
  displayCode: string;
  name: string;
  stateName: string;
  stateToken: string;
  lgaName: string;
  lgaToken: string;
  wardName: string;
  stateCode: string;
  lgCode: string;
  wardCode: string;
  puCode: string;
};

export type InecStateMeta = {
  token: string;
  fileName: string;
  inecCode: string;
  inecName: string;
};

const PRIORITY_TOKENS = ["FCT", "LAGOS", "EDO"];

function fileNameForToken(token: string) {
  if (token === "FCT") return "federal-capital-territory.json";
  return `${token.toLowerCase()}.json`;
}

function inecNameForToken(token: string) {
  if (token === "FCT") return "FEDERAL CAPITAL TERRITORY";
  if (token === "AKWA-IBOM") return "AKWA IBOM";
  if (token === "CROSS-RIVER") return "CROSS RIVER";
  return token.replace(/-/g, " ");
}

export const INEC_STATE_FILES: InecStateMeta[] = Object.entries(INEC_STATE_BY_CODE)
  .sort(([codeA, tokenA], [codeB, tokenB]) => {
    const priA = PRIORITY_TOKENS.indexOf(tokenA);
    const priB = PRIORITY_TOKENS.indexOf(tokenB);
    if (priA !== -1 || priB !== -1) {
      return (priA === -1 ? 99 : priA) - (priB === -1 ? 99 : priB);
    }
    return Number(codeA) - Number(codeB);
  })
  .map(([inecCode, token]) => ({
    token,
    fileName: fileNameForToken(token),
    inecCode,
    inecName: inecNameForToken(token),
  }));

export function resolveInecState(raw: string | null | undefined): InecStateMeta | null {
  const token = canonicalStateToken(raw);
  if (token) {
    const byToken = INEC_STATE_FILES.find((row) => row.token === token);
    if (byToken) return byToken;
  }
  const digits = String(raw ?? "").replace(/\D/g, "").padStart(2, "0");
  return INEC_STATE_FILES.find((row) => row.inecCode === digits) ?? null;
}

type InecJsonUnit = {
  name?: string;
  abbreviation?: string;
  delimitation?: string;
  state?: string;
  lga?: string;
  ward?: string;
  units?: string;
};

type InecJsonWard = {
  name?: string;
  abbreviation?: string;
  pollingUnits?: InecJsonUnit[];
  units?: InecJsonUnit[];
};

type InecJsonLga = {
  name?: string;
  abbreviation?: string;
  wards?: InecJsonWard[];
};

type InecJsonState = {
  name?: string;
  code?: string;
  lgas?: InecJsonLga[];
};

export function flattenInecStateJson(payload: unknown): InecRegisterUnit[] {
  const root = payload as { state?: InecJsonState } | InecJsonState;
  const state = "state" in root && root.state ? root.state : (root as InecJsonState);
  const stateName = String(state.name ?? "").trim();
  const stateToken = canonicalStateToken(stateName) || canonicalStateToken(state.code);
  const stateCode = padWardCode(state.code) || padWardCode((state.lgas?.[0]?.wards?.[0]?.pollingUnits?.[0] ?? {}).state);
  const rows: InecRegisterUnit[] = [];

  for (const lga of state.lgas ?? []) {
    const lgaName = String(lga.name ?? "").trim();
    const lgCode = padWardCode(lga.abbreviation);
    const lgaToken = canonicalLgaToken(lgaName, stateToken, lgCode);
    for (const ward of lga.wards ?? []) {
      const wardName = String(ward.name ?? "").trim();
      const wardCode = padWardCode(ward.abbreviation);
      const units = Array.isArray(ward.pollingUnits)
        ? ward.pollingUnits
        : Array.isArray(ward.units)
          ? ward.units
          : [];
      for (const unit of units) {
        const puCode = padPuCode(unit.abbreviation || unit.units || unit.delimitation?.split("/").at(-1));
        if (!puCode || !wardCode || !lgCode || !stateCode) continue;
        const delimitation =
          String(unit.delimitation ?? "").trim() || `${stateCode}/${lgCode}/${wardCode}/${puCode}`;
        const displayCode = formatPollingUnitCodeFromParts({
          state: stateToken,
          lga: lgaToken,
          ward: wardCode,
          pu: puCode,
        });
        rows.push({
          delimitation,
          displayCode,
          name: String(unit.name ?? displayCode).trim() || displayCode,
          stateName: stateName || stateToken,
          stateToken,
          lgaName: lgaName || lgaToken,
          lgaToken,
          wardName: wardName || wardCode,
          stateCode: padWardCode(unit.state) || stateCode,
          lgCode: padWardCode(unit.lga) || lgCode,
          wardCode: padWardCode(unit.ward) || wardCode,
          puCode,
        });
      }
    }
  }
  return rows;
}

const memoryCache = new Map<string, InecRegisterUnit[]>();

function cacheDir() {
  return process.env.INEC_REGISTER_CACHE_DIR || "/tmp/inec-pu-register";
}

export async function loadInecStateUnits(stateRaw: string): Promise<InecRegisterUnit[]> {
  const meta = resolveInecState(stateRaw);
  if (!meta) throw new Error(`Unknown INEC state: ${stateRaw}`);
  const cached = memoryCache.get(meta.fileName);
  if (cached) return cached;

  const path = join(cacheDir(), meta.fileName);
  try {
    const text = await readFile(path, "utf8");
    const rows = flattenInecStateJson(JSON.parse(text));
    memoryCache.set(meta.fileName, rows);
    return rows;
  } catch {
    // download below
  }

  const url = `${INEC_REGISTER_BASE}/${meta.fileName}`;
  const res = await fetch(url, {
    headers: { "user-agent": "campaign-command-center-inec-sync/1.0" },
  });
  if (!res.ok) {
    throw new Error(`Could not download INEC register for ${meta.token} (${res.status})`);
  }
  const text = await res.text();
  const rows = flattenInecStateJson(JSON.parse(text));
  memoryCache.set(meta.fileName, rows);
  try {
    await mkdir(cacheDir(), { recursive: true });
    await writeFile(path, text);
  } catch {
    // cache is optional
  }
  return rows;
}

export function nextInecState(current?: string | null): InecStateMeta | null {
  if (!current) return INEC_STATE_FILES[0] ?? null;
  const idx = INEC_STATE_FILES.findIndex(
    (row) => row.token === canonicalStateToken(current) || row.fileName === current
  );
  if (idx < 0) return INEC_STATE_FILES[0] ?? null;
  return INEC_STATE_FILES[idx + 1] ?? null;
}
