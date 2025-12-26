"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useOptionalAdmin } from "./AdminContext";

export type AdminDashboardAdmin = {
  email: string;
  username: string;
  avatarUrl: string | null;
  role: "super_admin" | "admin" | string;
  isSuperAdmin: boolean;
};

export type AdminDashboardData = {
  admin: AdminDashboardAdmin;
};

const AdminDashboardDataContext = createContext<AdminDashboardData | null>(null);

function deriveFromAdminContext(adminCtx: ReturnType<typeof useOptionalAdmin>): AdminDashboardData | null {
  const profile = adminCtx?.profile ?? null;
  if (!profile) return null;

  const role = profile.role ?? "admin";
  const isSuperAdmin = profile.isSuperAdmin || role === "super_admin";

  return {
    admin: {
      email: profile.email ?? "",
      username: profile.username ?? "",
      avatarUrl: profile.avatarUrl ?? null,
      role,
      isSuperAdmin,
    },
  };
}

/**
 * Dashboard data provider (thin wrapper).
 *
 * Note: It reuses `AdminProvider` session state. If you already have `AdminProvider`
 * above, you can omit this provider and still use `useAdminDashboardData()`.
 */
export function AdminDashboardDataProvider({ children }: { children: ReactNode }) {
  const adminCtx = useOptionalAdmin();

  const value = useMemo(() => deriveFromAdminContext(adminCtx), [adminCtx]);

  return (
    <AdminDashboardDataContext.Provider value={value}>
      {children}
    </AdminDashboardDataContext.Provider>
  );
}

/**
 * Use admin dashboard data.
 *
 * Prefer wrapping with `AdminDashboardDataProvider`, but we also support deriving
 * directly from `AdminProvider` to avoid hard coupling.
 */
export function useAdminDashboardData(): AdminDashboardData {
  const fromProvider = useContext(AdminDashboardDataContext);
  const adminCtx = useOptionalAdmin();

  const derived = fromProvider ?? deriveFromAdminContext(adminCtx);
  if (!derived) {
    throw new Error(
      "useAdminDashboardData must be used within AdminProvider (and optionally AdminDashboardDataProvider)."
    );
  }
  return derived;
}


