export const MIN_PASSWORD_LENGTH = 8;

export function mustChangePassword(user: {
  app_metadata?: Record<string, unknown> | null;
} | null | undefined): boolean {
  return user?.app_metadata?.must_change_password === true;
}

export function validateNewPassword(input: {
  current: string;
  next: string;
  confirm: string;
}): string | null {
  const current = input.current;
  const next = input.next;
  const confirm = input.confirm;
  if (!current) return "Enter your current password";
  if (!next || next.length < MIN_PASSWORD_LENGTH) {
    return `New password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (next !== confirm) return "New password and confirmation do not match";
  if (next === current) return "Choose a new password that is different from the current one";
  return null;
}

export function passwordChangeAllowedPath(pathname: string): boolean {
  return (
    pathname.startsWith("/change-password") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/api/agent") ||
    pathname === "/agent/login"
  );
}
