import type { CreateTimesheetInput, UpdateTimesheetInput, TimesheetStatus } from "@/contracts/timesheet.schema";

export type { CreateTimesheetInput, UpdateTimesheetInput, TimesheetStatus };

export type TimesheetRecord = {
  id: string;
  employeeId: string;
  projectId?: string | null;
  status: TimesheetStatus;
  weekStart: Date;
  weekEnd: Date;
};

export interface TimesheetRepositoryPort {
  findById(id: string): Promise<TimesheetRecord | null>;
  list(employeeId?: string): Promise<unknown[]>;
  create(employeeId: string, input: CreateTimesheetInput): Promise<unknown>;
  update(id: string, input: UpdateTimesheetInput): Promise<unknown>;
  delete(id: string): Promise<void>;
  transitionStatus(id: string, status: TimesheetStatus, reason?: string): Promise<TimesheetRecord>;
}

export interface AuditPort {
  write(event: {
    actorId: string; actorRole: string; action: "create" | "update" | "delete" | "transition";
    entityType: "timesheet" | "budget"; entityId: string; oldValue?: unknown; newValue?: unknown; projectId?: string | null;
  }): Promise<unknown>;
}
