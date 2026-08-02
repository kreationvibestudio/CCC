"use client";

import { createContext, useContext, useMemo } from "react";
import type { AuthUser } from "@/lib/auth/session";
import type { Permission } from "@/types/auth";
import { hasPermission } from "@/types/auth";

const AuthContext = createContext<AuthUser | null>(null);

export function AuthProvider({
  user,
  children,
}: {
  user: AuthUser | null;
  children: React.ReactNode;
}) {
  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const user = useContext(AuthContext);
  return user;
}

export function usePermissions() {
  const user = useAuth();
  return useMemo(
    () => ({
      can: (permission: Permission) =>
        user ? hasPermission(user.role, permission) : false,
      role: user?.role,
      permissions: user?.permissions ?? [],
    }),
    [user]
  );
}
