import { prisma } from "@/lib/prisma";
import type { CreateTimesheetInput, TimesheetRepositoryPort, TimesheetStatus, UpdateTimesheetInput } from "./timesheet.types";

export class TimesheetRepository implements TimesheetRepositoryPort {
  findById(id: string) {
    return prisma.timesheet.findUnique({ where: { id } });
  }

  list(employeeId?: string) {
    return prisma.timesheet.findMany({ where: employeeId ? { employeeId } : {}, include: { entries: true, employee: { select: { id: true, name: true, department: true } } }, orderBy: { weekStart: "desc" } });
  }

  create(employeeId: string, input: CreateTimesheetInput) {
    const { entries, ...timesheet } = input;
    return prisma.timesheet.create({ data: { ...timesheet, employeeId, entries: { create: entries } }, include: { entries: true } });
  }

  update(id: string, input: UpdateTimesheetInput) {
    const { entries, ...data } = input;
    return prisma.timesheet.update({ where: { id }, data: { ...data, ...(entries ? { entries: { deleteMany: {}, create: entries } } : {}) }, include: { entries: true } });
  }

  async delete(id: string) { await prisma.timesheet.delete({ where: { id } }); }

  transitionStatus(id: string, status: TimesheetStatus, reason?: string) {
    const now = new Date();
    return prisma.timesheet.update({ where: { id }, data: { status, rejectedReason: status === "rejected" ? reason : null, submittedAt: status === "submitted" ? now : undefined, approvedAt: status === "approved" ? now : undefined, lockedAt: status === "locked" ? now : undefined } });
  }
}
