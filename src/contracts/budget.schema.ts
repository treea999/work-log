import { z } from "zod";

export const budgetStatusSchema = z.enum(["draft", "pending_review", "approved", "active", "rejected"]);
export type BudgetStatus = z.infer<typeof budgetStatusSchema>;

const amount = z.coerce.number().nonnegative().finite();

const budgetFieldsSchema = z.object({
  projectId: z.string().cuid().optional(),
  fiscalYear: z.string().trim().regex(/^\d{4}$/),
  name: z.string().trim().min(1).max(200),
  totalAmount: amount,
  capitalAmount: amount.default(0),
  operatingAmount: amount.default(0),
  personnelAmount: amount.default(0),
  procurementAmount: amount.default(0),
  travelAmount: amount.default(0),
  reserveAmount: amount.default(0),
  notes: z.string().trim().max(2000).optional(),
});

export const createBudgetSchema = budgetFieldsSchema.superRefine((value, ctx) => {
  const allocated = value.capitalAmount + value.operatingAmount + value.personnelAmount
    + value.procurementAmount + value.travelAmount + value.reserveAmount;
  if (allocated > value.totalAmount) {
    ctx.addIssue({ code: "custom", path: ["totalAmount"], message: "Allocated amounts cannot exceed totalAmount" });
  }
});

export const updateBudgetSchema = budgetFieldsSchema
  .partial()
  .omit({ projectId: true, fiscalYear: true });
export const transitionBudgetSchema = z.object({ reason: z.string().trim().min(1).max(1000).optional() });

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
