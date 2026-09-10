/** Read HQ login fields from the live form DOM (including browser autofill). */
export function readLoginCredentials(formData: FormData):
  | { email: string; password: string }
  | { error: string } {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Email and password are required" };
  }
  return { email, password };
}
