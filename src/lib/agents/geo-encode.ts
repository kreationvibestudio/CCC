/** Encoded as `lga::ward` so duplicate ward names across LGAs stay unique. */
export function encodeWardValue(lga: string, ward: string) {
  return `${lga}::${ward}`;
}

export function decodeWardValue(raw: string): { lga: string; ward: string } | null {
  const idx = raw.indexOf("::");
  if (idx <= 0) return null;
  const lga = raw.slice(0, idx).trim();
  const ward = raw.slice(idx + 2).trim();
  if (!lga || !ward) return null;
  return { lga, ward };
}
