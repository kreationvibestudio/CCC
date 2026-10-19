import { resolveLoginAuthEmail } from "./phone-username.ts";

/** Read HQ login fields from the live form DOM (including browser autofill). */
export function readLoginCredentials(formData: FormData):
  | { email: string; password: string }
  | { error: string } {
  const identifier = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!identifier || !password) {
    return { error: "Email or phone and password are required" };
  }
  return { email: resolveLoginAuthEmail(identifier), password };
}
