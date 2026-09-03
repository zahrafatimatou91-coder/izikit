'use client';

import { createContext, useContext } from 'react';

export interface AdminMe {
  id: string;
  email: string;
  role: 'ADMIN' | 'SUPERADMIN';
}

interface AdminContextValue {
  admin: AdminMe;
  /** Capability strings from GET /api/admin/me. Server still re-checks every
   * mutation — this only drives which controls are shown. */
  can: string[];
  isSuperadmin: boolean;
}

export const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used inside the /admin layout');
  return ctx;
}
