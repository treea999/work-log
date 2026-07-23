import { z } from "zod";

export const timesheetStatusSchema = z.enum(["draft", "submitted", "approved", "locked", "rejected"]);
export type TimesheetStatus = z.infer<typeof timesheetStatusSchema>;

export const timesheetEntrySchema = z.object({
  workDate: z.coerce.date(),
  hours: z.coerce.number().positive().max(24),
  description: z.string().trim().min(1).max(1000),
  projectId: z.string().cuid().optional(),
});

export const createTimesheetSchema = z.object({
  weekStart: z.coerce.date(),
  weekEnd: z.coerce.date(),
  projectId: z.string().cuid().optional(),
  entries: z.array(timesheetEntrySchema).min(1).max(7),
}).refine((value) => value.weekEnd >= value.weekStart, {
  message: "weekEnd must be on or after weekStart",
  path: ["weekEnd"],
});

export const updateTimesheetSchema = z.object({
  entries: z.array(timesheetEntrySchema).min(1).max(7).optional(),
  projectId: z.string().cuid().nullable().optional(),
});

export const transitionTimesheetSchema = z.object({
  reason: z.string().trim().min(1).max(1000).optional(),
});

export type CreateTimesheetInput = z.infer<typeof createTimesheetSchema>;
export type UpdateTimesheetInput = z.infer<typeof updateTimesheetSchema>;
