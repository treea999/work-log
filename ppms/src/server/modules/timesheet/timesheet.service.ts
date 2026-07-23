import { AuthorizationError, requireRole, type Actor } from "@/server/auth/authorization";
import type { CreateTimesheetInput, TimesheetRepositoryPort, UpdateTimesheetInput, AuditPort } from "./timesheet.types";

const transitions = {
  draft: ["submitted"],
  submitted: ["approved", "rejected"],
  approved: ["locked"],
  rejected: ["draft"],
  locked: [],
} as const;

export class TimesheetService {
  constructor(private readonly repository: TimesheetRepositoryPort, private readonly audit: AuditPort) {}

  list(actor: Actor) {
    return this.repository.list(actor.role === "employee" ? actor.id : undefined);
  }

  async create(actor: Actor, input: CreateTimesheetInput) {
    requireRole(actor, ["employee", "manager", "hr", "admin"]);
    const created = await this.repository.create(actor.id, input);
    const record = created as { id: string; projectId?: string | null };
    await this.audit.write({ actorId: actor.id, actorRole: actor.role, action: "create", entityType: "timesheet", entityId: record.id, newValue: input, projectId: record.projectId });
    return created;
  }

  async update(actor: Actor, id: string, input: UpdateTimesheetInput) {
    const current = await this.getOwnedDraft(actor, id);
    const updated = await this.repository.update(id, input);
    await this.audit.write({ actorId: actor.id, actorRole: actor.role, action: "update", entityType: "timesheet", entityId: id, oldValue: current, newValue: input, projectId: current.projectId });
    return updated;
  }

  async delete(actor: Actor, id: string) {
    const current = await this.getOwnedDraft(actor, id);
    await this.repository.delete(id);
    await this.audit.write({ actorId: actor.id, actorRole: actor.role, action: "delete", entityType: "timesheet", entityId: id, oldValue: current, projectId: current.projectId });
  }

  submit(actor: Actor, id: string) { return this.transition(actor, id, "submitted"); }
  approve(actor: Actor, id: string) { return this.transition(actor, id, "approved"); }
  lock(actor: Actor, id: string) { return this.transition(actor, id, "locked"); }
  reject(actor: Actor, id: string, reason: string) { return this.transition(actor, id, "rejected", reason); }

  private async transition(actor: Actor, id: string, next: keyof typeof transitions, reason?: string) {
    const current = await this.find(id);
    if (next === "submitted" && current.employeeId !== actor.id) throw new AuthorizationError();
    if (next === "submitted") requireRole(actor, ["employee", "manager", "hr", "admin"]);
    if (["approved", "locked", "rejected"].includes(next)) requireRole(actor, ["manager", "hr", "admin"]);
    if (!transitions[current.status].includes(next as never)) throw new Error(`Cannot transition timesheet from ${current.status} to ${next}`);
    if (next === "rejected" && !reason) throw new Error("A rejection reason is required");
    const updated = await this.repository.transitionStatus(id, next, reason);
    await this.audit.write({ actorId: actor.id, actorRole: actor.role, action: "transition", entityType: "timesheet", entityId: id, oldValue: current.status, newValue: next, projectId: current.projectId });
    return updated;
  }

  private async getOwnedDraft(actor: Actor, id: string) {
    const current = await this.find(id);
    if (current.employeeId !== actor.id && actor.role !== "admin") throw new AuthorizationError();
    if (current.status !== "draft" && current.status !== "rejected") throw new Error("Only draft or rejected timesheets can be changed");
    return current;
  }

  private async find(id: string) {
    const record = await this.repository.findById(id);
    if (!record) throw new Error("Timesheet not found");
    return record;
  }
}
