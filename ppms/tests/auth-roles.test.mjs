import assert from "node:assert/strict";
import test from "node:test";

const EXPECTED_ROLES = ["Admin", "PM", "Finance", "Member", "Approver", "Auditor"];

test("every selectable role has an explicit permission set", async () => {
  const { ROLES, PERMISSIONS, hasPermission } = await import("../src/lib/auth.ts");

  assert.deepEqual([...ROLES], EXPECTED_ROLES);
  assert.deepEqual(Object.keys(PERMISSIONS), EXPECTED_ROLES);
  for (const role of ROLES) {
    assert.equal(Array.isArray(PERMISSIONS[role]), true);
    assert.equal(hasPermission(role, "view_projects"), true);
  }
  assert.equal(hasPermission("Manager", "view_projects"), false);
  assert.equal(hasPermission("Contributor", "view_projects"), false);
  assert.equal(hasPermission("Viewer", "view_projects"), false);
});
