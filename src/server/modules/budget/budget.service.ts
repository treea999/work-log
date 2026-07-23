import { requireRole, type Actor } from "@/server/auth/authorization";
import type { BudgetAuditPort, BudgetRepositoryPort, CreateBudgetInput, UpdateBudgetInput } from "./budget.types";

const transitions = { draft: ["pending_review"], pending_review: ["approved", "rejected"], approved: ["active"], active: [], rejected: ["draft"] } as const;

export class BudgetService {
  constructor(private readonly repository: BudgetRepositoryPort, private readonly audit: BudgetAuditPort) {}
  list(projectId?: string) { return this.repository.list(projectId); }

  async create(actor: Actor, input: CreateBudgetInput) {
    requireRole(actor, ["finance", "manager", "admin"]);
    const budget = await this.repository.create(actor.id, input);
    const record = budget as { id: string; projectId?: string | null };
    await this.audit.write({ actorId: actor.id, actorRole: actor.role, action: "create", entityType: "budget", entityId: record.id, newValue: input, projectId: record.projectId });
    return budget;
  }

  async update(actor: Actor, id: string, input: UpdateBudgetInput) {
    requireRole(actor, ["finance", "admin"]);
    const current = await this.findEditable(id);
    const budget = await this.repository.update(id, input);
    await this.audit.write({ actorId: actor.id, actorRole: actor.role, action: "update", entityType: "budget", entityId: id, oldValue: current, newValue: input, projectId: current.projectId });
    return budget;
  }

  async delete(actor: Actor, id: string) {
    requireRole(actor, ["admin"]);
    const current = await this.findEditable(id);
    await this.repository.delete(id);
    await this.audit.write({ actorId: actor.id, actorRole: actor.role, action: "delete", entityType: "budget", entityId: id, oldValue: current, projectId: current.projectId });
  }

  submitForReview(actor: Actor, id: string) { return this.transition(actor, id, "pending_review"); }
  approve(actor: Actor, id: string) { return this.transition(actor, id, "approved"); }
  activate(actor: Actor, id: string) { return this.transition(actor, id, "active"); }
  reject(actor: Actor, id: string, reason: string) { return this.transition(actor, id, "rejected", reason); }

  private async transition(actor: Actor, id: string, next: keyof typeof transitions, reason?: string) {
    const current = await this.find(id);
    if (next === "pending_review") requireRole(actor, ["finance", "manager", "admin"]);
    if (["approved", "rejected"].includes(next)) requireRole(actor, ["finance", "admin"]);
    if (next === "active") requireRole(actor, ["finance", "admin"]);
    if (!transitions[current.status].includes(next as never)) throw new Error(`Cannot transition budget from ${current.status} to ${next}`);
    if (next === "rejected" && !reason) throw new Error("A rejection reason is required");
    const updated = await this.repository.transitionStatus(id, next, reason);
    await this.audit.write({ actorId: actor.id, actorRole: actor.role, action: "transition", entityType: "budget", entityId: id, oldValue: current.status, newValue: next, projectId: current.projectId });
    return updated;
  }

  private async findEditable(id: string) { const current = await this.find(id); if (!(["draft", "rejected"] as const).includes(current.status as "draft" | "rejected")) throw new Error("Only draft or rejected budgets can be changed"); return current; }
  private async find(id: string) { const value = await this.repository.findById(id); if (!value) throw new Error("Budget not found"); return value; }
}

