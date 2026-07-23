import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { POST } from "../../src/app/api/timesheets/route.ts";

test("timesheet API rejects invalid input before invoking its service", async () => {
  const request = new NextRequest("http://localhost/api/timesheets", { method: "POST", body: JSON.stringify({}) });
  const response = await POST(request);
  assert.equal(response.status, 422);
});
