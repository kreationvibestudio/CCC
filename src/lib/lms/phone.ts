/** Nigerian-style phone variants so training login matches how HQ stored the number. */
export function phoneLookupValues(raw: string): string[] {
  const cleaned = raw.replace(/[^\d+]/g, "").trim();
  const digits = cleaned.replace(/\D/g, "");
  const values = new Set<string>();
  if (cleaned) values.add(cleaned);
  if (digits) values.add(digits);

  if (digits.startsWith("234") && digits.length >= 13) {
    const local = `0${digits.slice(3)}`;
    values.add(local);
    values.add(`+${digits}`);
  } else if (digits.startsWith("0") && digits.length === 11) {
    values.add(`+234${digits.slice(1)}`);
    values.add(`234${digits.slice(1)}`);
  } else if (digits.length === 10 && digits.startsWith("80")) {
    values.add(`0${digits}`);
    values.add(`+234${digits}`);
    values.add(`234${digits}`);
  }

  return [...values];
}
