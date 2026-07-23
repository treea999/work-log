import type { ActorRole } from "@/contracts/auth.schema";

export type Actor = { id: string; role: ActorRole; name?: string };

const legacyRoleMap: Record<string, ActorRole> = {
  Admin: "admin", PM: "manager", Finance: "finance", Member: "employee", Approver: "manager", Auditor: "hr",
};

export function toActor(user: { id: string; role: string; name?: string } | null): Actor | null {
  if (!user) return null;
  const role = legacyRoleMap[user.role] ?? user.role;
  if (!["employee", "manager", "hr", "finance", "admin"].includes(role)) return null;
  return { id: user.id, role: role as ActorRole, name: user.name };
}

export function requireRole(actor: Actor, allowed: readonly ActorRole[]) {
  if (!allowed.includes(actor.role)) throw new AuthorizationError();
}

export class AuthorizationError extends Error {
  status = 403;
  constructor(message = "Forbidden") { super(message); }
}
