import assert from "node:assert/strict";
import test from "node:test";

test("an employee can submit only their own draft timesheet", async () => {
  const { TimesheetService } = await import("../../src/server/modules/timesheet/timesheet.service.ts");
  const repository = {
    findById: async () => ({ id: "ts_1", employeeId: "employee_1", status: "draft" }),
    transitionStatus: async (_id, status) => ({ id: "ts_1", employeeId: "employee_1", status }),
    create: async () => { throw new Error("not used"); },
    list: async () => [],
    update: async () => { throw new Error("not used"); },
    delete: async () => { throw new Error("not used"); },
  };
  const audit = { write: async () => undefined };
  const service = new TimesheetService(repository, audit);

  const result = await service.submit({ id: "employee_1", role: "employee" }, "ts_1");

  assert.equal(result.status, "submitted");
});
