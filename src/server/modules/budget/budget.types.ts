import type { CreateBudgetInput, UpdateBudgetInput, BudgetStatus } from "@/contracts/budget.schema";
export type { CreateBudgetInput, UpdateBudgetInput, BudgetStatus };

export type BudgetRecord = { id: string; createdById: string; projectId?: string | null; status: BudgetStatus };
export interface BudgetRepositoryPort {
  findById(id: string): Promise<BudgetRecord | null>;
  list(projectId?: string): Promise<unknown[]>;
  create(actorId: string, input: CreateBudgetInput): Promise<unknown>;
  update(id: string, input: UpdateBudgetInput): Promise<unknown>;
  delete(id: string): Promise<void>;
  transitionStatus(id: string, status: BudgetStatus, reason?: string): Promise<BudgetRecord>;
}
export interface BudgetAuditPort {
  write(event: { actorId: string; actorRole: string; action: "create" | "update" | "delete" | "transition"; entityType: "timesheet" | "budget"; entityId: string; oldValue?: unknown; newValue?: unknown; projectId?: string | null }): Promise<unknown>;
}
