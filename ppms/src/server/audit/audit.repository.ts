import { prisma } from "@/lib/prisma";

export type AuditEvent = {
  actorId: string;
  actorRole: string;
  action: "create" | "update" | "delete" | "transition";
  entityType: "timesheet" | "budget";
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
  projectId?: string | null;
};

export class AuditRepository {
  async write(event: AuditEvent) {
    return prisma.auditLog.create({
      data: {
        userId: event.actorId,
        actorRole: event.actorRole,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        projectId: event.projectId ?? null,
        oldValue: event.oldValue === undefined ? null : JSON.stringify(event.oldValue),
        newValue: event.newValue === undefined ? null : JSON.stringify(event.newValue),
      },
    });
  }
}
