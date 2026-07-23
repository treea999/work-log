import assert from "node:assert/strict";
import test from "node:test";

test("a finance user can submit a draft budget for review and creates an audit event", async () => {
  const { BudgetService } = await import("../../src/server/modules/budget/budget.service.ts");
  const repository = {
    findById: async () => ({ id: "budget_1", createdById: "finance_1", status: "draft" }),
    transitionStatus: async (_id, status) => ({ id: "budget_1", createdById: "finance_1", status }),
    create: async () => { throw new Error("not used"); }, list: async () => [], update: async () => ({}), delete: async () => undefined,
  };
  const events = [];
  const service = new BudgetService(repository, { write: async (event) => { events.push(event); } });
  const result = await service.submitForReview({ id: "finance_1", role: "finance" }, "budget_1");
  assert.equal(result.status, "pending_review");
  assert.equal(events[0].entityType, "budget");
  assert.equal(events[0].action, "transition");
});
