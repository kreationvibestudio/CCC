/** Official VerifyMe sandbox persona (test API keys only). */
export const VERIFYME_TEST_PERSONA = {
  nin: "10000000001",
  firstname: "John",
  lastname: "Doe",
  middlename: "Jane",
  dob: "04-04-1944",
  phone: "08066676673",
  gender: "female",
  birthdate: "04-04-1944",
} as const;

/** NIN is 11 digits (NIMC). Strip spaces/dashes. */
export function normalizeNin(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 11) return null;
  return digits;
}

/**
 * VerifyMe expects DOB as DD-MM-YYYY.
 * Accepts ISO (YYYY-MM-DD), DD/MM/YYYY, DD-MM-YYYY.
 */
export function toVerifyMeDob(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (iso) return `${iso[3]}-${iso[2]}-${iso[1]}`;
  const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(trimmed);
  if (dmy) {
    const dd = dmy[1].padStart(2, "0");
    const mm = dmy[2].padStart(2, "0");
    return `${dd}-${mm}-${dmy[3]}`;
  }
  return null;
}

/** Split "Ada Okoro" → firstname Ada, lastname Okoro. */
export function splitPersonName(fullName: string): { firstname: string; lastname: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstname: "", lastname: "" };
  if (parts.length === 1) return { firstname: parts[0], lastname: parts[0] };
  return { firstname: parts[0], lastname: parts.slice(1).join(" ") };
}

export function photoDataUrl(photo: string | null | undefined): string | null {
  if (!photo) return null;
  const trimmed = photo.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:")) return trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `data:image/jpeg;base64,${trimmed}`;
}
