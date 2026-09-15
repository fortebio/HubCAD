import { useAuthStore } from '@/stores/useAuthStore';

export const ROLES = {
  designer: { en: 'Designer', vn: 'Thiết kế', rank: 1 },
  reviewer: { en: 'Reviewer', vn: 'Kiểm tra', rank: 2 },
  manager: { en: 'Manager', vn: 'Quản lý', rank: 3 },
};

export function useRole() {
  return useAuthStore((s) => s.user?.role || null);
}

export function useHasRole(...allowed) {
  const role = useRole();
  return role ? allowed.includes(role) : false;
}

export function useMinRole(minRank) {
  const role = useRole();
  if (!role) return false;
  return (ROLES[role]?.rank || 0) >= minRank;
}

// Render-prop / wrapper guard: only renders children if user has one of the allowed roles.
export function RoleGate({ allow, minRank, fallback = null, children }) {
  const role = useRole();
  if (!role) return fallback;
  if (allow && !allow.includes(role)) return fallback;
  if (minRank && (ROLES[role]?.rank || 0) < minRank) return fallback;
  return children;
}
