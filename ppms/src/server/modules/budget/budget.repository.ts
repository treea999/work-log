import { prisma } from "@/lib/prisma";
import type { BudgetRepositoryPort, BudgetStatus, CreateBudgetInput, UpdateBudgetInput } from "./budget.types";

export class BudgetRepository implements BudgetRepositoryPort {
  findById(id: string) { return prisma.budget.findUnique({ where: { id } }); }
  list(projectId?: string) { return prisma.budget.findMany({ where: projectId ? { projectId } : {}, include: { project: { select: { id: true, code: true, name: true } }, createdBy: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } }); }
  create(createdById: string, input: CreateBudgetInput) { return prisma.budget.create({ data: { ...input, createdById } }); }
  update(id: string, input: UpdateBudgetInput) { return prisma.budget.update({ where: { id }, data: input }); }
  async delete(id: string) { await prisma.budget.delete({ where: { id } }); }
  transitionStatus(id: string, status: BudgetStatus, reason?: string) { return prisma.budget.update({ where: { id }, data: { status, rejectionReason: status === "rejected" ? reason : null } }); }
}
