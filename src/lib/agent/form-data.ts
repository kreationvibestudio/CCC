export function jsonToFormData(body: Record<string, unknown>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(body)) {
    if (key.startsWith("_")) continue;
    if (value == null || value === "") continue;
    if (typeof value === "object") fd.set(key, JSON.stringify(value));
    else fd.set(key, String(value));
  }
  return fd;
}
